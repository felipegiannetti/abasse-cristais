import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  private async computeClicks(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.whatsAppClick.findMany({
      where: { createdAt: { gte: since } },
      select: { source: true, productSlug: true, createdAt: true, confirmedAt: true },
      take: 50_000,
    });

    const bySource = new Map<string, number>();
    const bySlug = new Map<string, number>();
    const daily = new Map<string, { count: number; confirmed: number }>();
    let confirmed = 0;
    for (const r of rows) {
      bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
      if (r.productSlug) bySlug.set(r.productSlug, (bySlug.get(r.productSlug) ?? 0) + 1);
      const key = new Date(r.createdAt.getTime() - 3 * 3_600_000).toISOString().slice(0, 10); // Brazil time (UTC-3)
      const d = daily.get(key) ?? { count: 0, confirmed: 0 };
      d.count += 1;
      if (r.confirmedAt) {
        d.confirmed += 1;
        confirmed += 1;
      }
      daily.set(key, d);
    }

    const topSlugs = [...bySlug].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const names = new Map(
      (await this.prisma.product.findMany({ where: { slug: { in: topSlugs.map(([s]) => s) } }, select: { slug: true, name: true } })).map((p) => [p.slug, p.name]),
    );
    return {
      days,
      total: rows.length,
      confirmed,
      bySource: [...bySource].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      topProducts: topSlugs.map(([slug, count]) => ({ slug, name: names.get(slug) ?? slug, count })),
      daily: [...daily].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
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
