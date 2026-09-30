'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '@/i18n/provider';
import { emailUrl } from '@/lib/contact';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  subject: string;
  /** Body already written in the visitor's language (see lib/contact.ts). */
  body: string;
  children: ReactNode;
}

/**
 * A "send an email" link, pre-filled with `subject` and `body`. Renders nothing when the admin
 * hasn't configured a contact email (Settings page). `mailto:` links hand off to the device's mail
 * app without unloading the current page.
 */
export function EmailLink({ subject, body, children, ...rest }: Props) {
  const { email } = useI18n();
  if (!email) return null;
  return (
    <a {...rest} href={emailUrl(email, subject, body)}>
      {children}
    </a>
  );
}
