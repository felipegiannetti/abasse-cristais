import type { MetadataRoute } from 'next';
import { site } from '@/content/site';
import { localePath } from '@/i18n/config';
import { fetchProducts } from '@/lib/api';

export const revalidate = 3600;

// Every page is listed in both languages, each pointing to its translation (hreflang).
function entry(path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap[number] {
  const en = `${site.url}${localePath('en', path)}`;
  const pt = `${site.url}${localePath('pt', path)}`;
  return { url: en, alternates: { languages: { en, 'pt-BR': pt } }, ...extra };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await fetchProducts({ pageSize: 100 });
  const pages = [
    entry('/', { changeFrequency: 'weekly', priority: 1 }),
    entry('/products', { changeFrequency: 'daily', priority: 0.9 }),
    ...items.map((p) =>
      entry(`/products/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.7 }),
    ),
  ];
  // also list the Portuguese URLs as entries of their own
  return pages.flatMap((e) => {
    const pt = e.alternates?.languages?.['pt-BR'] as string;
    return [e, { ...e, url: pt }];
  });
}
