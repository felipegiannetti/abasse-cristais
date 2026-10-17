import { site } from '@/content/site';
import { fmt, localePath, type Locale } from '@/i18n/config';
import { formatPrice, type Messages } from '@/i18n';
import type { FxInfo, Product } from './types';

/** wa.me link to `number` (digits with country code; comes from the admin settings, env as fallback). */
export function whatsappUrl(message: string, number?: string): string {
  const text = encodeURIComponent(message);
  const to = (number || site.whatsapp || '').replace(/\D/g, '');
  return to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`;
}

export const generalMessage = (m: Messages) => fmt(m.whatsapp.general, { brand: site.name });

export function productMessage(
  p: Pick<Product, 'name' | 'slug' | 'priceCents' | 'saleMode'>,
  locale: Locale,
  m: Messages,
  fx: Pick<FxInfo, 'rate'> | null = null,
): string {
  return fmt(m.whatsapp.product, {
    brand: site.name,
    name: p.name,
    price: formatPrice(p.priceCents, locale, m, p.saleMode, fx),
    url: `${site.url}${localePath(locale, `/products/${p.slug}`)}`,
  });
}
