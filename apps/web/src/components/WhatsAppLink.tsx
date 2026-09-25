'use client';

import { usePathname } from 'next/navigation';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { whatsappUrl } from '@/lib/whatsapp';

export type WaSource = 'MENU' | 'FLOATING' | 'FOOTER' | 'HERO' | 'HOME_CTA' | 'CATALOG' | 'PRODUCT_CARD' | 'PRODUCT_PAGE';

// No 0/1/O/I: the code is read out and typed by people
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function makeRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Page path only (no query, no fragment), restricted to what the API accepts. */
function cleanPath(): string {
  const p = window.location.pathname.replace(/[^\w\-./%]/g, '').slice(0, 199);
  return p.startsWith('/') ? p : '/';
}

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  /** Message already written in the visitor's language (see lib/whatsapp.ts). */
  message: string;
  /** Which button this is: it is written in the message and counted in the analytics. */
  source: WaSource;
  productSlug?: string;
  children: ReactNode;
}

/**
 * Every WhatsApp button of the site. On click it:
 *  1. appends a short reference code and the origin of the click to the message ("Ref: K7M2QX · Sent from: product page"),
 *     in the language of the version being used, so the shop can match the conversation with the click;
 *  2. counts the click (anonymous: no IP, no user agent, no cookies are stored).
 * Without JavaScript (or when opened in a new tab from the context menu) the plain link still works, just without the code.
 */
export function WhatsAppLink({ message, source, productSlug, children, onClick, ...rest }: Props) {
  const { locale, m, whatsapp } = useI18n();
  const pathname = usePathname();
  void pathname; // re-render on navigation so the fallback href stays current

  const plain = whatsappUrl(message, whatsapp);

  function track(e: MouseEvent<HTMLAnchorElement>) {
    const ref = makeRef();
    const tail = fmt(m.whatsapp.tail, { ref, origin: m.whatsapp.origins[source] });
    e.currentTarget.href = whatsappUrl(`${message}\n\n${tail}`, whatsapp);
    try {
      void fetch('/api/track/click', {
        method: 'POST',
        keepalive: true, // survives the new tab opening
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, source, path: cleanPath(), locale, ...(productSlug ? { productSlug } : {}) }),
      }).catch(() => {});
    } catch {
      /* tracking must never block the visitor */
    }
  }

  return (
    <a
      {...rest}
      href={plain}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        track(e);
        onClick?.(e);
      }}
      onAuxClick={track}
    >
      {children}
    </a>
  );
}
