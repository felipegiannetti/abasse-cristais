'use client';

import Link from 'next/link';
import { site } from '@/content/site';
import { useI18n } from '@/i18n/provider';

/**
 * Company logo slot.
 * To change it: replace the file `public/logo.svg` (or use a .png and update `src` below).
 * Recommended: ~4:1 ratio, transparent background, light version (the site is dark).
 */
export function Logo({ className = 'h-10' }: { className?: string }) {
  const { m, href } = useI18n();
  return (
    <Link href={href('/')} aria-label={m.nav.homeAria} className="inline-flex shrink-0 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt={site.name} className={`${className} w-auto`} />
    </Link>
  );
}
