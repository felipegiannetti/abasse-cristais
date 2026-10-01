import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './sales.dto';
import { SalesService } from './sales.service';
import { likeSafe } from '../common/like';

const notFound = () => new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found.' });

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  /** Customers with how much they bought (cancelled sales do not count). */
  async list(q: ListCustomersQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.CustomerWhereInput = q.q
      ? {
          OR: [
            { name: { contains: likeSafe(q.q), mode: 'insensitive' } },
            { email: { contains: likeSafe(q.q), mode: 'insensitive' } },
            { phone: { contains: likeSafe(q.q) } },
            { city: { contains: likeSafe(q.q), mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.customer.count({ where }),
    ]);
    const stats = rows.length
      ? await this.prisma.sale.groupBy({
          by: ['customerId'],
          where: { customerId: { in: rows.map((r) => r.id) }, status: { in: SalesService.COUNTED } },
          _sum: { totalCents: true },
          _count: { _all: true },
          _max: { soldAt: true },
        })
      : [];
    const byId = new Map(stats.map((s) => [s.customerId, s]));
    return {
      items: rows.map((c) => ({
        ...c,
        orders: byId.get(c.id)?._count._all ?? 0,
        spentCents: byId.get(c.id)?._sum.totalCents ?? 0,
        lastPurchaseAt: byId.get(c.id)?._max.soldAt ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw notFound();
    const sales = await this.prisma.sale.findMany({
      where: { customerId: id },
      orderBy: { soldAt: 'desc' },
      take: 100,
      select: {
        id: true,
        number: true,
        soldAt: true,
        status: true,
        totalCents: true,
        shippingMethod: true,
        trackingCode: true,
        items: { select: { productName: true, mode: true, quantity: true } },
      },
    });
    return { ...c, sales };
  }

  async create(dto: CreateCustomerDto, actorId: string) {
    const customer = await this.prisma.customer.create({ data: { ...dto } });
    await this.audit.record({ actorId, action: 'customer.create', entityType: 'Customer', entityId: customer.id, summary: `Cadastrou o cliente "${customer.name}"` });
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    if (!(await this.prisma.customer.count({ where: { id } }))) throw notFound();
    const customer = await this.prisma.customer.update({ where: { id }, data: { ...dto } });
    await this.audit.record({ actorId, action: 'customer.update', entityType: 'Customer', entityId: customer.id, summary: `Atualizou o cliente "${customer.name}"` });
    return customer;
  }

  /**
   * Erasure of personal data (LGPD/GDPR): removes the customer and blanks the personal snapshots kept on
   * their sales (name, address, free-text notes and tracking code, which can identify the person). The sales themselves stay, anonymized, so the financial history is not lost.
   */
  async erase(actorId: string, id: string, currentPassword: string) {
    await this.auth.assertPassword(actorId, currentPassword);
    await this.prisma.$transaction(async (tx) => {
      if (!(await tx.customer.count({ where: { id } }))) throw notFound();
      await tx.sale.updateMany({
        where: { customerId: id },
        data: { customerName: '(personal data erased)', shipTo: Prisma.DbNull, customerId: null, notes: null, trackingCode: null },
      });
      await tx.customer.delete({ where: { id } });
    });
    this.logger.log(`admin ${actorId} erased customer ${id}`);
    // deliberately no customer name in the summary — this action exists to remove that information
    await this.audit.record({ actorId, action: 'customer.erase', entityType: 'Customer', entityId: id, summary: 'Apagou os dados pessoais de um cliente (LGPD/GDPR)' });
  }
}
