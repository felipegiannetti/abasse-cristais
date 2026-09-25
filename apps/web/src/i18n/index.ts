import type { Locale } from './config';
import { en, type Messages } from './messages/en';
import { pt } from './messages/pt';

export type { Messages };
export * from './config';

const dictionaries: Record<Locale, Messages> = { en, pt };

/** Server-side accessor (Server Components, metadata, sitemap). */
export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

const intl: Record<Locale, string> = { en: 'en-US', pt: 'pt-BR' };

/** Prices are stored in BRL cents. null = "on request". */
export function formatPrice(cents: number | null | undefined, locale: Locale, m: Messages): string {
  if (cents == null) return m.price.onRequest;
  return new Intl.NumberFormat(intl[locale], { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function plural(n: number, one: string, many: string): string {
  return (n === 1 ? one : many).replace('{n}', String(n));
}
