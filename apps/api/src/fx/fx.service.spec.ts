import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { FxService } from './fx.service';
import type { FxQuote } from './fx.sources';

interface Row {
  rate: number;
  source: string;
  referenceAt: Date;
  fetchedAt: Date;
}

/** A tiny in-memory stand-in for the one Prisma delegate the service uses. */
function fakePrisma(initial: Row[] = []) {
  const rows = [...initial];
  const exchangeRate = {
    // honours the one filter the service uses besides base/quote: `rate: { not }` (the previous, different rate)
    findFirst: vi.fn((args?: { where?: { rate?: { not?: unknown } } }) => {
      const not = args?.where?.rate?.not === undefined ? null : Number(args.where.rate.not);
      return Promise.resolve([...rows].filter((r) => not === null || r.rate !== not).sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0] ?? null);
    }),
    create: vi.fn(({ data }: { data: { rate: number; source: string; referenceAt: Date } }) => {
      rows.push({ ...data, fetchedAt: new Date() });
      return Promise.resolve();
    }),
  };
  return { prisma: { exchangeRate } as unknown as PrismaService, rows };
}

const ptax = (rate: number): FxQuote => ({ rate, source: 'BCB_PTAX', referenceAt: new Date('2026-10-16T16:04:00Z') });
const market = (rate: number): FxQuote => ({ rate, source: 'AWESOMEAPI', referenceAt: new Date('2026-10-16T21:01:00Z') });

describe('FxService', () => {
  it('fetches and stores the official quote when nothing is stored yet', async () => {
    const { prisma, rows } = fakePrisma();
    const svc = new FxService(prisma);
    svc.sources = [() => Promise.resolve(ptax(5.0826)), () => Promise.resolve(market(5.06))];

    const r = await svc.current();
    expect(r?.rate).toBe(5.0826);
    expect(r?.source).toBe('BCB_PTAX');
    expect(rows).toHaveLength(1);
  });

  it('falls back to the market quote when the official source throws', async () => {
    const { prisma } = fakePrisma();
    const svc = new FxService(prisma);
    svc.sources = [() => Promise.reject(new Error('BC out')), () => Promise.resolve(market(5.0631))];

    const r = await svc.current();
    expect(r?.source).toBe('AWESOMEAPI');
    expect(r?.rate).toBe(5.0631);
  });

  it('falls back when the official source answers nonsense (implausible jump)', async () => {
    const { prisma } = fakePrisma([{ rate: 5.08, source: 'BCB_PTAX', referenceAt: new Date(), fetchedAt: new Date(Date.now() - 2 * 3_600_000) }]);
    const svc = new FxService(prisma);
    svc.sources = [() => Promise.resolve(ptax(9.9)), () => Promise.resolve(market(5.09))];

    const r = await svc.current();
    expect(r?.source).toBe('AWESOMEAPI');
    expect(r?.rate).toBe(5.09);
  });

  it('keeps serving the last stored rate when every source is down', async () => {
    const old = new Date(Date.now() - 3 * 3_600_000);
    const { prisma, rows } = fakePrisma([{ rate: 5.08, source: 'BCB_PTAX', referenceAt: old, fetchedAt: old }]);
    const svc = new FxService(prisma);
    svc.sources = [() => Promise.reject(new Error('down')), () => Promise.resolve(null)];

    const r = await svc.current();
    expect(r?.rate).toBe(5.08);
    expect(r?.stale).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('flags the rate as stale after 48 hours without a refresh', async () => {
    const old = new Date(Date.now() - 49 * 3_600_000);
    const { prisma } = fakePrisma([{ rate: 5.08, source: 'BCB_PTAX', referenceAt: old, fetchedAt: old }]);
    const svc = new FxService(prisma);
    svc.sources = [() => Promise.resolve(null), () => Promise.resolve(null)];

    expect((await svc.current())?.stale).toBe(true);
  });

  it('returns null when nothing was ever fetched and nothing answers', async () => {
    const { prisma } = fakePrisma();
    const svc = new FxService(prisma);
    svc.sources = [() => Promise.resolve(null), () => Promise.reject(new Error('down'))];

    expect(await svc.current()).toBeNull();
  });

  it('does not refetch while the stored rate is fresh', async () => {
    const { prisma } = fakePrisma([{ rate: 5.08, source: 'BCB_PTAX', referenceAt: new Date(), fetchedAt: new Date() }]);
    const svc = new FxService(prisma);
    const source = vi.fn(() => Promise.resolve(ptax(5.5)));
    svc.sources = [source];

    expect((await svc.current())?.rate).toBe(5.08);
    expect(source).not.toHaveBeenCalled();
  });

  it('reports the previous different rate (for the up/down arrow)', async () => {
    const t = (h: number) => new Date(Date.now() - h * 3_600_000);
    const { prisma } = fakePrisma([
      { rate: 5.0, source: 'BCB_PTAX', referenceAt: t(5), fetchedAt: t(5) },
      { rate: 5.1, source: 'BCB_PTAX', referenceAt: t(3), fetchedAt: t(3) },
      { rate: 5.1, source: 'BCB_PTAX', referenceAt: t(0.1), fetchedAt: t(0.1) }, // same value refreshed
    ]);
    const svc = new FxService(prisma);
    svc.sources = [];
    const r = await svc.current();
    expect(r?.rate).toBe(5.1);
    expect(r?.previousRate).toBe(5.0);
  });

  it('has no previous rate when every stored reading is the same value', async () => {
    const { prisma } = fakePrisma([{ rate: 5.1, source: 'BCB_PTAX', referenceAt: new Date(), fetchedAt: new Date() }]);
    const svc = new FxService(prisma);
    svc.sources = [];
    expect((await svc.current())?.previousRate).toBeNull();
  });

  it('shares one refresh between concurrent callers (single-flight)', async () => {
    const { prisma } = fakePrisma();
    const svc = new FxService(prisma);
    const source = vi.fn(() => new Promise<FxQuote>((resolve) => setTimeout(() => resolve(ptax(5.1)), 20)));
    svc.sources = [source];

    await Promise.all([svc.current(), svc.current(), svc.current()]);
    expect(source).toHaveBeenCalledTimes(1);
  });
});
