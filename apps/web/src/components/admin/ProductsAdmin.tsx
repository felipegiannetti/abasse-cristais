'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { fmt } from '@/i18n/config';
import { formatPrice, plural } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import type { Product, ProductList, ProductStatus } from '@/lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

const PAGE_SIZE = 20;
const STATUSES: ProductStatus[] = ['AVAILABLE', 'SOLD_OUT', 'HIDDEN'];

const STATUS_STYLE: Record<ProductStatus, string> = {
  AVAILABLE: 'text-jade-300',
  SOLD_OUT: 'text-amber-200',
  HIDDEN: 'text-ice/50',
};

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
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

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
      toast(t.deleted);
      setToDelete(null);
    } catch (e) {
      toast(errorText(e, m, t.deleteFailed), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = Boolean(debouncedQ || status);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-medium text-ice sm:text-5xl">{t.title}</h1>
        </div>
        <Link href={href('/admin/products/new')} className="btn btn-primary">
          {t.new}
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          className="field sm:max-w-sm"
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field sm:max-w-[13rem]" aria-label={t.statusLabel} value={status} onChange={(e) => setStatus(e.target.value as '' | ProductStatus)}>
          <option value="">{t.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {m.admin.status[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error}
        </p>
      )}

      <p className="mt-8 text-sm text-ice/45" aria-live="polite">
        {loading && items.length === 0
          ? t.loading
          : filtered
            ? plural(total, t.foundOne, t.foundMany)
            : plural(total, t.countOne, t.countMany)}
      </p>

      <ul className="mt-3 space-y-3">
        {items.map((p) => (
          <li key={p.id} className="glass flex flex-wrap items-center gap-4 rounded-2xl p-3 pr-4 sm:flex-nowrap">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-900">
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-ice/30">{t.noPhoto}</div>
              )}
            </div>

            <div className="min-w-0 flex-1 basis-40">
              <Link href={href(`/admin/products/${p.id}`)} className="block truncate font-display text-xl font-semibold text-ice hover:text-jade-300">
                {p.name}
              </Link>
              <p className="mt-0.5 truncate text-sm text-ice/50">
                {p.category} · {plural(p.images.length, t.photoOne, t.photoMany)}
              </p>
              <p className="mt-1 text-sm font-semibold text-jade-300">{formatPrice(p.priceCents, locale, m)}</p>
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <select
                aria-label={fmt(t.statusOf, { name: p.name })}
                value={p.status}
                onChange={(e) => patch(p, { status: e.target.value as ProductStatus }, t.statusUpdated)}
                className={`field !w-auto !rounded-full !py-2 text-sm font-semibold ${STATUS_STYLE[p.status]}`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {m.admin.status[s]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-pressed={p.featured}
                title={p.featured ? t.unfeature : t.feature}
                aria-label={p.featured ? t.unfeature : t.feature}
                onClick={() => patch(p, { featured: !p.featured }, p.featured ? t.unfeatured : t.featured)}
                className={`grid h-10 w-10 place-items-center rounded-full border text-lg transition-colors ${
                  p.featured ? 'border-jade-400 bg-jade-400/20 text-jade-300' : 'border-white/12 text-ice/35 hover:text-jade-300'
                }`}
              >
                {p.featured ? '★' : '☆'}
              </button>
              <Link href={href(`/admin/products/${p.id}`)} className="btn btn-ghost btn-sm">
                {t.edit}
              </Link>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>
                {t.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && !error && (
        <div className="glass mt-3 rounded-3xl px-6 py-16 text-center">
          <p className="font-display text-3xl text-ice">{filtered ? t.emptyFiltered : t.emptyAll}</p>
          {!filtered && (
            <>
              <p className="mt-2 text-ice/55">{t.emptyText}</p>
              <Link href={href('/admin/products/new')} className="btn btn-primary mt-6">
                {t.new}
              </Link>
            </>
          )}
        </div>
      )}

      {items.length < total && (
        <div className="mt-6 text-center">
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
