'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { countryName, flag } from '@/lib/countries';
import { PAYMENT_LABELS, STATUS_LABELS, brl, formatGrams } from '@/lib/format';
import { prepareImage } from '@/lib/image-prepare';
import type { Sale, SaleStatus } from '@/lib/types';
import { IconCheck, IconGem, IconImage, IconTrash, IconTruck } from './AdminIcons';
import { ConfirmDialog } from './ConfirmDialog';
import { STATUS_STYLE, fmtDate } from './SalesPage';
import { useToast } from './Toast';

const NEXT_STEP: Partial<Record<SaleStatus, { to: SaleStatus; label: string }>> = {
  PENDING: { to: 'PAID', label: 'Marcar como paga' },
  PAID: { to: 'SHIPPED', label: 'Marcar como enviada' },
  SHIPPED: { to: 'DELIVERED', label: 'Marcar como entregue' },
};

function Block({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-strong rounded-3xl p-6 ${className}`}>
      <h2 className="font-display text-2xl text-pearl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SaleDetail({ id }: { id: string }) {
  const { m, href } = useI18n();
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function apply(s: Sale) {
    setSale(s);
    setTracking(s.trackingCode ?? '');
    setMethod(s.shippingMethod ?? '');
    setNotes(s.notes ?? '');
  }

  useEffect(() => {
    api<Sale>(`/admin/sales/${encodeURIComponent(id)}`, nav)
      .then(apply)
      .catch((e) => setError(errorText(e, m, 'Não foi possível carregar a venda.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(data: Record<string, unknown>, ok: string, stockChanged = false) {
    setBusy(true);
    try {
      const s = await api<Sale>(`/admin/sales/${id}`, { method: 'PATCH', json: data, ...nav });
      apply(s);
      if (stockChanged) await revalidateCatalog();
      toast(ok);
    } catch (e) {
      toast(errorText(e, m, 'Não foi possível salvar.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos(list: FileList | null) {
    if (!list || !sale) return;
    for (const f of Array.from(list)) {
      try {
        const prepared = await prepareImage(f, m.admin.images);
        const fd = new FormData();
        fd.append('file', prepared);
        await api(`/admin/sales/${id}/photos`, { method: 'POST', form: fd, ...nav });
      } catch (e) {
        toast(e instanceof Error && !('status' in e) ? e.message : errorText(e, m, 'Não foi possível enviar a foto.'), 'error');
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    apply(await api<Sale>(`/admin/sales/${id}`, nav));
  }

  async function removePhoto(photoId: string) {
    try {
      await api(`/admin/sales/${id}/photos/${photoId}`, { method: 'DELETE', ...nav });
      apply(await api<Sale>(`/admin/sales/${id}`, nav));
    } catch (e) {
      toast(errorText(e, m, 'Não foi possível remover a foto.'), 'error');
    }
  }

  if (error) {
    return (
      <div className="glass rounded-3xl p-10 text-center">
        <p className="font-display text-xl font-semibold text-pearl">{error}</p>
        <Link href={href('/admin/sales')} className="btn btn-ghost mt-6">← Voltar às vendas</Link>
      </div>
    );
  }
  if (!sale) return <div className="skeleton mx-auto h-64 max-w-3xl" aria-busy="true" />;

  const step = NEXT_STEP[sale.status];
  const cancelled = sale.status === 'CANCELLED';
  const addr = sale.shipTo;
  const dirty = tracking !== (sale.trackingCode ?? '') || method !== (sale.shippingMethod ?? '') || notes !== (sale.notes ?? '');

  return (
    <div>
      <Link href={href('/admin/sales')} className="text-sm text-pearl/50 transition-colors hover:text-gold-300">← Voltar às vendas</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pearl sm:text-3xl">Venda #{sale.number}</h1>
          <p className="mt-2 text-pearl/55">{fmtDate(sale.soldAt)} · {PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</p>
        </div>
        <span className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${STATUS_STYLE[sale.status]}`}>{STATUS_LABELS[sale.status]}</span>
      </div>

      {!cancelled && (
        <div className="mt-6 flex flex-wrap gap-3">
          {step && (
            <button className="btn btn-primary" disabled={busy} onClick={() => patch({ status: step.to, ...(step.to === 'SHIPPED' && tracking ? { trackingCode: tracking } : {}) }, `Venda #${sale.number}: ${STATUS_LABELS[step.to].toLowerCase()}.`)}>
              <IconCheck className="h-4 w-4" /> {step.label}
            </button>
          )}
          <button className="btn btn-danger" disabled={busy} onClick={() => setCancelOpen(true)}>Cancelar venda</button>
        </div>
      )}
      {cancelled && <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-pearl/60">Esta venda foi cancelada: o estoque voltou e ela não entra no financeiro.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Block title="Itens">
            <ul className="divide-y divide-white/[0.06]">
              {sale.items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 py-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-navy-900">
                    {it.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-gold-400/40"><IconGem /></span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl text-pearl">{it.productName}</p>
                    <p className="text-xs text-pearl/45">
                      {it.category} · {it.mode === 'WEIGHT' ? `${formatGrams(it.quantity)} × ${brl(it.unitPriceCents)}/kg` : `${it.quantity} × ${brl(it.unitPriceCents)}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-gold-300">{brl(it.totalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-pearl/55">Subtotal</dt><dd className="tabular-nums text-pearl">{brl(sale.subtotalCents)}</dd></div>
              {sale.discountCents > 0 && <div className="flex justify-between"><dt className="text-pearl/55">Desconto</dt><dd className="tabular-nums text-pearl">− {brl(sale.discountCents)}</dd></div>}
              <div className="flex justify-between"><dt className="text-pearl/55">Frete</dt><dd className="tabular-nums text-pearl">{brl(sale.shippingCostCents)}</dd></div>
              <div className="flex items-baseline justify-between pt-1"><dt className="font-semibold text-pearl">Total</dt><dd className="font-display text-3xl tabular-nums text-gold-300">{brl(sale.totalCents)}</dd></div>
            </dl>
          </Block>

          <Block title="Fotos">
            <div className="flex flex-wrap gap-3">
              {sale.photos.map((p) => (
                <div key={p.id} className="group relative h-28 w-28 overflow-hidden rounded-2xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="Foto da venda" className="h-full w-full object-cover" />
                  <button type="button" aria-label="Remover foto" onClick={() => removePhoto(p.id)} className="absolute inset-0 grid place-items-center bg-navy-950/70 text-red-200 opacity-0 transition-opacity group-hover:opacity-100"><IconTrash className="h-5 w-5" /></button>
                </div>
              ))}
              {sale.photos.length < 6 && (
                <button type="button" onClick={() => fileRef.current?.click()} className="grid h-28 w-28 place-items-center rounded-2xl border-2 border-dashed border-white/15 text-center text-xs text-pearl/50 transition-colors hover:border-gold-400/60 hover:text-gold-300">
                  <span><IconImage className="mx-auto mb-1 h-6 w-6" />Adicionar foto</span>
                </button>
              )}
            </div>
            {sale.photos.length === 0 && <p className="mt-3 text-sm text-pearl/45">Opcional: foto da pedra vendida, da embalagem ou do comprovante de envio.</p>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void addPhotos(e.target.files)} />
          </Block>
        </div>

        <div className="space-y-6">
          <Block title="Cliente">
            <p className="font-medium text-pearl">{sale.customerName}</p>
            {sale.customerId && <Link href={href('/admin/customers')} className="text-xs text-gold-300 hover:text-gold-400">Ver clientes →</Link>}
            {addr ? (
              <address className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm not-italic leading-relaxed text-pearl/75">
                {addr.recipient && <span className="block font-medium text-pearl">{addr.recipient}</span>}
                {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                {addr.city}{addr.region ? ` — ${addr.region}` : ''} {addr.postalCode}<br />
                <span className="mt-1 block text-pearl">{flag(addr.country)} {countryName(addr.country)}</span>
              </address>
            ) : (
              <p className="mt-3 text-sm text-pearl/45">Sem endereço registrado.</p>
            )}
          </Block>

          <Block title="Envio e observações">
            <div className="space-y-4">
              <div>
                <label htmlFor="d-method" className="label">Método de envio</label>
                <input id="d-method" className="field" maxLength={60} value={method} onChange={(e) => setMethod(e.target.value)} />
              </div>
              <div>
                <label htmlFor="d-track" className="label flex items-center gap-1.5"><IconTruck className="h-3.5 w-3.5" /> Código de rastreio</label>
                <input id="d-track" className="field font-mono" maxLength={80} value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </div>
              <div>
                <label htmlFor="d-notes" className="label">Observações</label>
                <textarea id="d-notes" className="field min-h-24 resize-y" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {sale.clickRef && <p className="text-xs text-pearl/45">Código Ref do WhatsApp: <span className="font-mono text-gold-300">{sale.clickRef}</span></p>}
              <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary btn-sm" disabled={busy || !dirty || cancelled} onClick={() => patch({ trackingCode: tracking, shippingMethod: method, notes }, 'Venda atualizada.')}>
                Salvar alterações
              </motion.button>
            </div>
          </Block>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar esta venda?"
        message="O estoque das peças volta e a venda deixa de contar no financeiro. Essa ação não pode ser desfeita (registre uma nova venda se precisar)."
        confirmLabel="Cancelar venda"
        loadingLabel="Cancelando…"
        loading={busy}
        onConfirm={async () => {
          await patch({ status: 'CANCELLED' }, 'Venda cancelada e estoque devolvido.', true);
          setCancelOpen(false);
        }}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
