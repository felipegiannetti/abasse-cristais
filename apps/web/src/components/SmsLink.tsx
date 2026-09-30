'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '@/i18n/provider';
import { smsUrl } from '@/lib/contact';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  /** Message already written in the visitor's language (see lib/contact.ts). */
  message: string;
  children: ReactNode;
}

/**
 * A "send an SMS" link, pre-filled with `message`. Renders nothing when the admin hasn't
 * configured an SMS number (Settings page). Unlike WhatsAppLink, this does not open a new tab:
 * `sms:` links hand off to the device's messaging app without unloading the current page.
 */
export function SmsLink({ message, children, ...rest }: Props) {
  const { sms } = useI18n();
  if (!sms) return null;
  return (
    <a {...rest} href={smsUrl(sms, message)}>
      {children}
    </a>
  );
}
