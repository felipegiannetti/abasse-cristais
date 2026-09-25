import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma, ProductStatus, SaleMode, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { detectImage } from '../products/image-type';
import { imageUrl } from '../products/products.service';
import { CreateSaleDto, ListSalesQuery, UpdateSaleDto } from './sales.dto';
import { likeSafe } from '../common/like';

const MAX_PHOTOS_PER_SALE = 6;
const MAX_TOTAL_CENTS = 2_000_000_000; // int4 column (R$ 20 million)
export const salePhotoUrl = (id: string) => `/api/admin/sales/photos/${id}`;

const saleInclude = {
  items: {
    include: { product: { select: { images: { select: { id: true }, orderBy: { position: 'asc' as const }, take: 1 } } } },
  },
  photos: { select: { id: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SaleInclude;
type SaleFull = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

const err = (status: 400 | 404 | 409, code: string, message: string) => {
  const body = { code, message };
  return status === 404 ? new NotFoundException(body) : status === 409 ? new ConflictException(body) : new BadRequestException(body);
};

/** Price × quantity in cents: pieces for UNIT, grams for WEIGHT (price is per kg). */
export function lineTotal(mode: SaleMode, unitPriceCents: number, quantity: number): number {
  return mode === 'WEIGHT' ? Math.round((unitPriceCents * quantity) / 1000) : unitPriceCents * quantity;
}

/** Keeps the public status in sync when stock reaches zero (or comes back), without touching manual statuses. */
function nextStatus(before: number, after: number, current: ProductStatus): ProductStatus {
  if (before > 0 && after <= 0 && current === 'AVAILABLE') return 'SOLD_OUT';
  if (before <= 0 && after > 0 && current === 'SOLD_OUT') return 'AVAILABLE';
  return current;
}

export function serializeSale(s: SaleFull) {
  return {
    id: s.id,
    number: s.number,
    soldAt: s.soldAt,
    status: s.status,
    customerId: s.customerId,
    customerName: s.customerName,
    shipTo: s.shipTo,
    shippingMethod: s.shippingMethod,
    shippingCostCents: s.shippingCostCents,
    trackingCode: s.trackingCode,
    paymentMethod: s.paymentMethod,
    discountCents: s.discountCents,
    subtotalCents: s.subtotalCents,
    totalCents: s.totalCents,
    currency: s.currency,
    notes: s.notes,
    clickRef: s.clickRef,
    createdAt: s.createdAt,
    items: s.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      category: i.category,
      mode: i.mode,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      costCents: i.costCents,
      totalCents: i.totalCents,
      cover: i.product?.images[0] ? imageUrl(i.product.images[0].id) : null,
    })),
    photos: s.photos.map((p) => ({ id: p.id, url: salePhotoUrl(p.id) })),
  };
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------- read

  async list(q: ListSalesQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const num = q.q && /^#?\d{1,9}$/.test(q.q) ? Number(q.q.replace('#', '')) : undefined;
    const where: Prisma.SaleWhereInput = {
      status: q.status,
      soldAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
      OR: q.q
        ? [
            { customerName: { contains: likeSafe(q.q), mode: 'insensitive' } },
            { items: { some: { productName: { contains: likeSafe(q.q), mode: 'insensitive' } } } },
            { clickRef: q.q.toUpperCase() },
            ...(num !== undefined ? [{ number: num }] : []),
          ]
        : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({ where, include: saleInclude, orderBy: { soldAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.sale.count({ where }),
    ]);
    return { items: rows.map(serializeSale), total, page, pageSize };
  }

  async findOne(id: string) {
    const s = await this.prisma.sale.findUnique({ where: { id }, include: saleInclude });
    if (!s) throw err(404, 'SALE_NOT_FOUND', 'Sale not found.');
    return serializeSale(s);
  }

  // ------------------------------------------------------------- create

  async create(actorId: string, dto: CreateSaleDto) {
    if (dto.status === 'CANCELLED') throw err(400, 'INVALID_STATUS', 'A new sale cannot start cancelled.');
    if (!dto.customerId && !dto.customer) throw err(400, 'CUSTOMER_REQUIRED', 'Choose a customer or enter the customer data.');

    const saleId = await this.prisma.$transaction(async (tx) => {
      // customer (existing or created inline)
      const customer = dto.customerId
        ? await tx.customer.findUnique({ where: { id: dto.customerId } })
        : await tx.customer.create({ data: { ...dto.customer! } });
      if (!customer) throw err(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');

      // lock the products in a stable order (avoids deadlocks) so concurrent sales cannot oversell
      const ids = [...new Set(dto.items.map((i) => i.productId))].sort();
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
      const products = new Map((await tx.product.findMany({ where: { id: { in: ids } } })).map((p) => [p.id, p]));
      if (products.size !== ids.length) throw err(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

      // stock needed per product (the same product may appear on several lines)
      const need = new Map<string, number>();
      const lines = dto.items.map((it) => {
        const p = products.get(it.productId)!;
        const unit = it.unitPriceCents ?? p.priceCents;
        if (unit == null) throw err(400, 'PRICE_REQUIRED', `Set a price for "${p.name}" (it has no price registered).`);
        need.set(p.id, (need.get(p.id) ?? 0) + it.quantity);
        return { p, quantity: it.quantity, unit, total: lineTotal(p.saleMode, unit, it.quantity) };
      });
      for (const [pid, qty] of need) {
        const p = products.get(pid)!;
        const have = p.saleMode === 'WEIGHT' ? p.stockGrams : p.stockQuantity;
        if (qty > have) throw err(409, 'INSUFFICIENT_STOCK', `Not enough stock of "${p.name}".`);
      }

      const subtotal = lines.reduce((n, l) => n + l.total, 0);
      const discount = dto.discountCents ?? 0;
      const shipping = dto.shippingCostCents ?? 0;
      if (discount > subtotal) throw err(400, 'DISCOUNT_TOO_HIGH', 'The discount cannot exceed the items subtotal.');
      const total = subtotal - discount + shipping;
      if (total > MAX_TOTAL_CENTS) throw err(400, 'TOTAL_TOO_LARGE', 'The sale total is too large.');

      // address snapshot: what was typed for this sale, else the customer's registered address
      const shipTo = dto.shipTo
        ? { ...dto.shipTo }
        : customer.addressLine1 && customer.city && customer.country
          ? {
              recipient: customer.name,
              line1: customer.addressLine1,
              line2: customer.addressLine2,
              city: customer.city,
              region: customer.region,
              postalCode: customer.postalCode,
              country: customer.country,
            }
          : undefined;

      const sale = await tx.sale.create({
        data: {
          soldAt: dto.soldAt ? new Date(dto.soldAt) : undefined,
          status: dto.status ?? 'PAID',
          customerId: customer.id,
          customerName: customer.name,
          shipTo: shipTo as Prisma.InputJsonValue | undefined,
          shippingMethod: dto.shippingMethod ?? null,
          shippingCostCents: shipping,
          trackingCode: dto.trackingCode ?? null,
          paymentMethod: dto.paymentMethod,
          discountCents: discount,
          subtotalCents: subtotal,
          totalCents: total,
          notes: dto.notes ?? null,
          clickRef: dto.clickRef ?? null,
          createdById: actorId,
          items: {
            create: lines.map((l) => ({
              productId: l.p.id,
              productName: l.p.name,
              category: l.p.category,
              mode: l.p.saleMode,
              quantity: l.quantity,
              unitPriceCents: l.unit,
              costCents: l.p.costCents,
              totalCents: l.total,
            })),
          },
        },
        select: { id: true },
      });

      // take the stock out and flip the public status when a product runs out
      for (const [pid, qty] of need) {
        const p = products.get(pid)!;
        const before = p.saleMode === 'WEIGHT' ? p.stockGrams : p.stockQuantity;
        const after = before - qty;
        await tx.product.update({
          where: { id: pid },
          data: {
            ...(p.saleMode === 'WEIGHT' ? { stockGrams: after } : { stockQuantity: after }),
            status: nextStatus(before, after, p.status),
          },
        });
      }

      // a sale that came from a WhatsApp click confirms that conversation
      if (dto.clickRef) {
        await tx.whatsAppClick.updateMany({ where: { ref: dto.clickRef, confirmedAt: null }, data: { confirmedAt: new Date() } });
      }
      return sale.id;
    });

    this.logger.log(`admin ${actorId} registered sale ${saleId}`);
    return this.findOne(saleId);
  }

  // ------------------------------------------------------------- update / cancel

  async update(actorId: string, id: string, dto: UpdateSaleDto) {
    await this.prisma.$transaction(async (tx) => {
      // serialize concurrent updates of the same sale: two simultaneous cancellations (double click, two admins)
      // must not both see "not cancelled yet" and restock twice
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${id} FOR UPDATE`;
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
      if (!sale) throw err(404, 'SALE_NOT_FOUND', 'Sale not found.');

      if (sale.status === 'CANCELLED' && dto.status && dto.status !== 'CANCELLED') {
        throw err(409, 'SALE_CANCELLED', 'A cancelled sale cannot be reopened. Register a new sale instead.');
      }

      // cancelling gives the stock back (once)
      if (dto.status === 'CANCELLED' && sale.status !== 'CANCELLED') {
        const back = new Map<string, { mode: SaleMode; qty: number }>();
        for (const it of sale.items) {
          if (!it.productId) continue; // product was deleted: nothing to restock
          const cur = back.get(it.productId);
          back.set(it.productId, { mode: it.mode, qty: (cur?.qty ?? 0) + it.quantity });
        }
        const ids = [...back.keys()].sort();
        if (ids.length) {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
          for (const p of await tx.product.findMany({ where: { id: { in: ids } } })) {
            const b = back.get(p.id)!;
            const before = p.saleMode === 'WEIGHT' ? p.stockGrams : p.stockQuantity;
            const after = before + b.qty;
            await tx.product.update({
              where: { id: p.id },
              data: {
                ...(p.saleMode === 'WEIGHT' ? { stockGrams: after } : { stockQuantity: after }),
                status: nextStatus(before, after, p.status),
              },
            });
          }
        }
      }

      await tx.sale.update({
        where: { id },
        data: {
          status: dto.status,
          trackingCode: dto.trackingCode,
          shippingMethod: dto.shippingMethod,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
        },
      });
    });
    this.logger.log(`admin ${actorId} updated sale ${id}`);
    return this.findOne(id);
  }

  // ------------------------------------------------------------- photos

  async addPhoto(saleId: string, file: Express.Multer.File | undefined) {
    if (!file) throw err(400, 'IMAGE_REQUIRED', 'Send an image in the "file" field.');
    const kind = detectImage(file.buffer);
    if (!kind) throw new UnsupportedMediaTypeException({ code: 'INVALID_IMAGE_FORMAT', message: 'Invalid format. Use JPG, PNG or WebP.' });

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;
      if (!(await tx.sale.count({ where: { id: saleId } }))) throw err(404, 'SALE_NOT_FOUND', 'Sale not found.');
      if ((await tx.salePhoto.count({ where: { saleId } })) >= MAX_PHOTOS_PER_SALE) {
        throw err(400, 'IMAGE_LIMIT', `Limit of ${MAX_PHOTOS_PER_SALE} photos per sale.`);
      }
      const photo = await tx.salePhoto.create({
        data: { saleId, data: new Uint8Array(file.buffer), mimeType: kind.mime, size: file.buffer.length },
        select: { id: true },
      });
      return { id: photo.id, url: salePhotoUrl(photo.id) };
    });
  }

  async getPhoto(photoId: string) {
    if (!/^[a-z0-9]{20,32}$/.test(photoId)) throw err(404, 'IMAGE_NOT_FOUND', 'Image not found.');
    const p = await this.prisma.salePhoto.findUnique({ where: { id: photoId }, select: { data: true, mimeType: true } });
    if (!p) throw err(404, 'IMAGE_NOT_FOUND', 'Image not found.');
    return { data: Buffer.from(p.data), mimeType: p.mimeType };
  }

  async removePhoto(saleId: string, photoId: string) {
    const { count } = await this.prisma.salePhoto.deleteMany({ where: { id: photoId, saleId } });
    if (!count) throw err(404, 'IMAGE_NOT_FOUND', 'Image not found.');
  }

  /** Statuses that count as real revenue in the reports. */
  static readonly COUNTED: SaleStatus[] = ['PAID', 'SHIPPED', 'DELIVERED'];
}
