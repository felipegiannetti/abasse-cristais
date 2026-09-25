import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, GemIcon, WhatsAppIcon } from '@/components/icons';
import { getMessages, isLocale, localePath, plural, type Locale } from '@/i18n';
import { alternates } from '@/i18n/seo';
import { fetchCategories, fetchProducts } from '@/lib/api';
import { generalMessage, whatsappUrl } from '@/lib/whatsapp';

export const revalidate = 60;

const PAGE_SIZE = 12;

// Query params keep their names in both languages so URLs stay stable when switching.
type Search = { category?: string; q?: string; page?: string };
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Search> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const m = getMessages(locale);
  return {
    title: m.meta.collectionTitle,
    description: m.meta.collectionDescription,
    alternates: alternates(locale, '/products'),
  };
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const m = getMessages(locale);
  const c = m.catalog;

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const [{ items, total }, categories] = await Promise.all([
    fetchProducts({ category: sp.category, q: sp.q, page, pageSize: PAGE_SIZE }),
    fetchCategories(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(sp.category || sp.q);

  const href = (params: Search) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    return localePath(locale, '/products') + (qs.size ? `?${qs}` : '');
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-10 pt-36 sm:px-8">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">{c.eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl font-medium leading-tight text-ice sm:text-6xl">
          {c.titleA} <span className="text-gradient italic">{c.titleB}</span>
        </h1>
        <p className="mt-4 text-lg text-ice/65">{c.intro}</p>
      </Reveal>

      {/* Filters */}
      <div className="mt-12 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="list" aria-label={c.categories}>
          <Chip active={!sp.category} to={href({ q: sp.q })}>
            {c.all}
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.name}
              active={sp.category?.toLowerCase() === cat.name.toLowerCase()}
              to={href({ category: cat.name, q: sp.q })}
            >
              {cat.name} <span className="ml-1 text-ice/40">{cat.count}</span>
            </Chip>
          ))}
        </div>

        <form action={localePath(locale, '/products')} className="relative w-full lg:w-80" role="search">
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          <input
            name="q"
            defaultValue={sp.q}
            placeholder={c.searchPlaceholder}
            aria-label={c.searchLabel}
            maxLength={80}
            className="field !rounded-full !pl-5 !pr-12"
          />
          <button
            type="submit"
            aria-label={c.search}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-jade-400/15 text-jade-300 hover:bg-jade-400/30"
          >
            <ArrowIcon />
          </button>
        </form>
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        <>
          <p className="mt-10 text-sm text-ice/45">
            {filtered ? plural(total, c.foundOne, c.foundMany) : plural(total, c.countOne, c.countMany)}
          </p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={0.06 * (i % 3)}>
                <ProductCard product={p} priority={i < 3} />
              </Reveal>
            ))}
          </div>

          {pages > 1 && (
            <nav aria-label={c.pagination} className="mt-14 flex items-center justify-center gap-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={href({ category: sp.category, q: sp.q, page: n > 1 ? String(n) : undefined })}
                  aria-current={n === page ? 'page' : undefined}
                  className={`grid h-11 w-11 place-items-center rounded-full border text-sm font-semibold transition-colors ${
                    n === page
                      ? 'border-jade-400 bg-jade-400 text-ink-950'
                      : 'border-white/15 text-ice/70 hover:border-jade-400/60 hover:text-ice'
                  }`}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </>
      ) : (
        <div className="glass mt-12 rounded-3xl px-6 py-20 text-center">
          <GemIcon className="mx-auto h-10 w-10 text-jade-400" />
          <p className="mt-4 font-display text-3xl text-ice">{filtered ? c.emptyFiltered : c.emptyAll}</p>
          <p className="mx-auto mt-2 max-w-md text-ice/60">{c.emptyText}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {filtered && (
              <Link href={localePath(locale, '/products')} className="btn btn-ghost">
                {c.clearFilters}
              </Link>
            )}
            <a href={whatsappUrl(generalMessage(m))} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <WhatsAppIcon className="h-4 w-4" /> {m.home.hero.whatsapp}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, to, children }: { active: boolean; to: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      role="listitem"
      aria-current={active ? 'true' : undefined}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'border-jade-400 bg-jade-400/15 text-jade-300'
          : 'border-white/12 text-ice/70 hover:border-jade-400/50 hover:text-ice'
      }`}
    >
      {children}
    </Link>
  );
}
