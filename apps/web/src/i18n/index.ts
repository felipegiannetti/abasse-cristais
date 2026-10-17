import type { FxInfo } from '@/lib/types';
import type { Locale } from './config';
import { adminMessages } from './messages/admin';
import { en } from './messages/en';
import type { PublicMessages } from './messages/en';
import { es } from './messages/es';
import { pt } from './messages/pt';
import type { Messages } from './messages/types';

export type { Messages, PublicMessages };
export * from './config';

const publicDictionaries: Record<Locale, PublicMessages> = { en, pt, es };

/** Every text, including the (Portuguese-only) admin ones. Server-side use and the admin area. */
export function getMessages(locale: Locale): Messages {
  return { ...publicDictionaries[locale], ...adminMessages };
}

/**
 * Only the texts the public site needs (the admin strings would just be extra bytes for visitors).
 * Typed as Messages for convenience: the admin components are only ever rendered under the admin layout,
 * which provides the full set.
 */
export function getPublicMessages(locale: Locale): Messages {
  return publicDictionaries[locale] as Messages;
}

const intl: Record<Locale, string> = { en: 'en-US', pt: 'pt-BR', es: 'es-ES' };

/**
 * Prices are stored in US DOLLAR cents. The Portuguese site shows reais (dollars × `fx.rate`); every other
 * language, the admin panel, and the Portuguese site when no rate is available show dollars.
 * null = "on request". `mode` WEIGHT means the price is per kilogram.
 */
export function formatPrice(
  cents: number | null | undefined,
  locale: Locale,
  m: Messages,
  mode: 'UNIT' | 'WEIGHT' = 'UNIT',
  fx: Pick<FxInfo, 'rate'> | null = null,
): string {
  if (cents == null) return m.price.onRequest;
  const inReais = locale === 'pt' && fx !== null;
  const amount = inReais
    ? new Intl.NumberFormat(intl.pt, { style: 'currency', currency: 'BRL' }).format(Math.round(cents * fx.rate) / 100)
    : new Intl.NumberFormat(intl[locale], { style: 'currency', currency: 'USD' }).format(cents / 100);
  return mode === 'WEIGHT' ? `${amount} ${m.price.perKg}` : amount;
}

/** "Valores em dólar convertidos para reais pela cotação oficial do Banco Central de 16/10: US$ 1 = R$ 5,08." */
export function fxNote(fx: FxInfo, m: Messages): string {
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(fx.asOf));
  const rate = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(fx.rate);
  return m.price.fxNote.replace('{source}', m.price.fxSource[fx.source]).replace('{date}', date).replace('{rate}', rate);
}

export function plural(n: number, one: string, many: string): string {
  return (n === 1 ? one : many).replace('{n}', String(n));
}
