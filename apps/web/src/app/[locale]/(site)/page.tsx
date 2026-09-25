import type { Metadata } from 'next';
import Link from 'next/link';
import { CrystalHero } from '@/components/CrystalHero';
import { Marquee } from '@/components/Marquee';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, GemIcon, WhatsAppIcon } from '@/components/icons';
import { getMessages, isLocale, localePath, type Locale } from '@/i18n';
import { alternates } from '@/i18n/seo';
import { fetchProducts } from '@/lib/api';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';

export const revalidate = 60;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternates(isLocale(locale) ? locale : 'en', '/') };
}

export default async function HomePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const m = getMessages(locale);
  const href = (p: string) => localePath(locale, p);

  let featured = (await fetchProducts({ featured: true, pageSize: 6 })).items;
  if (featured.length === 0) featured = (await fetchProducts({ pageSize: 6 })).items;

  return (
    <>
      <CrystalHero />
      <Marquee />

      {/* ------------------------------ Story ------------------------------ */}
      <section id="story" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8 lg:py-40">
        <div className="grid items-start gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
          <div>
            <Reveal>
              <p className="eyebrow">{m.home.story.eyebrow}</p>
              <h2 className="mt-5 font-display text-4xl font-medium leading-[1.08] text-ice sm:text-5xl lg:text-6xl">
                {m.home.story.title}
              </h2>
            </Reveal>
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-ice/70">
              {m.home.story.paragraphs.map((p, i) => (
                <Reveal key={i} delay={0.12 * (i + 1)}>
                  <p>{p}</p>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {m.home.story.pillars.map((p, i) => (
              <Reveal key={p.title} delay={0.1 * i}>
                <div className="glass group flex gap-5 rounded-3xl p-6 transition-colors hover:border-jade-400/40">
                  <div className="facet-clip grid h-14 w-14 shrink-0 place-items-center bg-gradient-to-br from-jade-300/30 to-jade-600/30 text-jade-300">
                    <GemIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold text-ice">{p.title}</h3>
                    <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ice/60">{p.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Featured ------------------------------ */}
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">{m.home.featured.eyebrow}</p>
            <h2 className="mt-4 font-display text-4xl font-medium text-ice sm:text-5xl">
              {m.home.featured.titleA} <span className="text-gradient italic">{m.home.featured.titleB}</span>
            </h2>
          </div>
          <Link href={href('/products')} className="btn btn-ghost btn-sm">
            {m.home.featured.all} <ArrowIcon />
          </Link>
        </Reveal>

        {featured.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={0.08 * (i % 3)}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="glass rounded-3xl px-6 py-16 text-center">
            <GemIcon className="mx-auto h-10 w-10 text-jade-400" />
            <p className="mt-4 font-display text-3xl text-ice">{m.home.featured.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-ice/60">{m.home.featured.emptyText}</p>
          </Reveal>
        )}
      </section>

      {/* ------------------------------ How it works ------------------------------ */}
      <section className="mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:py-36">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{m.home.how.eyebrow}</p>
          <h2 className="mt-4 font-display text-4xl font-medium text-ice sm:text-5xl">{m.home.how.title}</h2>
        </Reveal>
        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-jade-400/40 to-transparent md:block" />
          {m.home.how.steps.map((s, i) => (
            <Reveal key={s.title} delay={0.12 * i} className="relative text-center">
              <div className="facet-clip relative z-10 mx-auto grid h-16 w-16 place-items-center bg-gradient-to-br from-jade-300 to-jade-600 font-display text-3xl font-semibold text-ink-950">
                {i + 1}
              </div>
              <h3 className="mt-6 font-display text-2xl font-semibold text-ice">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-[0.95rem] leading-relaxed text-ice/60">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------ Final CTA ------------------------------ */}
      <section className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="glass relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-14 sm:py-20">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-jade-500/25 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-aqua/15 blur-[90px]" />
          <h2 className="relative font-display text-4xl font-medium leading-tight text-ice sm:text-6xl">
            {m.home.cta.titleA} <span className="text-shimmer italic">{m.home.cta.titleB}</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-lg text-ice/65">{m.home.cta.text}</p>
          <a
            href={whatsappUrl(generalMessage(m))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary relative mt-9"
          >
            <WhatsAppIcon /> {m.home.cta.button}
          </a>
        </Reveal>
      </section>
    </>
  );
}
