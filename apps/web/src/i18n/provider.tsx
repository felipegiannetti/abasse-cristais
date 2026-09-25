'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { localePath, type Locale } from './config';
import type { Messages } from './messages/en';

interface I18n {
  locale: Locale;
  m: Messages;
  /** Locale-aware internal link: href('/products') → '/pt/products' when in Portuguese. */
  href: (path: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo<I18n>(() => ({ locale, m: messages, href: (p) => localePath(locale, p) }), [locale, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
