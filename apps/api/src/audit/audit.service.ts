import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RecordInput {
  /** The admin who did it. Looked up to snapshot a username (so the log reads even if that admin is later removed). */
  actorId: string;
  /** dot-separated: "<entity>.<verb>", e.g. "product.create", "sale.cancel", "team.remove". */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Human-readable, in Portuguese (the admin panel is Portuguese-only). */
  summary: string;
}

/**
 * Writes one row per admin-made change to business data. Best-effort: a logging failure must never
 * break the actual action, so every write is swallowed (and warned about) rather than thrown.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordInput): Promise<void> {
    try {
      const actor = await this.prisma.adminUser.findUnique({
        where: { id: input.actorId },
        select: { username: true },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          actorUsername: actor?.username ?? 'desconhecido',
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          summary: input.summary,
        },
      });
    } catch (e) {
      this.logger.warn(`failed to write audit log for "${input.action}": ${(e as Error).message}`);
    }
  }

  async list(opts: { page: number; pageSize: number; entityType?: string }) {
    const where = opts.entityType ? { entityType: opts.entityType } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }
}
