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

/** Prices are stored in BRL cents. null = "on request". `mode` WEIGHT means the price is per kilogram. */
export function formatPrice(
  cents: number | null | undefined,
  locale: Locale,
  m: Messages,
  mode: 'UNIT' | 'WEIGHT' = 'UNIT',
): string {
  if (cents == null) return m.price.onRequest;
  const amount = new Intl.NumberFormat(intl[locale], { style: 'currency', currency: 'BRL' }).format(cents / 100);
  return mode === 'WEIGHT' ? `${amount} ${m.price.perKg}` : amount;
}

export function plural(n: number, one: string, many: string): string {
  return (n === 1 ? one : many).replace('{n}', String(n));
}
