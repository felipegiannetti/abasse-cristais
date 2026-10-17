import { site } from '@/content/site';
import { fmt, localePath, type Locale } from '@/i18n/config';
import { formatPrice, type Messages } from '@/i18n';
import type { FxInfo, Product } from './types';

/**
 * `sms:` URI. Body separator differs by platform (iOS wants "&", Android wants "?"); "?&body="
 * is the widely-used compromise that both current iOS and Android accept.
 */
export function smsUrl(phone: string, body: string): string {
  return `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(body)}`;
}

export function emailUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const generalSms = (m: Messages) => fmt(m.sms.general, { brand: site.name });

export function productSms(
  p: Pick<Product, 'name' | 'slug' | 'priceCents' | 'saleMode'>,
  locale: Locale,
  m: Messages,
  fx: Pick<FxInfo, 'rate'> | null = null,
): string {
  return fmt(m.sms.product, {
    brand: site.name,
    name: p.name,
    price: formatPrice(p.priceCents, locale, m, p.saleMode, fx),
    url: `${site.url}${localePath(locale, `/products/${p.slug}`)}`,
  });
}

export const generalEmailSubject = (m: Messages) => fmt(m.email.subjectGeneral, { brand: site.name });
export const generalEmailBody = (m: Messages) => fmt(m.email.general, { brand: site.name });

export function productEmailSubject(p: Pick<Product, 'name'>, m: Messages): string {
  return fmt(m.email.subjectProduct, { name: p.name });
}

export function productEmailBody(
  p: Pick<Product, 'name' | 'slug' | 'priceCents' | 'saleMode'>,
  locale: Locale,
  m: Messages,
  fx: Pick<FxInfo, 'rate'> | null = null,
): string {
  return fmt(m.email.product, {
    brand: site.name,
    name: p.name,
    price: formatPrice(p.priceCents, locale, m, p.saleMode, fx),
    url: `${site.url}${localePath(locale, `/products/${p.slug}`)}`,
  });
}
