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
  return locale === 'en' ? s : s.replace('.', ',');
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** Money in the admin: always R$ and Brazilian formatting. */
export const brl = (cents: number) => BRL.format(cents / 100);

/** 1500 → "1,5 kg"; 350 → "350 g". */
export function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${grams} g`;
}

/** "0,5" | "1.25" → 500 / 1250 grams. Empty or invalid → null. */
export function kgToGrams(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

export const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Transferência bancária',
  WISE: 'Wise',
  STRIPE: 'Stripe',
  CASH: 'Dinheiro',
  OTHER: 'Outro',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const SOURCE_LABELS: Record<string, string> = {
  MENU: 'Menu do site',
  FLOATING: 'Botão flutuante',
  FOOTER: 'Rodapé',
  HERO: 'Início (destaque)',
  HOME_CTA: 'Início (chamada final)',
  CATALOG: 'Coleção',
  PRODUCT_CARD: 'Cartão de produto',
  PRODUCT_PAGE: 'Página do produto',
};
