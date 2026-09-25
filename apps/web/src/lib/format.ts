import type { Locale } from '@/i18n/config';

/** "159,90" | "1.599,90" | "159.90" | "1,599.90" → 15990 (cents). Empty/invalid → null. */
export function parsePriceToCents(input: string): number | null {
  let s = input.trim().replace(/[^\d,.]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // both present: whichever comes last is the decimal separator
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Cents → editable text using the locale's decimal separator. */
export function centsToInput(cents: number | null | undefined, locale: Locale): string {
  if (cents == null) return '';
  const s = (cents / 100).toFixed(2);
  return locale === 'pt' ? s.replace('.', ',') : s;
}
