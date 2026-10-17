import { site } from '@/content/site';
import { getMessages, type Locale, type Messages } from '@/i18n';
import { applyTemplateOverrides, type TemplatesMap } from '@/i18n/templates';
import type { CategoryCount, FxInfo, Product, ProductList } from './types';

// Leitura pública feita no servidor (Server Components), com cache por tag.
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const PRODUCTS_TAG = 'products';
export const SETTINGS_TAG = 'settings';
export const FX_TAG = 'fx';

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60, tags: [PRODUCTS_TAG] } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    // API fora do ar (ou no build): o site continua abrindo, só sem produtos.
    return fallback;
  }
}

const emptyList: ProductList = { items: [], total: 0, page: 1, pageSize: 24 };

/** `locale`: ask for the product texts in that language (the original wherever there is no translation). */
export function fetchProducts(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const suffix = qs.size ? `?${qs}` : '';
  return get<ProductList>(`/products${suffix}`, emptyList);
}

export function fetchCategories(locale?: string) {
  return get<CategoryCount[]>(`/products/categories${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`, []);
}

export async function fetchProduct(slug: string, locale?: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`, {
      next: { revalidate: 60, tags: [PRODUCTS_TAG] },
    });
    return res.ok ? ((await res.json()) as Product) : null;
  } catch {
    return null;
  }
}

/**
 * The USD→BRL rate for the Portuguese site (prices are stored in dollars). Cached for an hour here; the API
 * itself refreshes from the Banco Central (PTAX) with AwesomeAPI as the fallback. null = no rate available,
 * in which case prices simply stay in dollars.
 */
export async function fetchFx(): Promise<FxInfo | null> {
  try {
    const res = await fetch(`${API_URL}/fx/usd-brl`, { next: { revalidate: 3600, tags: [FX_TAG] } });
    if (!res.ok) return null;
    const d = (await res.json()) as Partial<FxInfo>;
    const sources = ['BCB_PTAX', 'AWESOMEAPI'];
    if (typeof d.rate !== 'number' || !(d.rate > 1 && d.rate < 20) || typeof d.asOf !== 'string' || !sources.includes(d.source ?? '')) return null;
    const previousRate = typeof d.previousRate === 'number' && d.previousRate > 1 && d.previousRate < 20 ? d.previousRate : null;
    return { rate: d.rate, asOf: d.asOf, source: d.source as FxInfo['source'], stale: d.stale === true, previousRate };
  } catch {
    return null;
  }
}

export interface ContactSettings {
  /** digits with country code; empty = fall back to the env default */
  whatsapp: string;
  /** digits with country code; empty = the SMS button is hidden */
  sms: string;
  /** empty = the Email button is hidden */
  email: string;
  /** admin-customized WhatsApp/SMS/email message text, sparse (only what was actually edited) */
  templates: TemplatesMap;
}

/**
 * Contact channels every button on the site uses. Edited by the admins (Settings page) and stored in
 * the database; the WhatsApp env variable is only a fallback for when nothing has been configured yet.
 */
export async function fetchContact(): Promise<ContactSettings> {
  const fallback: ContactSettings = { whatsapp: site.whatsapp, sms: '', email: '', templates: {} };
  try {
    const res = await fetch(`${API_URL}/settings/public`, { next: { revalidate: 60, tags: [SETTINGS_TAG] } });
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<ContactSettings>;
    return {
      whatsapp: /^\d{10,15}$/.test(data.whatsapp ?? '') ? (data.whatsapp as string) : fallback.whatsapp,
      sms: /^\d{10,15}$/.test(data.sms ?? '') ? (data.sms as string) : '',
      email: typeof data.email === 'string' ? data.email : '',
      templates: data.templates && typeof data.templates === 'object' ? data.templates : {},
    };
  } catch {
    return fallback;
  }
}

/**
 * `getMessages(locale)` with the admin's customized WhatsApp/SMS/email text merged in. Server
 * Components that build a WhatsApp/SMS/email message string themselves (rather than through a client
 * component reading useI18n()) should call this instead of `getMessages`, so a customization made in
 * Settings shows up there too. Everything outside the whatsapp/sms/email sections is unaffected.
 */
export async function fetchMessages(locale: Locale): Promise<Messages> {
  const contact = await fetchContact();
  return applyTemplateOverrides(getMessages(locale), contact.templates[locale]);
}
