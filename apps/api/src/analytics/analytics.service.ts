import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// WhatsAppClick.createdAt is `timestamp without time zone` under a non-UTC session timezone
// (America/Sao_Paulo); see finance.service.ts's `ts()` for why a raw Date parameter can't be compared
// against it directly without silently shifting by the session's offset.
const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;

interface TrackClickInput {
  ref: string;
  /** Validated against WA_SOURCES by the controller's DTO before this is ever called. */
  source: string;
  path: string;
  productSlug?: string;
  locale: string;
}

// Same reasoning as FinanceService's cache: a short per-instance TTL so reopening the Cliques tab
// doesn't rescan the whole window every time, without ever serving data more than half a minute stale.
const CLICKS_CACHE_TTL_MS = 30_000;

/** Counts and reports on WhatsApp-button clicks (see TrackController/AnalyticsController for the HTTP surface). */
@Injectable()
export class AnalyticsService {
  private readonly cache = new Map<number, { at: number; data: Awaited<ReturnType<AnalyticsService['computeClicks']>> }>();

  constructor(private readonly prisma: PrismaService) {}

  async trackClick(input: TrackClickInput): Promise<void> {
    await this.prisma.whatsAppClick.createMany({
      data: [{ ref: input.ref, source: input.source, path: input.path, productSlug: input.productSlug ?? null, locale: input.locale }],
      skipDuplicates: true, // the same ref twice (double click / retry) counts once
    });
    this.cache.clear();
  }

  async clicks(days: number) {
    const cached = this.cache.get(days);
    if (cached && Date.now() - cached.at < CLICKS_CACHE_TTL_MS) return cached.data;
    const data = await this.computeClicks(days);
    this.cache.set(days, { at: Date.now(), data });
    return data;
  }

  // SQL aggregates instead of loading every click row in the window (up to 50,000, a silent truncation
  // risk) and reducing them in application code — see FinanceService for the same change and reasoning.
  private async computeClicks(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const where = { createdAt: { gte: since } };

    const [total, confirmed, bySourceRows, topSlugRows, dailyRows] = await Promise.all([
      this.prisma.whatsAppClick.count({ where }),
      this.prisma.whatsAppClick.count({ where: { ...where, confirmedAt: { not: null } } }),
      this.prisma.whatsAppClick.groupBy({ by: ['source'], where, _count: { _all: true } }),
      this.prisma.whatsAppClick.groupBy({
        by: ['productSlug'],
        where: { ...where, productSlug: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { productSlug: 'desc' } },
        take: 8,
      }),
      this.prisma.$queryRaw<{ date: string; count: number; confirmed: number }[]>`
        SELECT to_char("createdAt" - interval '3 hours', 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS count,
               COUNT(*) FILTER (WHERE "confirmedAt" IS NOT NULL)::int AS confirmed
        FROM "WhatsAppClick"
        WHERE "createdAt" >= ${ts(since)}
        GROUP BY 1
      `,
    ]);

    const slugs = topSlugRows.map((r) => r.productSlug).filter((s): s is string => s !== null);
    const names = new Map((await this.prisma.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })).map((p) => [p.slug, p.name]));

    return {
      days,
      total,
      confirmed,
      bySource: bySourceRows.map((r) => ({ source: r.source, count: r._count._all })).sort((a, b) => b.count - a.count),
      topProducts: slugs.map((slug, i) => ({ slug, name: names.get(slug) ?? slug, count: topSlugRows[i]._count._all })),
      daily: dailyRows.map((r) => ({ date: r.date, count: r.count, confirmed: r.confirmed })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /** The admin types the "Ref: XXXXXX" code from a WhatsApp conversation to mark it as received. */
  async confirm(ref: string) {
    const click = await this.prisma.whatsAppClick.findUnique({ where: { ref } });
    if (!click) throw new NotFoundException({ code: 'CLICK_NOT_FOUND', message: 'No click found for this code.' });
    const already = click.confirmedAt !== null;
    if (!already) {
      await this.prisma.whatsAppClick.update({ where: { id: click.id }, data: { confirmedAt: new Date() } });
      this.cache.clear();
    }
    return { ref: click.ref, source: click.source, path: click.path, productSlug: click.productSlug, clickedAt: click.createdAt, alreadyConfirmed: already };
  }
}
