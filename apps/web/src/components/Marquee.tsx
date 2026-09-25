'use client';

import { useI18n } from '@/i18n/provider';

export function Marquee() {
  const { m } = useI18n();
  const items = [...m.home.marquee, ...m.home.marquee];
  return (
    <div
      className="relative overflow-hidden border-y border-white/[0.07] bg-white/[0.015] py-5"
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-2xl italic text-ice/55 sm:text-3xl">
        {items.map((name, i) => (
          <span key={i} className="flex items-center gap-10">
            {name}
            <span className="text-base not-italic text-jade-400">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
