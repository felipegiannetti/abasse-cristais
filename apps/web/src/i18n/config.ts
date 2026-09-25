// English is the main language (no URL prefix). Portuguese lives under /pt and Spanish under /es.
// The admin area is Portuguese only (see middleware and app/[locale]/admin/layout.tsx).
export const locales = ['en', 'pt', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Locales that appear as a URL prefix. */
export const prefixedLocales = ['pt', 'es'] as const;

export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);

/** '/products' → '/products' (en) | '/pt/products' | '/es/products'. Keeps '#hash' and '?query'. */
export function localePath(locale: Locale, path: string): string {
  // collapse leading slashes: '//host' would be a protocol-relative URL (open redirect)
  path = path.replace(/^\/{2,}/, '/');
  if (locale === defaultLocale) return path;
  if (path === '/') return `/${locale}`;
  if (path.startsWith('/#') || path.startsWith('/?')) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** Removes a leading /en, /pt or /es segment. */
export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(en|pt|es)(?=\/|$)/, '') || '/';
}

export const htmlLang: Record<Locale, string> = { en: 'en', pt: 'pt-BR', es: 'es' };
export const ogLocale: Record<Locale, string> = { en: 'en_US', pt: 'pt_BR', es: 'es_ES' };

/** Replaces {placeholders}. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
