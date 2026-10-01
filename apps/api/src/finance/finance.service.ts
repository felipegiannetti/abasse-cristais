import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const COUNTED = ['PAID', 'SHIPPED', 'DELIVERED'] as const;
const DAY = 86_400_000;
const BRT = 3 * 3_600_000; // Brazil (UTC-3, no daylight saving since 2019)
const dayKey = (d: Date) => new Date(d.getTime() - BRT).toISOString().slice(0, 10);
const monthKey = (d: Date) => dayKey(d).slice(0, 7);

export type SummaryRange = '7' | '30' | '90' | '365' | 'all';

interface Totals {
  revenueCents: number;
  shippingCents: number;
  orders: number;
  units: number;
  grams: number;
  costCents: number;
  revenueWithCostCents: number;
}

interface SaleRow {
  soldAt: Date;
  subtotalCents: number;
  discountCents: number;
  shippingCostCents: number;
  paymentMethod: string;
  shipTo: unknown;
  clickRef: string | null;
  items: {
    productId: string | null;
    productName: string;
    category: string;
    mode: string;
    quantity: number;
    costCents: number | null;
    totalCents: number;
  }[];
}

/** Money math for a set of sales. Discounts are spread over the items of each sale proportionally. */
export function aggregate(sales: SaleRow[]) {
  const t: Totals = { revenueCents: 0, shippingCents: 0, orders: sales.length, units: 0, grams: 0, costCents: 0, revenueWithCostCents: 0 };
  const byCategory = new Map<string, { revenueCents: number }>();
  const byProduct = new Map<string, { name: string; revenueCents: number; orders: number; units: number; grams: number }>();
  const byCountry = new Map<string, { orders: number; revenueCents: number }>();
  const byPayment = new Map<string, { orders: number; revenueCents: number }>();

  for (const s of sales) {
    const net = s.subtotalCents - s.discountCents;
    const factor = s.subtotalCents > 0 ? net / s.subtotalCents : 0;
    t.revenueCents += net;
    t.shippingCents += s.shippingCostCents;

    const country = (s.shipTo as { country?: string } | null)?.country ?? '—';
    const c = byCountry.get(country) ?? { orders: 0, revenueCents: 0 };
    c.orders += 1;
    c.revenueCents += net;
    byCountry.set(country, c);

    const pay = byPayment.get(s.paymentMethod) ?? { orders: 0, revenueCents: 0 };
    pay.orders += 1;
    pay.revenueCents += net;
    byPayment.set(s.paymentMethod, pay);

    for (const it of s.items) {
      const rev = Math.round(it.totalCents * factor);
      if (it.mode === 'WEIGHT') t.grams += it.quantity;
      else t.units += it.quantity;
      if (it.costCents != null) {
        const cost = it.mode === 'WEIGHT' ? Math.round((it.costCents * it.quantity) / 1000) : it.costCents * it.quantity;
        t.costCents += cost;
        t.revenueWithCostCents += rev;
      }
      const cat = byCategory.get(it.category) ?? { revenueCents: 0 };
      cat.revenueCents += rev;
      byCategory.set(it.category, cat);
      const key = it.productId ?? it.productName;
      const p = byProduct.get(key) ?? { name: it.productName, revenueCents: 0, orders: 0, units: 0, grams: 0 };
      p.revenueCents += rev;
      p.orders += 1;
      if (it.mode === 'WEIGHT') p.grams += it.quantity;
      else p.units += it.quantity;
      byProduct.set(key, p);
    }
  }
  return { t, byCategory, byProduct, byCountry, byPayment };
}

// A full summary scans every counted sale in the range (and, for the growth comparison, the previous
// period too) and reduces it in application code. Cheap at this shop's current volume, but the admin
// commonly reopens/switches the Financeiro tab within seconds — a short per-instance cache avoids
// redoing that scan for the exact same range on every click. (Per-instance like the rate limiter: a
// correctness no-op in a single Node process, and merely a shorter-lived cache under multiple serverless
// instances — never stale data a real admin would notice, since it expires in well under a minute.)
const SUMMARY_CACHE_TTL_MS = 30_000;

/** Financial dashboard numbers. */
@Injectable()
export class FinanceService {
  private readonly cache = new Map<SummaryRange, { at: number; data: Awaited<ReturnType<FinanceService['computeSummary']>> }>();

  constructor(private readonly prisma: PrismaService) {}

  async summary(range: SummaryRange) {
    const cached = this.cache.get(range);
    if (cached && Date.now() - cached.at < SUMMARY_CACHE_TTL_MS) return cached.data;
    const data = await this.computeSummary(range);
    this.cache.set(range, { at: Date.now(), data });
    return data;
  }

  /** Called by SalesService whenever a sale is created/changed, so the cache above never shows numbers
   * that are stale because of the admin's own just-made edit (only because of the TTL otherwise). */
  invalidate(): void {
    this.cache.clear();
  }

  private load(from: Date | null, to: Date) {
    return this.prisma.sale.findMany({
      where: { status: { in: [...COUNTED] }, soldAt: { ...(from ? { gte: from } : {}), lt: to } },
      select: {
        soldAt: true,
        subtotalCents: true,
        discountCents: true,
        shippingCostCents: true,
        paymentMethod: true,
        shipTo: true,
        clickRef: true,
        items: { select: { productId: true, productName: true, category: true, mode: true, quantity: true, costCents: true, totalCents: true } },
      },
      orderBy: { soldAt: 'asc' },
      take: 20_000,
    });
  }

  private async computeSummary(range: SummaryRange) {
    const now = new Date();
    const days = range === 'all' ? null : Number(range);
    const from = days ? new Date(now.getTime() - days * DAY) : null;

    const sales = await this.load(from, now);
    const cur = aggregate(sales);

    // previous period of the same length, to show growth
    let previous: { revenueCents: number; orders: number } | null = null;
    if (days && from) {
      const prev = aggregate(await this.load(new Date(from.getTime() - days * DAY), from));
      previous = { revenueCents: prev.t.revenueCents, orders: prev.t.orders };
    }

    // chart series: per day up to 92 days, per month beyond that (or for "all")
    const spanDays = days ?? Math.max(1, Math.ceil((now.getTime() - (sales[0]?.soldAt.getTime() ?? now.getTime())) / DAY) + 1);
    const perDay = spanDays <= 92;
    const buckets = new Map<string, { revenueCents: number; orders: number }>();
    if (perDay) {
      for (let i = spanDays - 1; i >= 0; i--) buckets.set(dayKey(new Date(now.getTime() - i * DAY)), { revenueCents: 0, orders: 0 });
    }
    for (const s of sales) {
      const key = perDay ? dayKey(s.soldAt) : monthKey(s.soldAt);
      const b = buckets.get(key) ?? { revenueCents: 0, orders: 0 };
      b.revenueCents += s.subtotalCents - s.discountCents;
      b.orders += 1;
      buckets.set(key, b);
    }

    // funnel: WhatsApp clicks → conversations confirmed → sales
    const clickWhere = { createdAt: { ...(from ? { gte: from } : {}), lt: now } };
    const [clicks, confirmed] = await Promise.all([
      this.prisma.whatsAppClick.count({ where: clickWhere }),
      this.prisma.whatsAppClick.count({ where: { ...clickWhere, confirmedAt: { not: null } } }),
    ]);

    const { t } = cur;
    const profitCents = t.revenueWithCostCents - t.costCents;
    return {
      range,
      perDay,
      revenueCents: t.revenueCents,
      shippingCents: t.shippingCents,
      orders: t.orders,
      averageTicketCents: t.orders ? Math.round(t.revenueCents / t.orders) : 0,
      units: t.units,
      grams: t.grams,
      costCents: t.costCents,
      profitCents,
      marginPct: t.revenueWithCostCents > 0 ? Math.round((profitCents / t.revenueWithCostCents) * 1000) / 10 : null,
      // share of the revenue whose cost is registered (profit is only exact at 100%)
      costCoveragePct: t.revenueCents > 0 ? Math.round((t.revenueWithCostCents / t.revenueCents) * 100) : 100,
      previous,
      series: [...buckets].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      byCategory: [...cur.byCategory].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
      topProducts: [...cur.byProduct.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
      byCountry: [...cur.byCountry].map(([country, v]) => ({ country, ...v })).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 8),
      byPayment: [...cur.byPayment].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.revenueCents - a.revenueCents),
      funnel: { clicks, confirmed, sales: t.orders, salesFromClicks: sales.filter((s) => s.clickRef).length },
    };
  }
}
