/**
 * USD→BRL quote sources. Pure parsing/validation lives here (unit-tested); the network calls are thin
 * wrappers around it. Order of preference (see FxService): the Banco Central's PTAX, then AwesomeAPI.
 */
export type FxSourceName = 'BCB_PTAX' | 'AWESOMEAPI';

export interface FxQuote {
  /** reais per 1 US dollar */
  rate: number;
  source: FxSourceName;
  /** when the source says the quote was set */
  referenceAt: Date;
  /** the source's own previous reading, when it gives one (drives the up/down arrow) */
  previousRate?: number;
}

const FETCH_TIMEOUT_MS = 6_000;
const BRT_OFFSET_MS = 3 * 3_600_000; // Brazil is UTC-3 all year (no daylight saving since 2019)

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Does a quote look like a real USD/BRL rate, and not a wild jump from the previous one? */
export function isPlausible(rate: number, previous?: number | null): boolean {
  if (!Number.isFinite(rate) || rate < 1 || rate > 20) return false;
  // a >15% move between two consecutive refreshes is almost certainly a bad reading, not the market
  if (previous && Number.isFinite(previous) && Math.abs(rate / previous - 1) > 0.15) return false;
  return true;
}

/** "2026-10-16 13:04:14.548156" (Brasília time) → the matching instant. */
export function parseBrtTimestamp(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s) + BRT_OFFSET_MS);
}

/** Olinda `CotacaoDolarPeriodo` response, newest first: uses the selling rate (`cotacaoVenda`) of the first row. */
export function parsePtax(json: unknown): FxQuote | null {
  if (!isRecord(json) || !Array.isArray(json.value)) return null;
  const row: unknown = json.value[0];
  if (!isRecord(row)) return null;
  const rate = Number(row.cotacaoVenda);
  const referenceAt = typeof row.dataHoraCotacao === 'string' ? parseBrtTimestamp(row.dataHoraCotacao) : null;
  if (!Number.isFinite(rate) || !referenceAt) return null;
  // the next older bulletin whose rate differs from the newest one
  const older = json.value
    .slice(1)
    .map((r: unknown) => (isRecord(r) ? Number(r.cotacaoVenda) : NaN))
    .find((v) => Number.isFinite(v) && v !== rate);
  return { rate, source: 'BCB_PTAX', referenceAt, ...(older !== undefined ? { previousRate: older } : {}) };
}

/** AwesomeAPI `/json/last/USD-BRL` response: uses the asking price (`ask`) and the epoch `timestamp`. */
export function parseAwesome(json: unknown): FxQuote | null {
  if (!isRecord(json) || !isRecord(json.USDBRL)) return null;
  const q = json.USDBRL;
  const rate = Number(q.ask);
  const seconds = Number(q.timestamp);
  if (!Number.isFinite(rate) || !Number.isFinite(seconds) || seconds <= 0) return null;
  // pctChange is the move since the previous close, in percent: previous = rate / (1 + pct/100)
  const pct = Number(q.pctChange);
  const previousRate = Number.isFinite(pct) && pct !== 0 && Math.abs(pct) < 50 ? Math.round((rate / (1 + pct / 100)) * 1e6) / 1e6 : undefined;
  return { rate, source: 'AWESOMEAPI', referenceAt: new Date(seconds * 1000), ...(previousRate !== undefined ? { previousRate } : {}) };
}

const mmddyyyy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Banco Central do Brasil, PTAX (official). Looks at the last 10 days so weekends/holidays still return the latest bulletin. */
export async function fetchPtax(now = new Date()): Promise<FxQuote | null> {
  const from = new Date(now.getTime() - 10 * 86_400_000);
  const url =
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)' +
    `?@dataInicial='${mmddyyyy(from)}'&@dataFinalCotacao='${mmddyyyy(now)}'&$top=10&$orderby=dataHoraCotacao%20desc&$format=json`;
  return parsePtax(await getJson(url));
}

/** AwesomeAPI (market quote), the automatic fallback. */
export async function fetchAwesome(): Promise<FxQuote | null> {
  return parseAwesome(await getJson('https://economia.awesomeapi.com.br/json/last/USD-BRL'));
}
