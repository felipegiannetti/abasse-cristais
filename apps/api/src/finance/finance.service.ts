import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ts } from '../common/sql';
import { TtlCache } from '../common/ttl-cache';
import { PrismaService } from '../prisma/prisma.service';

const COUNTED = ['PAID', 'SHIPPED', 'DELIVERED'] as const;
const DAY = 86_400_000;
const BRT = 3 * 3_600_000; // Brazil (UTC-3, no daylight saving since 2019)
const dayKey = (d: Date) => new Date(d.getTime() - BRT).toISOString().slice(0, 10);
const STATUS_LIST = Prisma.join(COUNTED);

export type SummaryRange = '7' | '30' | '90' | '365' | 'all';

interface Window {
  from: Date;
  to: Date;
}

interface MoneyGroup {
  revenueCents: number;
}

/** `GROUP BY` rows coming back from Postgres: every numeric column is cast to `::int` in the SQL itself,
 * so these are plain JS numbers, not bigint/string (which is what the driver would otherwise hand back
 * for COUNT/SUM of an integer column). */
interface ByPaymentRow extends MoneyGroup {
  method: string;
  orders: number;
}
interface ByCountryRow extends MoneyGroup {
  country: string;
  orders: number;
}
interface ByCategoryRow extends MoneyGroup {
  category: string;
}
interface ByProductRow extends MoneyGroup {
  key: string;
  name: string;
  orders: number;
  units: number;
  grams: number;
}
interface SeriesRow {
  date: string;
  orders: number;
  revenueCents: number;
}
interface ItemTotalsRow {
  units: number;
  grams: number;
  costCents: number;
  revenueWithCostCents: number;
}

/**
 * Financial dashboard numbers, computed with SQL aggregates (`SUM`/`COUNT`/`GROUP BY`) rather than
 * loading every counted sale (plus its items) and reducing them in application code. The discount on a
 * sale is spread over its items proportionally — `item.totalCents * (subtotalCents - discountCents) /
 * subtotalCents` — which Postgres computes per row in the join below exactly like the old JS loop did,
 * rounded with `ROUND(numeric)`, which (for the non-negative values here — a sale's discount can never
 * exceed its subtotal) rounds half up exactly like `Math.round`. This was verified against the previous
 * implementation on real and synthetic edge-case data (odd totals, uneven discount splits, zero-price
 * items, products renamed between sales) before replacing it — see the project's PR history.
 */
@Injectable()
export class FinanceService {
  private readonly cache = new TtlCache<SummaryRange, Awaited<ReturnType<FinanceService['computeSummary']>>>(SUMMARY_CACHE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  async summary(range: SummaryRange) {
    return this.cache.get(range, () => this.computeSummary(range));
  }

  /** Called by SalesService whenever a sale is created/changed, so the cache above never shows numbers
   * that are stale because of the admin's own just-made edit (only because of the TTL otherwise). */
  invalidate(): void {
    this.cache.clear();
  }

  // ---------- sale-level aggregates (no items involved) ----------

  private async totals({ from, to }: Window) {
    const where = { status: { in: [...COUNTED] }, soldAt: { gte: from, lt: to } };
    const [agg, salesFromClicks] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _count: { _all: true },
        _sum: { subtotalCents: true, discountCents: true, shippingCostCents: true },
      }),
      this.prisma.sale.count({ where: { ...where, clickRef: { not: null } } }),
    ]);
    return {
      orders: agg._count._all,
      revenueCents: (agg._sum.subtotalCents ?? 0) - (agg._sum.discountCents ?? 0),
      shippingCents: agg._sum.shippingCostCents ?? 0,
      salesFromClicks,
    };
  }

  private async byPayment({ from, to }: Window): Promise<ByPaymentRow[]> {
    const rows = await this.prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: { status: { in: [...COUNTED] }, soldAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { subtotalCents: true, discountCents: true },
    });
    return rows
      .map((r) => ({ method: r.paymentMethod, orders: r._count._all, revenueCents: (r._sum.subtotalCents ?? 0) - (r._sum.discountCents ?? 0) }))
      .sort((a, b) => b.revenueCents - a.revenueCents);
  }

  // shipTo is JSON (`->>'country'`), which Prisma's groupBy cannot group by directly.
  private byCountry({ from, to }: Window): Promise<ByCountryRow[]> {
    return this.prisma.$queryRaw<ByCountryRow[]>`
      SELECT COALESCE("shipTo"->>'country', '—') AS country,
             COUNT(*)::int AS orders,
             COALESCE(SUM("subtotalCents" - "discountCents"), 0)::int AS "revenueCents"
      FROM "Sale"
      WHERE status::text IN (${STATUS_LIST}) AND "soldAt" >= ${ts(from)} AND "soldAt" < ${ts(to)}
      GROUP BY 1
      ORDER BY "revenueCents" DESC
      LIMIT 8
    `;
  }

  // ---------- item-level aggregates (discount spread proportionally per sale) ----------

  private itemTotals({ from, to }: Window): Promise<ItemTotalsRow[]> {
    return this.prisma.$queryRaw<ItemTotalsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN si.mode = 'UNIT' THEN si.quantity ELSE 0 END), 0)::int AS units,
        COALESCE(SUM(CASE WHEN si.mode = 'WEIGHT' THEN si.quantity ELSE 0 END), 0)::int AS grams,
        COALESCE(SUM(CASE WHEN si."costCents" IS NULL THEN 0
          WHEN si.mode = 'WEIGHT' THEN ROUND(si."costCents"::numeric * si.quantity / 1000)
          ELSE si."costCents" * si.quantity END), 0)::int AS "costCents",
        COALESCE(SUM(CASE WHEN si."costCents" IS NULL THEN 0
          ELSE ROUND(si."totalCents" * (s."subtotalCents" - s."discountCents")::numeric / NULLIF(s."subtotalCents", 0)) END), 0)::int AS "revenueWithCostCents"
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s.status::text IN (${STATUS_LIST}) AND s."soldAt" >= ${ts(from)} AND s."soldAt" < ${ts(to)}
    `;
  }

  private byCategory({ from, to }: Window): Promise<ByCategoryRow[]> {
    return this.prisma.$queryRaw<ByCategoryRow[]>`
      SELECT si.category,
             COALESCE(SUM(ROUND(si."totalCents" * (s."subtotalCents" - s."discountCents")::numeric / NULLIF(s."subtotalCents", 0))), 0)::int AS "revenueCents"
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s.status::text IN (${STATUS_LIST}) AND s."soldAt" >= ${ts(from)} AND s."soldAt" < ${ts(to)}
      GROUP BY 1
      ORDER BY "revenueCents" DESC
      LIMIT 8
    `;
  }

  private byProduct({ from, to }: Window): Promise<ByProductRow[]> {
    // Grouped by product id when there is one (falling back to the name for sales of a since-deleted
    // product); the displayed name is the most recent one on file for that key, picked with
    // array_agg(... ORDER BY "soldAt" DESC) — a deliberate choice if a product was ever renamed between
    // sales, slightly different from (and more correct than) the old code's "whichever name the loop
    // happened to see first".
    return this.prisma.$queryRaw<ByProductRow[]>`
      SELECT
        COALESCE(si."productId", si."productName") AS key,
        (ARRAY_AGG(si."productName" ORDER BY s."soldAt" DESC))[1] AS name,
        COUNT(*)::int AS orders,
        COALESCE(SUM(CASE WHEN si.mode = 'UNIT' THEN si.quantity ELSE 0 END), 0)::int AS units,
        COALESCE(SUM(CASE WHEN si.mode = 'WEIGHT' THEN si.quantity ELSE 0 END), 0)::int AS grams,
        COALESCE(SUM(ROUND(si."totalCents" * (s."subtotalCents" - s."discountCents")::numeric / NULLIF(s."subtotalCents", 0))), 0)::int AS "revenueCents"
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s.status::text IN (${STATUS_LIST}) AND s."soldAt" >= ${ts(from)} AND s."soldAt" < ${ts(to)}
      GROUP BY 1
      ORDER BY "revenueCents" DESC
      LIMIT 8
    `;
  }

  // ---------- chart series ----------

  private async series({ from, to }: Window, perDay: boolean): Promise<Map<string, { revenueCents: number; orders: number }>> {
    const rows = perDay
      ? await this.prisma.$queryRaw<SeriesRow[]>`
          SELECT to_char("soldAt" - interval '3 hours', 'YYYY-MM-DD') AS date,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM("subtotalCents" - "discountCents"), 0)::int AS "revenueCents"
          FROM "Sale"
          WHERE status::text IN (${STATUS_LIST}) AND "soldAt" >= ${ts(from)} AND "soldAt" < ${ts(to)}
          GROUP BY 1
        `
      : await this.prisma.$queryRaw<SeriesRow[]>`
          SELECT to_char("soldAt" - interval '3 hours', 'YYYY-MM') AS date,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM("subtotalCents" - "discountCents"), 0)::int AS "revenueCents"
          FROM "Sale"
          WHERE status::text IN (${STATUS_LIST}) AND "soldAt" >= ${ts(from)} AND "soldAt" < ${ts(to)}
          GROUP BY 1
        `;
    return new Map(rows.map((r) => [r.date, { revenueCents: r.revenueCents, orders: r.orders }]));
  }

  private earliestSaleDate(): Promise<Date | null> {
    return this.prisma.sale
      .aggregate({ where: { status: { in: [...COUNTED] } }, _min: { soldAt: true } })
      .then((r) => r._min.soldAt);
  }

  // ---------- orchestration ----------

  private async computeSummary(range: SummaryRange) {
    const now = new Date();
    const days = range === 'all' ? null : Number(range);
    const from = days ? new Date(now.getTime() - days * DAY) : null;
    const window: Window = { from: from ?? new Date(0), to: now };

    // spanDays for "all" needs the earliest sale; every other range already knows its own length
    const spanDays = days ?? Math.max(1, Math.ceil((now.getTime() - ((await this.earliestSaleDate())?.getTime() ?? now.getTime())) / DAY) + 1);
    const perDay = spanDays <= 92;

    const [totals, byPayment, byCountry, itemTotals, byCategory, topProducts, seriesRows, clicks, confirmed, previous] = await Promise.all([
      this.totals(window),
      this.byPayment(window),
      this.byCountry(window),
      this.itemTotals(window),
      this.byCategory(window),
      this.byProduct(window),
      this.series(window, perDay),
      this.prisma.whatsAppClick.count({ where: { createdAt: { gte: window.from, lt: window.to } } }),
      this.prisma.whatsAppClick.count({ where: { createdAt: { gte: window.from, lt: window.to }, confirmedAt: { not: null } } }),
      days && from ? this.totals({ from: new Date(from.getTime() - days * DAY), to: from }) : Promise.resolve(null),
    ]);

    // zero-fill every day/month in range, then overlay the real (possibly sparse) SQL result on top
    const buckets = new Map<string, { revenueCents: number; orders: number }>();
    if (perDay) {
      for (let i = spanDays - 1; i >= 0; i--) buckets.set(dayKey(new Date(now.getTime() - i * DAY)), { revenueCents: 0, orders: 0 });
    }
    for (const [key, v] of seriesRows) buckets.set(key, v);

    const { units, grams, costCents, revenueWithCostCents } = itemTotals[0] ?? { units: 0, grams: 0, costCents: 0, revenueWithCostCents: 0 };
    const profitCents = revenueWithCostCents - costCents;

    return {
      range,
      perDay,
      revenueCents: totals.revenueCents,
      shippingCents: totals.shippingCents,
      orders: totals.orders,
      averageTicketCents: totals.orders ? Math.round(totals.revenueCents / totals.orders) : 0,
      units,
      grams,
      costCents,
      profitCents,
      marginPct: revenueWithCostCents > 0 ? Math.round((profitCents / revenueWithCostCents) * 1000) / 10 : null,
      // share of the revenue whose cost is registered (profit is only exact at 100%)
      costCoveragePct: totals.revenueCents > 0 ? Math.round((revenueWithCostCents / totals.revenueCents) * 100) : 100,
      previous: previous ? { revenueCents: previous.revenueCents, orders: previous.orders } : null,
      series: [...buckets].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      byCategory: byCategory.map((r) => ({ name: r.category, revenueCents: r.revenueCents })),
      topProducts: topProducts.map((r) => ({ name: r.name, revenueCents: r.revenueCents, orders: r.orders, units: r.units, grams: r.grams })),
      byCountry: byCountry.map((r) => ({ country: r.country, orders: r.orders, revenueCents: r.revenueCents })),
      byPayment: byPayment.map((r) => ({ method: r.method, orders: r.orders, revenueCents: r.revenueCents })),
      funnel: { clicks, confirmed, sales: totals.orders, salesFromClicks: totals.salesFromClicks },
    };
  }
}

// A full summary used to scan every counted sale (and items) in the range into memory; now every number
// is a SQL aggregate, so the TTL below exists only to avoid redoing several small round-trips on every
// dashboard click, not to avoid an expensive in-memory reduce. Per-instance like the rate limiter: a
// correctness no-op in a single Node process, and merely a shorter-lived cache under multiple serverless
// instances — never stale data a real admin would notice, since it expires in well under a minute.
const SUMMARY_CACHE_TTL_MS = 30_000;
