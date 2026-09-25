'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { fmt } from '@/i18n/config';
import { formatPrice, plural } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import type { Product, ProductList, ProductStatus, Stats } from '@/lib/types';
import { IconEdit, IconGem, IconGrid, IconList, IconPlus, IconSearch, IconStar, IconTrash } from './AdminIcons';
import { ConfirmDialog } from './ConfirmDialog';
import { TiltCard } from './TiltCard';
import { useToast } from './Toast';

const PAGE_SIZE = 18;
const STATUSES: ProductStatus[] = ['AVAILABLE', 'SOLD_OUT', 'HIDDEN'];

const STATUS_STYLE: Record<ProductStatus, string> = {
  AVAILABLE: 'border-gold-400/40 bg-gold-400/15 text-gold-300',
  SOLD_OUT: 'border-sky/40 bg-sky/15 text-sky',
  HIDDEN: 'border-white/20 bg-white/10 text-pearl/60',
};

type View = 'grid' | 'list';

export function ProductsAdmin() {
  const toast = useToast();
  const { locale, m, href } = useI18n();
  const t = m.admin.list;
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<'' | ProductStatus>('');
  const [counts, setCounts] = useState<Stats['byStatus'] | null>(null);
  const [view, setView] = useState<View>('grid');
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-view');
      if (saved === 'grid' || saved === 'list') setView(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('admin-view', v);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const loadCounts = useCallback(() => {
    api<Stats>('/admin/products/stats', nav)
      .then((s) => setCounts(s.byStatus))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(loadCounts, [loadCounts]);

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ page: String(pageToLoad), pageSize: String(PAGE_SIZE) });
        if (debouncedQ) qs.set('q', debouncedQ);
        if (status) qs.set('status', status);
        const data = await api<ProductList>(`/admin/products?${qs}`, nav);
        setItems((cur) => (append ? [...cur, ...data.items] : data.items));
        setTotal(data.total);
        setPage(pageToLoad);
      } catch (e) {
        setError(errorText(e, m, t.loadFailed));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQ, status, m],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  async function patch(p: Product, data: Partial<Pick<Product, 'status' | 'featured'>>, okMessage: string) {
    const before = items;
    setItems((cur) => cur.map((i) => (i.id === p.id ? { ...i, ...data } : i))); // optimistic
    try {
      await api(`/admin/products/${p.id}`, { method: 'PATCH', json: data, ...nav });
      await revalidateCatalog();
      loadCounts();
      toast(okMessage);
    } catch (e) {
      setItems(before);
      toast(errorText(e, m, t.saveFailed), 'error');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/admin/products/${toDelete.id}`, { method: 'DELETE', ...nav });
      await revalidateCatalog();
      setItems((cur) => cur.filter((i) => i.id !== toDelete.id));
      setTotal((n) => n - 1);
      loadCounts();
      toast(t.deleted);
      setToDelete(null);
    } catch (e) {
      toast(errorText(e, m, t.deleteFailed), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = Boolean(debouncedQ || status);
  const allCount = counts ? counts.AVAILABLE + counts.SOLD_OUT + counts.HIDDEN : undefined;
  const tabs: { key: '' | ProductStatus; label: string; count?: number }[] = [
    { key: '', label: t.tabAll, count: allCount },
    ...STATUSES.map((s) => ({ key: s, label: m.admin.status[s], count: counts?.[s] })),
  ];

  const statusPill = (p: Product) => (
    <select
      aria-label={fmt(t.statusOf, { name: p.name })}
      value={p.status}
      onChange={(e) => patch(p, { status: e.target.value as ProductStatus }, t.statusUpdated)}
      className={`cursor-pointer appearance-none rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors ${STATUS_STYLE[p.status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-navy-900 text-pearl">
          {m.admin.status[s]}
        </option>
      ))}
    </select>
  );

  const starBtn = (p: Product) => (
    <button
      type="button"
      aria-pressed={p.featured}
      title={p.featured ? t.unfeature : t.feature}
      aria-label={p.featured ? t.unfeature : t.feature}
      onClick={() => patch(p, { featured: !p.featured }, p.featured ? t.unfeatured : t.featured)}
      className={`grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition-all hover:scale-110 ${
        p.featured ? 'border-gold-400 bg-gold-400/25 text-gold-300' : 'border-white/20 bg-navy-950/50 text-pearl/60 hover:text-gold-300'
      }`}
    >
      <IconStar filled={p.featured} className="h-4 w-4" />
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-medium text-pearl sm:text-5xl">{t.title}</h1>
        </div>
        <Link href={href('/admin/products/new')} className="btn btn-primary">
          <IconPlus className="h-4 w-4" /> {t.new.replace('+ ', '')}
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={t.statusLabel} className="glass inline-flex w-fit max-w-full flex-wrap gap-1 rounded-3xl p-1 sm:rounded-full">
          {tabs.map((tab) => {
            const on = status === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                role="tab"
                aria-selected={on}
                onClick={() => setStatus(tab.key)}
                className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${on ? 'text-navy-950' : 'text-pearl/65 hover:text-pearl'}`}
              >
                {on && (
                  <motion.span
                    layoutId="status-tab"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-gold-300 to-gold-500"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  />
                )}
                <span className="relative">
                  {tab.label}
                  {tab.count !== undefined && <span className={`ml-1.5 text-xs ${on ? 'text-navy-950/70' : 'text-pearl/35'}`}>{tab.count}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pearl/40" />
            <input
              className="field !rounded-full !pl-11"
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="glass flex rounded-full p-1" role="group">
            {(['grid', 'list'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === 'grid' ? t.grid : t.listView}
                title={v === 'grid' ? t.grid : t.listView}
                onClick={() => changeView(v)}
                className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${view === v ? 'bg-gold-400/25 text-gold-300' : 'text-pearl/50 hover:text-pearl'}`}
              >
                {v === 'grid' ? <IconGrid className="h-4 w-4" /> : <IconList className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm text-pearl/45" aria-live="polite">
        {loading && items.length === 0 ? t.loading : filtered ? plural(total, t.foundOne, t.foundMany) : plural(total, t.countOne, t.countMany)}
      </p>

      {/* Loading skeleton */}
      {loading && items.length === 0 && (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-80" />
          ))}
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && items.length > 0 && (
        <motion.ul layout className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {items.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard className="glass-strong group overflow-hidden rounded-3xl">
                  <div className="relative aspect-[4/3] overflow-hidden bg-navy-900">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0].url}
                        alt=""
                        className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 ${p.status === 'HIDDEN' ? 'opacity-50 grayscale' : ''}`}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-gold-400/40">
                        <IconGem className="h-12 w-12" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/10 to-transparent" />
                    <div className="absolute left-3 top-3">{statusPill(p)}</div>
                    <div className="absolute right-3 top-3">{starBtn(p)}</div>
                    <div className="absolute inset-x-3 bottom-3">
                      <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold-300">{p.category}</p>
                      <p className="truncate font-display text-2xl leading-tight text-pearl">{p.name}</p>
                      <p className="text-sm font-semibold text-gold-300">{formatPrice(p.priceCents, locale, m)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-xs text-pearl/45">{plural(p.images.length, t.photoOne, t.photoMany)}</span>
                    <div className="flex gap-2">
                      <Link href={href(`/admin/products/${p.id}`)} className="btn btn-ghost btn-sm !px-4">
                        <IconEdit className="h-4 w-4" /> {t.edit}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setToDelete(p)}
                        aria-label={`${t.delete}: ${p.name}`}
                        title={t.delete}
                        className="btn btn-danger btn-sm !px-3"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </TiltCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      {/* List view */}
      {view === 'list' && items.length > 0 && (
        <ul className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {items.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.4, delay: Math.min(i, 10) * 0.03 }}
                className="glass-strong flex flex-wrap items-center gap-4 rounded-2xl p-3 pr-4 sm:flex-nowrap"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-900">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-gold-400/40">
                      <IconGem />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-40">
                  <Link href={href(`/admin/products/${p.id}`)} className="block truncate font-display text-xl font-semibold text-pearl hover:text-gold-300">
                    {p.name}
                  </Link>
                  <p className="truncate text-sm text-pearl/50">
                    {p.category} · {plural(p.images.length, t.photoOne, t.photoMany)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gold-300">{formatPrice(p.priceCents, locale, m)}</p>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  {statusPill(p)}
                  {starBtn(p)}
                  <Link href={href(`/admin/products/${p.id}`)} className="btn btn-ghost btn-sm">
                    {t.edit}
                  </Link>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>
                    {t.delete}
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {!loading && items.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong gold-border relative mt-4 overflow-hidden rounded-[2rem] px-6 py-20 text-center"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/10 blur-[70px]" />
          <IconGem className="relative mx-auto h-14 w-14 animate-float text-gold-300" />
          <p className="relative mt-5 font-display text-4xl text-pearl">{filtered ? t.emptyFiltered : t.emptyAll}</p>
          {!filtered && (
            <>
              <p className="relative mt-2 text-pearl/55">{t.emptyText}</p>
              <Link href={href('/admin/products/new')} className="btn btn-primary relative mt-7">
                <IconPlus className="h-4 w-4" /> {t.new.replace('+ ', '')}
              </Link>
            </>
          )}
        </motion.div>
      )}

      {items.length < total && (
        <div className="mt-8 text-center">
          <button className="btn btn-ghost" disabled={loading} onClick={() => load(page + 1, true)}>
            {loading ? t.loading : t.loadMore}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t.confirmTitle}
        message={fmt(t.confirmText, { name: toDelete?.name ?? '' })}
        confirmLabel={t.confirmButton}
        loadingLabel={t.deleting}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
