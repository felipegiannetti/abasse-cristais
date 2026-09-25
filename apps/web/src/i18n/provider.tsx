'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { localePath, type Locale } from './config';
import type { Messages } from './messages/en';

interface I18n {
  locale: Locale;
  m: Messages;
  /** Locale-aware internal link: href('/products') → '/pt/products' when in Portuguese. */
  href: (path: string) => string;
  /** WhatsApp number (digits) configured by the admin; every WhatsApp button uses it. */
  whatsapp: string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({
  locale,
  messages,
  whatsapp = '',
  children,
}: {
  locale: Locale;
  messages: Messages;
  whatsapp?: string;
  children: ReactNode;
}) {
  const value = useMemo<I18n>(
    () => ({ locale, m: messages, href: (p) => localePath(locale, p), whatsapp }),
    [locale, messages, whatsapp],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
