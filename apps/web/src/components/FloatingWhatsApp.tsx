'use client';

import { useI18n } from '@/i18n/provider';
import { generalMessage } from '@/lib/whatsapp';
import { WhatsAppIcon } from './icons';
import { WhatsAppLink } from '@/components/WhatsAppLink';

export function FloatingWhatsApp() {
  const { m } = useI18n();
  return (
    <WhatsAppLink
      message={generalMessage(m)} source="FLOATING"
      aria-label={m.whatsapp.floating}
      className="group fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gold-400 text-navy-950 shadow-lg shadow-black/30 transition-colors hover:bg-gold-300 sm:bottom-7 sm:right-7"
    >
      <WhatsAppIcon className="h-7 w-7" />
      <span className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-lg bg-navy-900/90 px-4 py-2 text-sm font-medium text-pearl opacity-0 ring-1 ring-white/10 backdrop-blur transition-opacity group-hover:opacity-100 md:block">
        {m.nav.contactUs}
      </span>
    </WhatsAppLink>
  );
}
