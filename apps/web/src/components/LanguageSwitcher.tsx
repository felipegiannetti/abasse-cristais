'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { LOCALE_COOKIE, localePath, locales, stripLocale, type Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';

const LABEL: Record<Locale, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  pt: { short: 'PT', full: 'Português' },
  es: { short: 'ES', full: 'Español' },
};

/**
 * Switches language with a client-side navigation: no full page reload;
 * scroll position, filters (?query) and #hash are kept.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, m } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const base = stripLocale(pathname);

  function onClick(e: MouseEvent<HTMLAnchorElement>, target: Locale) {
    // let the browser handle ctrl/cmd/middle-click (open in a new tab)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (target === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
    router.push(localePath(target, base) + window.location.search + window.location.hash, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label={m.common.language}
      className={`flex items-center rounded-full border border-white/12 bg-white/[0.03] p-0.5 text-xs font-semibold ${className}`}
    >
      {locales.map((l) => (
        <Link
          key={l}
          href={localePath(l, base)}
          scroll={false}
          lang={l}
          hrefLang={l}
          aria-current={l === locale ? 'true' : undefined}
          title={LABEL[l].full}
          onClick={(e) => onClick(e, l)}
          className={`rounded-full px-2.5 py-1.5 tracking-wider transition-colors ${
            l === locale ? 'bg-gold-400 text-navy-950' : 'text-pearl/60 hover:text-pearl'
          }`}
        >
          {LABEL[l].short}
        </Link>
      ))}
    </div>
  );
}
