// English is the main language (no URL prefix). Portuguese lives under /pt.
export const locales = ['en', 'pt'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);

/** '/products' → '/products' (en) | '/pt/products' (pt). Keeps '#hash' and '?query'. */
export function localePath(locale: Locale, path: string): string {
  // collapse leading slashes: '//host' would be a protocol-relative URL (open redirect)
  path = path.replace(/^\/{2,}/, '/');
  if (locale === defaultLocale) return path;
  if (path === '/') return '/pt';
  if (path.startsWith('/#') || path.startsWith('/?')) return `/pt${path.slice(1)}`;
  return `/pt${path}`;
}

/** Removes a leading /en or /pt segment. */
export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(en|pt)(?=\/|$)/, '') || '/';
}

export const htmlLang: Record<Locale, string> = { en: 'en', pt: 'pt-BR' };
export const ogLocale: Record<Locale, string> = { en: 'en_US', pt: 'pt_BR' };

/** Replaces {placeholders}. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
