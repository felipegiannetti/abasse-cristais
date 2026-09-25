'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { stripLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { WhatsAppIcon } from './icons';

export function Navbar() {
  const pathname = usePathname();
  const { m, href } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const links = [
    { path: '/', href: href('/'), label: m.nav.home },
    { path: '/products', href: href('/products'), label: m.nav.collection },
    { path: '/#story', href: href('/#story'), label: m.nav.story },
  ];
  const current = stripLocale(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || open ? 'border-b border-white/[0.07] bg-ink-950/70 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav aria-label={m.nav.main} className="hidden items-center gap-9 md:flex">
          {links.map((l) => {
            const active = l.path === current || (l.path === '/products' && current.startsWith('/products/'));
            return (
              <Link
                key={l.path}
                href={l.href}
                className={`group relative text-sm font-medium tracking-wide transition-colors ${
                  active ? 'text-jade-300' : 'text-ice/75 hover:text-ice'
                }`}
              >
                {l.label}
                <span
                  className={`absolute -bottom-1.5 left-0 h-px bg-jade-400 transition-all duration-300 ${
                    active ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <a
            href={whatsappUrl(generalMessage(m))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm hidden sm:inline-flex"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {m.nav.contactUs}
          </a>
          <button
            type="button"
            aria-label={open ? m.nav.closeMenu : m.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 md:hidden"
          >
            <span className="relative block h-3 w-5">
              <span className={`absolute left-0 h-px w-5 bg-ice transition-all ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
              <span className={`absolute left-0 top-1.5 h-px w-5 bg-ice transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span className={`absolute left-0 h-px w-5 bg-ice transition-all ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label={m.nav.mobile}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 pb-6 pt-2">
              {links.map((l) => (
                <Link key={l.path} href={l.href} className="rounded-xl px-3 py-3 font-display text-2xl text-ice hover:bg-white/5">
                  {l.label}
                </Link>
              ))}
              <a
                href={whatsappUrl(generalMessage(m))}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-3"
              >
                <WhatsAppIcon /> {m.nav.chatWhatsapp}
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
