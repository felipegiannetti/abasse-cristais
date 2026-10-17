'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { countryName, flag } from '@/lib/countries';
import { STATUS_LABELS, brl, formatGrams } from '@/lib/format';
import type { Customer } from '@/lib/types';
import { IconEdit, IconPlus, IconSearch, IconShield, IconTrash } from './AdminIcons';
import { AddressFields, addressComplete, addressFilled, emptyAddress, type AddressForm } from './AddressFields';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
import { STATUS_STYLE, fmtDate } from './SalesPage';
import { useToast } from './Toast';

type Dialog = { kind: 'edit'; customer: Customer | null } | { kind: 'history'; customer: Customer } | { kind: 'erase'; customer: Customer } | null;

const PAGE_SIZE = 15;

export function CustomersPage() {
  const { m, href } = useI18n();
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  // form state (create / edit)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState<AddressForm>(emptyAddress());
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
        if (dq) qs.set('q', dq);
        const d = await api<{ items: Customer[]; total: number }>(`/admin/customers?${qs}`, nav);
        setItems(d.items);
        setTotal(d.total);
        setPage(p);
      } catch (e) {
        setError(errorText(e, m, 'Não foi possível carregar os clientes.'));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dq, m],
  );
  useEffect(() => {
    void load(1);
  }, [load]);

  const close = () => {
    if (busy) return;
    setDialog(null);
    setPassword('');
    setFormError('');
  };

  function openEdit(c: Customer | null) {
    setName(c?.name ?? '');
    setEmail(c?.email ?? '');
    setPhone(c?.phone ?? '');
    setNotes(c?.notes ?? '');
    setAddress({ recipient: '', line1: c?.addressLine1 ?? '', line2: c?.addressLine2 ?? '', city: c?.city ?? '', region: c?.region ?? '', postalCode: c?.postalCode ?? '', country: c?.country ?? 'BR' });
    setFormError('');
    setDialog({ kind: 'edit', customer: c });
  }

  async function openHistory(c: Customer) {
    setDialog({ kind: 'history', customer: c });
    try {
      const full = await api<Customer>(`/admin/customers/${c.id}`, nav);
      setDialog({ kind: 'history', customer: { ...c, ...full } });
    } catch (e) {
      toast(errorText(e, m, 'Não foi possível carregar o histórico.'), 'error');
    }
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    if (dialog?.kind !== 'edit') return;
    if (name.trim().length < 2) return setFormError('Informe o nome do cliente.');
    if (addressFilled(address) && !addressComplete(address)) return setFormError('Complete o endereço (endereço, cidade e país) ou deixe tudo em branco.');
    setBusy(true);
    setFormError('');
    try {
      const body = {
        name,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        addressLine1: address.line1 || null,
        addressLine2: address.line2 || null,
        city: address.city || null,
        region: address.region || null,
        postalCode: address.postalCode || null,
        country: addressComplete(address) ? address.country : null,
      };
      if (dialog.customer) await api(`/admin/customers/${dialog.customer.id}`, { method: 'PATCH', json: body, ...nav });
      else await api('/admin/customers', { method: 'POST', json: body, ...nav });
      toast(dialog.customer ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      setDialog(null);
      void load(page);
    } catch (err) {
      setFormError(errorText(err, m));
    } finally {
      setBusy(false);
    }
  }

  async function erase(e: FormEvent) {
    e.preventDefault();
    if (dialog?.kind !== 'erase') return;
    setBusy(true);
    setFormError('');
    try {
      await api(`/admin/customers/${dialog.customer.id}/erase`, { method: 'POST', json: { currentPassword: password }, ...nav });
      toast('Dados pessoais apagados. O histórico de vendas foi mantido de forma anônima.');
      setDialog(null);
      setPassword('');
      void load(page);
    } catch (err) {
      setFormError(errorText(err, m));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Clientes</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-pearl sm:text-3xl">Quem compra de você</h1>
          <p className="mt-3 max-w-xl text-pearl/55">Endereço, contato e todo o histórico de compras de cada cliente, no Brasil e no mundo.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openEdit(null)}><IconPlus className="h-4 w-4" /> Novo cliente</button>
      </div>

      <div className="relative mt-8 max-w-md">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pearl/40" />
        <input className="field !pl-10" placeholder="Buscar por nome, e-mail, telefone ou cidade…" aria-label="Buscar clientes" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</p>}
      <p className="mt-6 text-sm text-pearl/45" aria-live="polite">{loading && items.length === 0 ? 'Carregando…' : `${total} ${total === 1 ? 'cliente' : 'clientes'}`}</p>

      {loading && items.length === 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-44" />)}</div>
      )}

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {items.map((c, i) => (
            <motion.li key={c.id} layout initial={{ opacity: 0, y: 22, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.45, delay: Math.min(i, 8) * 0.04 }}>
              <div className="relative glass-strong h-full rounded-3xl p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-400 font-display text-2xl font-semibold uppercase text-navy-950">{c.name.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-2xl text-pearl">{c.name}</p>
                    <p className="truncate text-xs text-pearl/45">{c.country ? `${flag(c.country)} ${[c.city, countryName(c.country)].filter(Boolean).join(', ')}` : 'Sem endereço'}</p>
                  </div>
                </div>
                <p className="mt-3 truncate text-sm text-pearl/55">{[c.email, c.phone].filter(Boolean).join(' · ') || 'Sem contato'}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  <div><p className="text-xs uppercase tracking-wider text-pearl/40">Pedidos</p><p className="font-display text-2xl tabular-nums text-pearl">{c.orders ?? 0}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-pearl/40">Total gasto</p><p className="font-display text-2xl tabular-nums text-gold-300">{brl(c.spentCents ?? 0)}</p></div>
                </div>
                <p className="mt-2 text-xs text-pearl/40">{c.lastPurchaseAt ? `Última compra em ${fmtDate(c.lastPurchaseAt)}` : 'Ainda não comprou'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => openHistory(c)}>Histórico</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><IconEdit className="h-4 w-4" /> Editar</button>
                  <button className="btn btn-danger btn-sm" aria-label={`Apagar dados de ${c.name}`} title="Apagar dados pessoais (LGPD)" onClick={() => { setPassword(''); setFormError(''); setDialog({ kind: 'erase', customer: c }); }}><IconTrash className="h-4 w-4" /></button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!loading && items.length === 0 && !error && (
        <div className="glass-strong gold-border mt-4 rounded-3xl px-6 py-16 text-center">
          <p className="font-display text-2xl font-semibold text-pearl">{dq ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}</p>
          {!dq && <p className="mt-2 text-pearl/55">Os clientes são cadastrados ao registrar uma venda, ou pelo botão “Novo cliente”.</p>}
        </div>
      )}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} loading={loading} onChange={(p) => void load(p)} />

      {/* create / edit */}
      <Modal open={dialog?.kind === 'edit'} onClose={close} title={dialog?.kind === 'edit' && dialog.customer ? 'Editar cliente' : 'Novo cliente'} busy={busy} wide>
        <form onSubmit={saveCustomer} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="c-name" className="label">Nome</label><input id="c-name" className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
            <div><label htmlFor="c-email" className="label">E-mail</label><input id="c-email" type="email" className="field" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label htmlFor="c-phone" className="label">Telefone / WhatsApp</label><input id="c-phone" className="field" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="label">Endereço de entrega</p>
            <AddressFields value={address} onChange={setAddress} idPrefix="cust" showRecipient={false} />
          </div>
          <div><label htmlFor="c-notes" className="label">Observações</label><textarea id="c-notes" className="field min-h-20 resize-y" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {formError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{formError}</p>}
          <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={busy}>Cancelar</button><button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
        </form>
      </Modal>

      {/* history */}
      <Modal open={dialog?.kind === 'history'} onClose={close} title={dialog?.kind === 'history' ? `Histórico de ${dialog.customer.name}` : ''} wide>
        {dialog?.kind === 'history' && (
          <div>
            {!dialog.customer.sales ? (
              <div className="skeleton h-24" />
            ) : dialog.customer.sales.length === 0 ? (
              <p className="py-6 text-center text-pearl/50">Nenhuma compra registrada.</p>
            ) : (
              <ul className="max-h-[50vh] divide-y divide-white/[0.06] overflow-y-auto">
                {dialog.customer.sales.map((s) => (
                  <li key={s.id}>
                    <Link href={href(`/admin/sales/${s.id}`)} className="flex items-center gap-3 py-3 transition-colors hover:text-gold-300">
                      <span className="w-14 font-display text-lg text-gold-300">#{s.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-pearl">{s.items.map((i) => `${i.productName} ${i.mode === 'WEIGHT' ? formatGrams(i.quantity) : `×${i.quantity}`}`).join(' · ')}</span>
                        <span className="text-xs text-pearl/45">{fmtDate(s.soldAt)}{s.shippingMethod ? ` · ${s.shippingMethod}` : ''}{s.trackingCode ? ` · ${s.trackingCode}` : ''}</span>
                      </span>
                      <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status]}`}>{STATUS_LABELS[s.status]}</span>
                      <span className="w-24 text-right text-sm font-semibold tabular-nums text-pearl">{brl(s.totalCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* erase personal data */}
      <Modal open={dialog?.kind === 'erase'} onClose={close} title={dialog?.kind === 'erase' ? `Apagar dados de ${dialog.customer.name}?` : ''} busy={busy}>
        <form onSubmit={erase} className="space-y-4">
          <p className="text-sm text-pearl/60">Remove nome, contato e endereço (LGPD/GDPR). As vendas continuam no financeiro, mas anônimas. Não dá para desfazer.</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-pearl"><IconShield className="h-4 w-4 text-gold-300" /> Confirme que é você</p>
            <label htmlFor="er-pw" className="label mt-3">Sua senha</label>
            <input id="er-pw" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          {formError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{formError}</p>}
          <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={busy}>Cancelar</button><button type="submit" className="btn btn-danger btn-sm" disabled={busy || !password}>{busy ? 'Apagando…' : 'Apagar dados'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
