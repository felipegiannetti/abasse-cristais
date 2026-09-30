import { site } from '@/content/site';
import type { CategoryCount, Product, ProductList } from './types';

// Leitura pública feita no servidor (Server Components), com cache por tag.
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const PRODUCTS_TAG = 'products';
export const SETTINGS_TAG = 'settings';

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

export function fetchProducts(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const suffix = qs.size ? `?${qs}` : '';
  return get<ProductList>(`/products${suffix}`, emptyList);
}

export function fetchCategories() {
  return get<CategoryCount[]>('/products/categories', []);
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60, tags: [PRODUCTS_TAG] },
    });
    return res.ok ? ((await res.json()) as Product) : null;
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
}

/**
 * Contact channels every button on the site uses. Edited by the admins (Settings page) and stored in
 * the database; the WhatsApp env variable is only a fallback for when nothing has been configured yet.
 */
export async function fetchContact(): Promise<ContactSettings> {
  const fallback: ContactSettings = { whatsapp: site.whatsapp, sms: '', email: '' };
  try {
    const res = await fetch(`${API_URL}/settings/public`, { next: { revalidate: 60, tags: [SETTINGS_TAG] } });
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<ContactSettings>;
    return {
      whatsapp: /^\d{10,15}$/.test(data.whatsapp ?? '') ? (data.whatsapp as string) : fallback.whatsapp,
      sms: /^\d{10,15}$/.test(data.sms ?? '') ? (data.sms as string) : '',
      email: typeof data.email === 'string' ? data.email : '',
    };
  } catch {
    return fallback;
  }
}
