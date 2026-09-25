import type { MetadataRoute } from 'next';
import { site } from '@/content/site';
import { localePath, locales } from '@/i18n/config';
import { fetchProducts } from '@/lib/api';

export const revalidate = 3600;

const hreflang = { en: 'en', pt: 'pt-BR', es: 'es' } as const;

// Every page is listed once per language, each entry pointing to its translations (hreflang).
function entries(path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [hreflang[l], `${site.url}${localePath(l, path)}`]));
  return locales.map((l) => ({ url: `${site.url}${localePath(l, path)}`, alternates: { languages }, ...extra }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await fetchProducts({ pageSize: 100 });
  return [
    ...entries('/', { changeFrequency: 'weekly', priority: 1 }),
    ...entries('/products', { changeFrequency: 'daily', priority: 0.9 }),
    ...items.flatMap((p) => entries(`/products/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.7 })),
  ];
}
