'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { centsToInput, parsePriceToCents } from '@/lib/format';
import type { Product, ProductStatus } from '@/lib/types';
import { ImageManager, type ImageItem } from './ImageManager';
import { useToast } from './Toast';

const STATUSES: ProductStatus[] = ['AVAILABLE', 'SOLD_OUT', 'HIDDEN'];

export function ProductForm({ initial }: { initial?: Product }) {
  const router = useRouter();
  const toast = useToast();
  const { locale, m, href } = useI18n();
  const t = m.admin.form;
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  // After the product is created, another "save" (e.g. after a failed upload) edits it instead of duplicating.
  const [productId, setProductId] = useState(initial?.id);
  const [slug, setSlug] = useState(initial?.slug);

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(centsToInput(initial?.priceCents, locale));
  const [status, setStatus] = useState<ProductStatus>(initial?.status ?? 'AVAILABLE');
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [weight, setWeight] = useState(initial?.weight ?? '');
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? '');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [images, setImages] = useState<ImageItem[]>(
    () => initial?.images.map((i) => ({ key: i.id, id: i.id, url: i.url })) ?? [],
  );
  const removedIds = useRef<string[]>([]);

  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<string[]>('/admin/products/categories', nav).then(setCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleImages(next: ImageItem[]) {
    const gone = images.filter((i) => i.id && !next.some((n) => n.key === i.key));
    removedIds.current.push(...gone.map((i) => i.id!));
    setImages(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const priceCents = price.trim() ? parsePriceToCents(price) : null;
    if (price.trim() && priceCents === null) return setError(t.errPrice);
    if (name.trim().length < 2) return setError(t.errName);
    if (!category.trim()) return setError(t.errCategory);
    if (!description.trim()) return setError(t.errDescription);

    setSaving(true);
    try {
      setProgress(t.stepData);
      const payload = { name, description, priceCents, category, weight, dimensions, origin, featured, status };
      const product = productId
        ? await api<Product>(`/admin/products/${productId}`, { method: 'PATCH', json: payload, ...nav })
        : await api<Product>('/admin/products', { method: 'POST', json: payload, ...nav });
      setProductId(product.id);
      setSlug(product.slug);

      while (removedIds.current.length) {
        const id = removedIds.current[0];
        await api(`/admin/products/${product.id}/images/${id}`, { method: 'DELETE', ...nav });
        removedIds.current.shift();
      }

      // sequential uploads: each photo is its own request (Vercel body-size limit)
      let current = images;
      const pending = images.filter((i) => i.file);
      for (const [n, item] of pending.entries()) {
        setProgress(fmt(t.stepUpload, { n: n + 1, total: pending.length }));
        const fd = new FormData();
        fd.append('file', item.file!);
        const saved = await api<{ id: string; url: string }>(`/admin/products/${product.id}/images`, {
          method: 'POST',
          form: fd,
          ...nav,
        });
        URL.revokeObjectURL(item.url);
        current = current.map((i) => (i.key === item.key ? { key: i.key, id: saved.id, url: saved.url } : i));
        setImages(current);
      }

      if (current.length > 1) {
        setProgress(t.stepOrder);
        await api(`/admin/products/${product.id}/images/order`, {
          method: 'PUT',
          json: { ids: current.map((i) => i.id) },
          ...nav,
        });
      }

      await revalidateCatalog();
      toast(initial ? t.updated : t.created);
      router.push(href('/admin'));
    } catch (err) {
      setError(errorText(err, m, t.unexpected) + (productId || slug ? ` ${t.keptNote}` : ''));
      setSaving(false);
      setProgress('');
    }
  }

  const opt = <span className="normal-case tracking-normal text-ice/30">{t.optional}</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={href('/admin')} className="text-sm text-ice/50 hover:text-jade-300">
            {t.back}
          </Link>
          <h1 className="mt-3 font-display text-4xl font-medium text-ice sm:text-5xl">{initial ? t.titleEdit : t.titleNew}</h1>
        </div>
        {slug && (
          <a href={href(`/products/${slug}`)} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
            {t.viewOnSite}
          </a>
        )}
      </div>

      <section className="glass space-y-5 rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="font-display text-2xl text-ice">{t.info}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="label">{t.name}</label>
            <input id="name" className="field" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} required />
          </div>
          <div>
            <label htmlFor="category" className="label">{t.category}</label>
            <input id="category" className="field" list="categories" value={category} maxLength={60} onChange={(e) => setCategory(e.target.value)} placeholder={t.categoryPh} required />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="price" className="label">{t.price}</label>
            <input id="price" className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t.pricePh} />
            <p className="mt-1.5 text-xs text-ice/40">{t.priceHint}</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className="label">{t.description}</label>
            <textarea id="description" className="field min-h-40 resize-y" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} placeholder={t.descriptionPh} required />
          </div>
          <div>
            <label htmlFor="weight" className="label">{t.weight} {opt}</label>
            <input id="weight" className="field" value={weight} maxLength={60} onChange={(e) => setWeight(e.target.value)} placeholder={t.weightPh} />
          </div>
          <div>
            <label htmlFor="dimensions" className="label">{t.dimensions} {opt}</label>
            <input id="dimensions" className="field" value={dimensions} maxLength={60} onChange={(e) => setDimensions(e.target.value)} placeholder={t.dimensionsPh} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="origin" className="label">{t.origin} {opt}</label>
            <input id="origin" className="field" value={origin} maxLength={60} onChange={(e) => setOrigin(e.target.value)} placeholder={t.originPh} />
          </div>
        </div>
      </section>

      <section className="glass rounded-[1.75rem] p-6 sm:p-8">
        <ImageManager items={images} onChange={handleImages} onError={(msg) => toast(msg, 'error')} disabled={saving} />
      </section>

      <section className="glass grid gap-5 rounded-[1.75rem] p-6 sm:grid-cols-2 sm:p-8">
        <div>
          <label htmlFor="status" className="label">{t.status}</label>
          <select id="status" className="field" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{m.admin.statusLong[s]}</option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 hover:border-jade-400/40">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-5 w-5 accent-[#34e0a1]" />
          <span>
            <span className="block font-medium text-ice">{t.featured}</span>
            <span className="block text-xs text-ice/45">{t.featuredHint}</span>
          </span>
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 rounded-full border border-white/10 bg-ink-950/85 p-2.5 pl-3 backdrop-blur-xl">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? t.saving : initial ? t.save : t.create}
        </button>
        <Link href={href('/admin')} className="btn btn-ghost">{t.cancel}</Link>
        {progress && <span className="text-sm text-jade-300" role="status">{progress}</span>}
      </div>
    </form>
  );
}
