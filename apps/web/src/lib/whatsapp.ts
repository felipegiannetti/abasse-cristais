import { site } from '@/content/site';
import { fmt, localePath, type Locale } from '@/i18n/config';
import { formatPrice, type Messages } from '@/i18n';
import type { Product } from './types';

export function whatsappUrl(message: string): string {
  const text = encodeURIComponent(message);
  return site.whatsapp ? `https://wa.me/${site.whatsapp}?text=${text}` : `https://wa.me/?text=${text}`;
}

export const generalMessage = (m: Messages) => fmt(m.whatsapp.general, { brand: site.name });

export function productMessage(
  p: Pick<Product, 'name' | 'slug' | 'priceCents'>,
  locale: Locale,
  m: Messages,
): string {
  return fmt(m.whatsapp.product, {
    brand: site.name,
    name: p.name,
    price: formatPrice(p.priceCents, locale, m),
    url: `${site.url}${localePath(locale, `/products/${p.slug}`)}`,
  });
}
