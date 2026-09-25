import { localePath, type Locale } from './config';

/** canonical + hreflang alternates for a page path like '/products'. */
export function alternates(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: {
      en: localePath('en', path),
      'pt-BR': localePath('pt', path),
      'x-default': localePath('en', path),
    },
  };
}
