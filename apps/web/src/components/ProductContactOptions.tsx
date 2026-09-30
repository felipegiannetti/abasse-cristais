'use client';

import { useI18n } from '@/i18n/provider';
import { productEmailBody, productEmailSubject, productSms } from '@/lib/contact';
import type { Product } from '@/lib/types';
import { EmailLink } from './EmailLink';
import { SmsLink } from './SmsLink';
import { MailIcon, SmsIcon } from './icons';

type ContactProduct = Pick<Product, 'name' | 'slug' | 'priceCents' | 'saleMode'>;

/**
 * Secondary "or reach us by SMS / email" row, shown under the main WhatsApp button.
 * Renders nothing when the admin hasn't configured either channel.
 */
export function ProductContactOptions({ product, className = '' }: { product: ContactProduct; className?: string }) {
  const { locale, m, sms, email } = useI18n();
  if (!sms && !email) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <SmsLink message={productSms(product, locale, m)} className="btn btn-ghost btn-sm">
        <SmsIcon className="h-4 w-4" /> {m.sms.button}
      </SmsLink>
      <EmailLink
        subject={productEmailSubject(product, m)}
        body={productEmailBody(product, locale, m)}
        className="btn btn-ghost btn-sm"
      >
        <MailIcon className="h-4 w-4" /> {m.email.button}
      </EmailLink>
    </div>
  );
}
