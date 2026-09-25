'use client';

import { useI18n } from '@/i18n/provider';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';
import { WhatsAppIcon } from './icons';

export function FloatingWhatsApp() {
  const { m } = useI18n();
  return (
    <a
      href={whatsappUrl(generalMessage(m))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={m.whatsapp.floating}
      className="group fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-jade-300 to-jade-500 text-ink-950 shadow-[0_10px_40px_-8px_rgb(18_201_139/0.9)] transition-transform hover:scale-110 sm:bottom-7 sm:right-7"
    >
      <span className="absolute inset-0 animate-pulse-ring rounded-full border border-jade-400" />
      <WhatsAppIcon className="h-7 w-7" />
      <span className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-full bg-ink-900/90 px-4 py-2 text-sm font-medium text-ice opacity-0 ring-1 ring-white/10 backdrop-blur transition-opacity group-hover:opacity-100 md:block">
        {m.nav.contactUs}
      </span>
    </a>
  );
}
