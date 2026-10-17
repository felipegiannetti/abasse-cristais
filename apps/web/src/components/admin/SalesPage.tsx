'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { downloadFile } from '@/lib/download';
import { flag } from '@/lib/countries';
import { STATUS_LABELS, usd, formatGrams } from '@/lib/format';
import type { Sale, SaleStatus } from '@/lib/types';
import { IconPlus, IconSearch, IconTruck } from './AdminIcons';
import { Pagination } from './Pagination';
import { useToast } from './Toast';

const PAGE_SIZE = 15;
const TABS: { key: '' | SaleStatus; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'PENDING', label: 'Pendentes' },
  { key: 'PAID', label: 'Pagas' },
  { key: 'SHIPPED', label: 'Enviadas' },
  { key: 'DELIVERED', label: 'Entregues' },
  { key: 'CANCELLED', label: 'Canceladas' },
];

export const STATUS_STYLE: Record<SaleStatus, string> = {
  PENDING: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  PAID: 'border-gold-400/40 bg-gold-400/15 text-gold-300',
  SHIPPED: 'border-sky/40 bg-sky/15 text-sky',
  DELIVERED: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200',
  CANCELLED: 'border-white/15 bg-white/5 text-pearl/45 line-through',
};

export const itemsSummary = (s: Pick<Sale, 'items'>) =>
  s.items.map((i) => `${i.productName} ${i.mode === 'WEIGHT' ? formatGrams(i.quantity) : `×${i.quantity}`}`).join(' · ');

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export function SalesPage() {
  const { m, href } = useI18n();
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };
  const [items, setItems] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | SaleStatus>('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  // period (yyyy-mm-dd, Brasília days) and product category
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [exporting, setExporting] = useState<'' | 'csv' | 'xlsx'>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<string[]>('/admin/products/categories', nav)
      .then(setCategories)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  /** The filters the list and the export share (days are Brasília days, UTC-3). */
  const filterParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (dq) qs.set('q', dq);
    if (from) qs.set('from', `${from}T00:00:00-03:00`);
    if (to) qs.set('to', `${to}T23:59:59.999-03:00`);
    if (category) qs.set('category', category);
    return qs;
  }, [status, dq, from, to, category]);
  const filtered = Boolean(status || dq || from || to || category);

  async function exportSales(format: 'csv' | 'xlsx') {
    setExporting(format);
    try {
      const qs = filterParams();
      qs.set('format', format);
      await downloadFile(`/admin/sales/export?${qs}`);
    } catch (e) {
      toast(errorText(e, m, 'Não foi possível exportar as vendas.'), 'error');
    } finally {
      setExporting('');
    }
  }

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError('');
      try {
        const qs = filterParams();
        qs.set('page', String(p));
        qs.set('pageSize', String(PAGE_SIZE));
        const d = await api<{ items: Sale[]; total: number }>(`/admin/sales?${qs}`, nav);
        setItems(d.items);
        setTotal(d.total);
        setPage(p);
      } catch (e) {
        setError(errorText(e, m, 'Não foi possível carregar as vendas.'));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterParams, m],
  );
  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Vendas</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-pearl sm:text-3xl">Registro de vendas</h1>
          <p className="mt-3 max-w-xl text-pearl/55">Cada venda baixa o estoque sozinha. Quem comprou, o que foi, quanto, e como foi enviado.</p>
        </div>
        <Link href={href('/admin/sales/new')} className="btn btn-primary">
          <IconPlus className="h-4 w-4" /> Registrar venda
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" className="glass inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg p-1">
          {TABS.map((tab) => {
            const on = status === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                role="tab"
                aria-selected={on}
                onClick={() => setStatus(tab.key)}
                className={`relative whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'text-navy-950' : 'text-pearl/65 hover:text-pearl'}`}
              >
                {on && (
                  <motion.span layoutId="sales-tab" className="absolute inset-0 rounded-md bg-gold-400" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="relative lg:w-80">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pearl/40" />
          <input className="field !pl-10" placeholder="Cliente, peça, nº ou código Ref…" aria-label="Buscar vendas" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* period, category and export */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sf-from" className="label">De</label>
          <input id="sf-from" type="date" className="field !w-auto !py-2 text-sm" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sf-to" className="label">Até</label>
          <input id="sf-to" type="date" className="field !w-auto !py-2 text-sm" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sf-cat" className="label">Categoria</label>
          <select id="sf-cat" className="field !w-auto !py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(from || to || category) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); setCategory(''); }}>Limpar filtros</button>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={exporting !== '' || total === 0} onClick={() => exportSales('csv')} title="Baixa as vendas filtradas em CSV (abre no Excel)">
            {exporting === 'csv' ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={exporting !== '' || total === 0} onClick={() => exportSales('xlsx')} title="Baixa as vendas filtradas em Excel (vendas e itens em abas separadas)">
            {exporting === 'xlsx' ? 'Exportando…' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</p>}

      <p className="mt-6 text-sm text-pearl/45" aria-live="polite">
        {loading && items.length === 0 ? 'Carregando…' : `${total} ${total === 1 ? 'venda' : 'vendas'}${filtered ? ' com os filtros atuais' : ''}`}
      </p>

      {loading && items.length === 0 && (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}
        </div>
      )}

      <ul className="mt-4 space-y-3">
        <AnimatePresence initial={false}>
          {items.map((s, i) => (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.03 }}
            >
              <Link
                href={href(`/admin/sales/${s.id}`)}
                className="glass-strong group grid gap-x-5 gap-y-3 rounded-2xl p-4 pr-5 transition-all hover:-translate-y-0.5 hover:border-gold-400/40 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-navy-900 font-display text-lg text-gold-300">
                    {s.items[0]?.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.items[0].cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      `#${s.number}`
                    )}
                  </span>
                  <div className="sm:hidden">
                    <p className="font-display text-xl text-pearl">#{s.number}</p>
                    <p className="text-xs text-pearl/45">{fmtDate(s.soldAt)}</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="hidden font-display text-xl text-pearl sm:inline">#{s.number}</span>
                    <span className="truncate font-medium text-pearl">
                      {flag(s.shipTo?.country)} {s.customerName}
                    </span>
                    <span className="hidden text-xs text-pearl/40 sm:inline">{fmtDate(s.soldAt)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-pearl/55">{itemsSummary(s)}</p>
                  {(s.shippingMethod || s.trackingCode) && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-pearl/40">
                      <IconTruck className="h-3.5 w-3.5" /> {s.shippingMethod}
                      {s.trackingCode && <span className="font-mono text-gold-300/80">{s.trackingCode}</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="font-display text-2xl text-gold-300">{usd(s.totalCents)}</span>
                  <span className={`rounded-md border px-3 py-1 text-xs font-semibold ${STATUS_STYLE[s.status]}`}>{STATUS_LABELS[s.status]}</span>
                </div>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!loading && items.length === 0 && !error && (
        <div className="glass-strong gold-border relative mt-4 overflow-hidden rounded-3xl px-6 py-16 text-center">
          <p className="font-display text-2xl font-semibold text-pearl">{status || dq ? 'Nenhuma venda encontrada' : 'Nenhuma venda registrada ainda'}</p>
          {!status && !dq && (
            <>
              <p className="mt-2 text-pearl/55">Registre a primeira venda para acompanhar estoque, clientes e financeiro.</p>
              <Link href={href('/admin/sales/new')} className="btn btn-primary mt-6"><IconPlus className="h-4 w-4" /> Registrar venda</Link>
            </>
          )}
        </div>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} loading={loading} onChange={(p) => void load(p)} />
    </div>
  );
}
