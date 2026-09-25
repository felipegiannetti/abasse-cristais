import type { Messages } from '@/i18n';
import { GlobeIcon } from './icons';
import { Reveal } from './Reveal';

/** "We ship worldwide" section of the home page: an animated wireframe globe and the message. */
export function ShippingBanner({ m }: { m: Messages }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
      <Reveal className="glass relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-12 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-sky/10 blur-[80px]" />
        <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr]">
          {/* wireframe globe */}
          <svg viewBox="0 0 120 120" className="mx-auto h-32 w-32 text-gold-300 sm:h-40 sm:w-40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <circle cx="60" cy="60" r="54" />
            <g className="origin-center animate-[spin_24s_linear_infinite]" style={{ transformOrigin: '60px 60px' }} opacity="0.75">
              <ellipse cx="60" cy="60" rx="22" ry="54" />
              <ellipse cx="60" cy="60" rx="42" ry="54" />
              <path d="M60 6v108" />
            </g>
            <path d="M8 40h104M6 60h108M8 80h104" opacity="0.55" />
            <circle cx="88" cy="34" r="3.5" fill="currentColor" stroke="none" className="animate-pulse" />
            <circle cx="36" cy="78" r="3" fill="currentColor" stroke="none" className="animate-pulse" />
            <circle cx="66" cy="62" r="2.5" fill="currentColor" stroke="none" className="animate-pulse" />
          </svg>
          <div className="text-center md:text-left">
            <p className="eyebrow inline-flex items-center gap-2">
              <GlobeIcon className="h-4 w-4" /> {m.shipping.badge}
            </p>
            <h2 className="mt-3 font-display text-4xl font-medium text-pearl sm:text-5xl">{m.shipping.title}</h2>
            <p className="mt-3 max-w-2xl text-pearl/65">{m.shipping.text}</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
