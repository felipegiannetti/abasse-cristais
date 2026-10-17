import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fetchAwesome, fetchPtax, isPlausible, type FxQuote, type FxSourceName } from './fx.sources';

/** Refresh the stored quote when it is older than this (the PTAX itself only moves a few times a day). */
export const REFRESH_AFTER_MS = 60 * 60_000;
/** Past this age the quote is flagged `stale` so the UI can say so (e.g. both sources down over a long outage). */
export const STALE_AFTER_MS = 48 * 3_600_000;
const MEMORY_MS = 60_000;

export interface FxRate {
  base: 'USD';
  quote: 'BRL';
  /** reais per 1 US dollar */
  rate: number;
  source: FxSourceName;
  /** when the source set this quote */
  asOf: Date;
  /** when we stored it */
  fetchedAt: Date;
  stale: boolean;
  /** the last stored rate that differed from this one (null = none yet); drives the up/down arrow */
  previousRate: number | null;
}

type Fetcher = () => Promise<FxQuote | null>;

/**
 * The USD→BRL rate every price in reais is derived from. Official source first (Banco Central PTAX), the
 * market quote (AwesomeAPI) when the BC is unreachable or answers nonsense. Every refresh is stored, so the
 * last known rate survives any outage; it is refreshed lazily, at most once an hour.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private memory: { at: number; value: FxRate | null } | null = null;
  private inflight: Promise<void> | null = null;

  /** In order of preference; a property (not a constructor argument) so tests can swap them. */
  sources: Fetcher[] = [fetchPtax, fetchAwesome];

  constructor(private readonly prisma: PrismaService) {}

  /** The current rate, refreshing it first when it is missing or older than an hour. null = never fetched. */
  async current(): Promise<FxRate | null> {
    let latest = await this.latest();
    if (!latest || Date.now() - latest.fetchedAt.getTime() > REFRESH_AFTER_MS) {
      await this.refresh();
      latest = await this.latest(true);
    }
    return latest;
  }

  /** Fetches a new quote (single-flight) and stores it. Never throws: on failure the stored rate stays. */
  refresh(): Promise<void> {
    this.inflight ??= this.doRefresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(): Promise<void> {
    const previous = await this.latest(true);
    for (const fetchQuote of this.sources) {
      try {
        const quote = await fetchQuote();
        if (!quote) continue;
        if (!isPlausible(quote.rate, previous?.rate)) {
          this.logger.warn(`discarded implausible ${quote.source} quote ${quote.rate} (previous ${previous?.rate ?? 'none'})`);
          continue;
        }
        await this.prisma.exchangeRate.create({ data: { rate: quote.rate, source: quote.source, referenceAt: quote.referenceAt } });
        this.memory = null;
        return;
      } catch (e) {
        this.logger.warn(`quote source failed: ${(e as Error).message}`);
      }
    }
    this.logger.warn('no exchange-rate source answered; keeping the last stored rate');
  }

  private async latest(fresh = false): Promise<FxRate | null> {
    if (!fresh && this.memory && Date.now() - this.memory.at < MEMORY_MS) return this.memory.value;
    const row = await this.prisma.exchangeRate.findFirst({ where: { base: 'USD', quote: 'BRL' }, orderBy: { fetchedAt: 'desc' } });
    const before = row
      ? await this.prisma.exchangeRate.findFirst({ where: { base: 'USD', quote: 'BRL', rate: { not: row.rate } }, orderBy: { fetchedAt: 'desc' }, select: { rate: true } })
      : null;
    const value: FxRate | null = row
      ? {
          base: 'USD',
          quote: 'BRL',
          rate: Number(row.rate),
          source: row.source as FxSourceName,
          asOf: row.referenceAt,
          fetchedAt: row.fetchedAt,
          stale: Date.now() - row.fetchedAt.getTime() > STALE_AFTER_MS,
          previousRate: before ? Number(before.rate) : null,
        }
      : null;
    this.memory = { at: Date.now(), value };
    return value;
  }
}
