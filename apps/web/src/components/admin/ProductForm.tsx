'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { fmt } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { ApiError, api, errorText } from '@/lib/client-api';
import { centsToInput, kgToGrams, parsePriceToCents } from '@/lib/format';
import type { Product, ProductStatus, SaleMode } from '@/lib/types';
import { IconExternal } from './AdminIcons';
import { ImageManager, type ImageItem } from './ImageManager';
import { ProductPreview } from './ProductPreview';
import { QrCodeCard } from './QrCodeCard';
import { useToast } from './Toast';

const STATUSES: ProductStatus[] = ['AVAILABLE', 'SOLD_OUT', 'HIDDEN'];

function Section({ n, title, children, delay = 0 }: { n: number; title: string; children: ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong rounded-[1.75rem] p-6 sm:p-7"
    >
      <h2 className="flex items-center gap-3 font-display text-2xl text-pearl">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-sans text-sm font-bold text-navy-950">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

export function ProductForm({ initial }: { initial?: Product }) {
  const router = useRouter();
  const toast = useToast();
  const { locale, m, href } = useI18n();
  const t = m.admin.form;
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  // After the product is created, another "save" (e.g. after a failed upload) edits it instead of duplicating.
  const [productId, setProductId] = useState(initial?.id);
  // version of the product this form is based on; the server refuses the save if it moved on (see PRODUCT_CHANGED)
  const baseVersion = useRef(initial?.updatedAt);
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
  const [saleMode, setSaleMode] = useState<SaleMode>(initial?.saleMode ?? 'UNIT');
  const [stockQty, setStockQty] = useState(String(initial?.stockQuantity ?? 1));
  const [stockKg, setStockKg] = useState(initial ? String((initial.stockGrams ?? 0) / 1000).replace('.', ',') : '');
  const [cost, setCost] = useState(centsToInput(initial?.costCents, locale));
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

  const priceCentsLive = useMemo(() => (price.trim() ? parsePriceToCents(price) : null), [price]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const priceCents = price.trim() ? parsePriceToCents(price) : null;
    if (price.trim() && priceCents === null) return setError(t.errPrice);
    if (name.trim().length < 2) return setError(t.errName);
    if (!category.trim()) return setError(t.errCategory);
    if (!description.trim()) return setError(t.errDescription);
    const costCents = cost.trim() ? parsePriceToCents(cost) : null;
    if (cost.trim() && costCents === null) return setError('Custo inválido. Use o formato 159,90.');
    let stockQuantity = 0;
    let stockGrams = 0;
    if (saleMode === 'UNIT') {
      const n = Number(stockQty);
      if (!Number.isInteger(n) || n < 0) return setError('Estoque inválido: informe um número inteiro de peças.');
      stockQuantity = n;
    } else {
      const g = /^[0.,\s]*$/.test(stockKg) ? 0 : kgToGrams(stockKg);
      if (g === null) return setError('Estoque inválido: informe os quilos, por exemplo 2,5.');
      stockGrams = g;
    }

    setSaving(true);
    try {
      setProgress(t.stepData);
      const payload = { name, description, priceCents, category, weight, dimensions, origin, featured, status, saleMode, stockQuantity, stockGrams, costCents };
      const product = productId
        ? await api<Product>(`/admin/products/${productId}`, { method: 'PATCH', json: { ...payload, expectedUpdatedAt: baseVersion.current }, ...nav })
        : await api<Product>('/admin/products', { method: 'POST', json: payload, ...nav });
      setProductId(product.id);
      setSlug(product.slug);
      baseVersion.current = product.updatedAt;

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
      router.push(href('/admin/products'));
    } catch (err) {
      const refused = err instanceof ApiError && err.code === 'PRODUCT_CHANGED'; // nothing was saved: the "kept" note would be wrong
      setError(errorText(err, m, t.unexpected) + ((productId || slug) && !refused ? ` ${t.keptNote}` : ''));
      setSaving(false);
      setProgress('');
    }
  }

  const opt = <span className="normal-case tracking-normal text-pearl/30">{t.optional}</span>;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={href('/admin/products')} className="text-sm text-pearl/50 transition-colors hover:text-gold-300">
            {t.back}
          </Link>
          <h1 className="mt-2 font-display text-4xl font-medium text-pearl sm:text-5xl">{initial ? t.titleEdit : t.titleNew}</h1>
        </div>
        {slug && (
          <a href={href(`/products/${slug}`)} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
            {t.viewOnSite.replace(' ↗', '')} <IconExternal className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Section n={1} title={t.sectionBasics}>
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
                <label htmlFor="price" className="label">{saleMode === 'WEIGHT' ? 'Valor (R$) por quilo' : 'Valor (R$) por peça'}</label>
                <input id="price" className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t.pricePh} />
                <p className="mt-1.5 text-xs text-pearl/40">{t.priceHint}</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className="label">{t.description}</label>
                <textarea id="description" className="field min-h-40 resize-y" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} placeholder={t.descriptionPh} required />
                <p className="mt-1.5 text-right text-xs tabular-nums text-pearl/30">{description.length}/5000</p>
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
          </Section>

          <Section n={2} title="Venda e estoque" delay={0.05}>
            <div role="radiogroup" aria-label="Como este produto é vendido" className="grid gap-3 sm:grid-cols-2">
              {([
                ['UNIT', 'Por peça / quantidade', 'Cada unidade tem um valor. O estoque é contado em peças.'],
                ['WEIGHT', 'Por quilo (peso)', 'O valor é por kg. O estoque é contado em quilos e a venda é registrada em gramas.'],
              ] as const).map(([mode, title, hint]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={saleMode === mode}
                  onClick={() => setSaleMode(mode)}
                  className={`rounded-2xl border p-4 text-left transition-all ${saleMode === mode ? 'border-gold-400/60 bg-gold-400/10 shadow-[0_0_0_1px_rgb(224_189_122/0.25)]' : 'border-white/10 bg-white/[0.03] hover:border-gold-400/30'}`}
                >
                  <span className="block font-medium text-pearl">{title}</span>
                  <span className="mt-1 block text-xs leading-snug text-pearl/50">{hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {saleMode === 'UNIT' ? (
                <div>
                  <label htmlFor="stockQty" className="label">Estoque (peças)</label>
                  <input id="stockQty" className="field" inputMode="numeric" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="1" />
                </div>
              ) : (
                <div>
                  <label htmlFor="stockKg" className="label">Estoque (kg)</label>
                  <input id="stockKg" className="field" inputMode="decimal" value={stockKg} onChange={(e) => setStockKg(e.target.value)} placeholder="2,5" />
                </div>
              )}
              <div>
                <label htmlFor="cost" className="label">{saleMode === 'WEIGHT' ? 'Custo por quilo (R$)' : 'Custo por peça (R$)'} {opt}</label>
                <input id="cost" className="field" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="80,00" />
                <p className="mt-1.5 text-xs text-pearl/40">Só você vê. Usado para calcular lucro e margem no financeiro.</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-pearl/45">O estoque baixa sozinho a cada venda registrada. Quando zera, o produto aparece como vendido no site.</p>
          </Section>

          <Section n={3} title={t.sectionMedia} delay={0.08}>
            <ImageManager items={images} onChange={handleImages} onError={(msg) => toast(msg, 'error')} disabled={saving} />
          </Section>

          <Section n={4} title={t.sectionPublish} delay={0.16}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="status" className="label">{t.status}</label>
                <select id="status" className="field" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{m.admin.statusLong[s]}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={featured}
                onClick={() => setFeatured((v) => !v)}
                className={`flex items-center gap-4 self-end rounded-2xl border px-5 py-3.5 text-left transition-colors ${featured ? 'border-gold-400/50 bg-gold-400/10' : 'border-white/10 bg-white/[0.03] hover:border-gold-400/30'}`}
              >
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${featured ? 'bg-gold-400' : 'bg-white/15'}`}>
                  <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${featured ? 'right-0.5' : 'left-0.5'}`} />
                </span>
                <span>
                  <span className="block font-medium text-pearl">{t.featured}</span>
                  <span className="block text-xs text-pearl/45">{t.featuredHint}</span>
                </span>
              </button>
            </div>
          </Section>

          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <ProductPreview
            data={{
              name,
              category,
              priceCents: priceCentsLive,
              status,
              featured,
              description,
              weight,
              dimensions,
              origin,
              cover: images[0]?.url,
              photos: images.length,
              saleMode,
            }}
          />
          {/* Only an already-saved product has a stable slug for the QR link to point to. */}
          {slug && <QrCodeCard slug={slug} />}
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="glass-strong sticky bottom-4 z-30 mt-8 flex flex-wrap items-center gap-3 rounded-full p-2.5 pl-3">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? t.saving : initial ? t.save : t.create}
        </button>
        <Link href={href('/admin/products')} className="btn btn-ghost">{t.cancel}</Link>
        <AnimatePresence>
          {progress && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-gold-300"
              role="status"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
              {progress}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
