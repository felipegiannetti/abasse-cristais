import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductContactOptions } from '@/components/ProductContactOptions';
import { ProductGallery } from '@/components/ProductGallery';
import { Reveal } from '@/components/Reveal';
import { GlobeIcon, WhatsAppIcon } from '@/components/icons';
import { site } from '@/content/site';
import { formatPrice, fxNote, getMessages, isLocale, localePath, type Locale } from '@/i18n';
import { alternates } from '@/i18n/seo';
import { fetchFx, fetchMessages, fetchProduct } from '@/lib/api';
import { productMessage } from '@/lib/whatsapp';
import { WhatsAppLink } from '@/components/WhatsAppLink';

export const revalidate = 60;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const p = await fetchProduct(slug);
  if (!p) return { title: getMessages(locale).meta.productNotFound };
  const description = p.description.slice(0, 160);
  const image = p.images[0]?.url;
  return {
    title: p.name,
    description,
    alternates: alternates(locale, `/products/${p.slug}`),
    openGraph: { title: p.name, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  // independent fetches: run together instead of waterfalling
  const [m, p, fx] = await Promise.all([
    fetchMessages(locale), // getMessages() + any admin-customized WhatsApp text
    fetchProduct(slug),
    locale === 'pt' ? fetchFx() : Promise.resolve(null), // prices are in dollars; the Portuguese page shows reais
  ]);
  if (!p) notFound();

  const soldOut = p.status === 'SOLD_OUT' || !p.inStock;
  const specs = [
    { label: m.product.specs.category, value: p.category },
    { label: m.product.specs.origin, value: p.origin },
    { label: m.product.specs.weight, value: p.weight },
    { label: m.product.specs.dimensions, value: p.dimensions },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.images.map((i) => (i.url.startsWith('http') ? i.url : `${site.url}${i.url}`)),
    category: p.category,
    ...(p.priceCents != null && {
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD', // the catalogue price, whatever currency the page displays
        price: (p.priceCents / 100).toFixed(2),
        availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        url: `${site.url}${localePath(locale, `/products/${p.slug}`)}`,
      },
    }),
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-10 pt-32 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav aria-label={m.product.breadcrumb} className="mb-8 text-sm text-pearl/50">
        <Link href={localePath(locale, '/products')} className="hover:text-gold-300">
          {m.product.back}
        </Link>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal y={16}>
          <div className="lg:sticky lg:top-28">
            <ProductGallery images={p.images} name={p.name} soldOut={soldOut} />
          </div>
        </Reveal>

        <Reveal delay={0.1} y={16}>
          <p className="eyebrow">{p.category}</p>
          <h1 className="mt-4 font-display text-5xl font-medium leading-[1.05] text-pearl sm:text-6xl">{p.name}</h1>
          <p className={`mt-5 text-3xl font-semibold ${p.priceCents == null ? 'text-pearl/60' : 'text-gold-300'}`}>
            {formatPrice(p.priceCents, locale, m, p.saleMode, fx)}
          </p>
          {fx && p.priceCents != null && <p className="mt-1.5 text-xs text-pearl/45">{fxNote(fx, m)}</p>}

          <div className="mt-8 h-px bg-gradient-to-r from-gold-400/50 via-white/10 to-transparent" />

          <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-pearl/75">{p.description}</p>

          {specs.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-3">
              {specs.map((s) => (
                <div key={s.label} className="glass rounded-2xl px-5 py-4">
                  <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-pearl/45">{s.label}</dt>
                  <dd className="mt-1 font-medium text-pearl">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-10">
            <WhatsAppLink
              message={productMessage(p, locale, m, fx)} source="PRODUCT_PAGE" productSlug={p.slug}
              className="btn btn-primary w-full py-4 text-base sm:w-auto"
            >
              <WhatsAppIcon className="h-5 w-5" />
              {soldOut ? m.product.askSimilarLong : m.product.wantLong}
            </WhatsAppLink>
            <ProductContactOptions product={p} className="mt-3" />
            {p.saleMode === 'WEIGHT' && <p className="mt-4 text-sm font-medium text-gold-300">{m.product.byWeight}</p>}
            <p className="mt-4 flex items-start gap-2 text-sm text-pearl/70">
              <GlobeIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> {m.shipping.note}
            </p>
            <p className="mt-3 text-sm text-pearl/45">{m.product.disclaimer}</p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
