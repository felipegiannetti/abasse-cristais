'use client';

import Link from 'next/link';
import { site } from '@/content/site';
import { fxNote } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { generalMessage } from '@/lib/whatsapp';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { GlobeIcon, WhatsAppIcon } from './icons';
import { WhatsAppLink } from '@/components/WhatsAppLink';

export function Footer() {
  const { m, href, fx } = useI18n();
  return (
    <footer className="relative mt-32 border-t border-white/[0.07]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo className="h-12" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-pearl/60">
            {m.meta.description} {m.footer.about}
          </p>
        </div>

        <nav aria-label={m.footer.label} className="text-sm">
          <p className="eyebrow mb-4">{m.footer.navigate}</p>
          <ul className="space-y-3 text-pearl/70">
            <li><Link className="hover:text-gold-300" href={href('/')}>{m.nav.home}</Link></li>
            <li><Link className="hover:text-gold-300" href={href('/products')}>{m.nav.collection}</Link></li>
            <li><Link className="hover:text-gold-300" href={href('/#story')}>{m.nav.story}</Link></li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="eyebrow mb-4">{m.footer.contact}</p>
          <p className="mb-4 flex items-center gap-2 text-pearl/70">
            <GlobeIcon className="h-4 w-4 text-gold-300" /> {m.shipping.short}
          </p>
          <WhatsAppLink message={generalMessage(m)} source="FOOTER" className="btn btn-ghost btn-sm">
            <WhatsAppIcon className="h-4 w-4" /> {m.footer.chat}
          </WhatsAppLink>
          {site.instagram && (
            <p className="mt-4">
              <a className="text-pearl/70 hover:text-gold-300" href={site.instagram} target="_blank" rel="noopener noreferrer">
                {m.footer.instagram}
              </a>
            </p>
          )}
          <LanguageSwitcher className="mt-5 w-fit" />
        </div>
      </div>
      <div className="border-t border-white/[0.05] py-6 text-center text-xs text-pearl/40">
        {fx && <p className="mx-auto mb-2 max-w-3xl px-5">{fxNote(fx, m)}</p>}
        © {new Date().getFullYear()} {site.name}. {m.footer.rights}
      </div>
    </footer>
  );
}
