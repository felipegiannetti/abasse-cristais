'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { revalidateCatalog } from '@/app/actions';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { centsToInput, formatGrams, kgToGrams, parsePriceToCents, PAYMENT_LABELS, brl } from '@/lib/format';
import { prepareImage } from '@/lib/image-prepare';
import type { Customer, Product, Sale } from '@/lib/types';
import { IconCheck, IconGem, IconImage, IconPlus, IconSearch, IconTrash, IconTruck } from './AdminIcons';
import { AddressFields, addressComplete, addressFilled, emptyAddress, type AddressForm } from './AddressFields';
import { useToast } from './Toast';

interface Line {
  key: string;
  product: Product;
  qty: string;
  price: string;
}

const SHIPPING = ['Correios PAC', 'Correios SEDEX', 'Correios Internacional', 'DHL Express', 'FedEx', 'UPS', 'Retirada em mãos', 'Outro'];

function Card({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: n * 0.05, ease: [0.22, 1, 0.36, 1] }} style={{ zIndex: 10 - n }} className="glass-strong relative rounded-[1.75rem] p-6 sm:p-7">
      <h2 className="flex items-center gap-3 font-display text-2xl text-pearl">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-sans text-sm font-bold text-navy-950">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const lineQty = (l: Line): number | null => {
  if (l.product.saleMode === 'WEIGHT') return kgToGrams(l.qty);
  return /^\d+$/.test(l.qty.trim()) && Number(l.qty) > 0 ? Number(l.qty) : null;
};
const lineTotal = (l: Line): number => {
  const q = lineQty(l);
  const unit = parsePriceToCents(l.price);
  if (q === null || unit === null) return 0;
  return l.product.saleMode === 'WEIGHT' ? Math.round((unit * q) / 1000) : unit * q;
};
const stockOf = (p: Product) => (p.saleMode === 'WEIGHT' ? (p.stockGrams ?? 0) : (p.stockQuantity ?? 0));

export function SaleForm() {
  const router = useRouter();
  const toast = useToast();
  const { m, href } = useI18n();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };

  // items
  const [lines, setLines] = useState<Line[]>([]);
  const [pq, setPq] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // customer
  const [cMode, setCMode] = useState<'existing' | 'new'>('existing');
  const [cq, setCq] = useState('');
  const [cResults, setCResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [address, setAddress] = useState<AddressForm>(emptyAddress());

  // shipping & payment
  const [shipping, setShipping] = useState('Correios SEDEX');
  const [shippingOther, setShippingOther] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [tracking, setTracking] = useState('');
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('PIX');
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [soldAt, setSoldAt] = useState(nowLocal());
  const [clickRef, setClickRef] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<{ key: string; file: File; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // product search
  useEffect(() => {
    if (!pickerOpen) return;
    const t = setTimeout(() => {
      api<{ items: Product[] }>(`/admin/products?pageSize=8${pq.trim() ? `&q=${encodeURIComponent(pq.trim())}` : ''}`, nav)
        .then((d) => setResults(d.items))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pq, pickerOpen]);

  // customer search
  useEffect(() => {
    if (cMode !== 'existing') return;
    const t = setTimeout(() => {
      api<{ items: Customer[] }>(`/admin/customers?pageSize=6${cq.trim() ? `&q=${encodeURIComponent(cq.trim())}` : ''}`, nav)
        .then((d) => setCResults(d.items))
        .catch(() => setCResults([]));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cq, cMode]);

  function pickCustomer(c: Customer) {
    setCustomer(c);
    // prefill the delivery address from the customer's registered one
    setAddress({
      recipient: '',
      line1: c.addressLine1 ?? '',
      line2: c.addressLine2 ?? '',
      city: c.city ?? '',
      region: c.region ?? '',
      postalCode: c.postalCode ?? '',
      country: c.country ?? 'BR',
    });
  }

  function addProduct(p: Product) {
    setLines((cur) => [...cur, { key: crypto.randomUUID(), product: p, qty: p.saleMode === 'WEIGHT' ? '' : '1', price: centsToInput(p.priceCents, 'pt') }]);
    setPickerOpen(false);
    setPq('');
  }

  const subtotal = useMemo(() => lines.reduce((n, l) => n + lineTotal(l), 0), [lines]);
  const discountCents = discount.trim() ? (parsePriceToCents(discount) ?? 0) : 0;
  const shippingCents = shippingCost.trim() ? (parsePriceToCents(shippingCost) ?? 0) : 0;
  const total = Math.max(0, subtotal - discountCents) + shippingCents;
  const costEstimate = lines.reduce((n, l) => {
    const q = lineQty(l);
    const c = l.product.costCents;
    if (q === null || c == null) return n;
    return n + (l.product.saleMode === 'WEIGHT' ? Math.round((c * q) / 1000) : c * q);
  }, 0);
  const missingCost = lines.some((l) => l.product.costCents == null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!lines.length) return setError('Adicione pelo menos uma pedra à venda.');
    for (const l of lines) {
      if (lineQty(l) === null) return setError(`Informe a quantidade de “${l.product.name}”${l.product.saleMode === 'WEIGHT' ? ' em kg (ex.: 0,5)' : ''}.`);
      if (parsePriceToCents(l.price) === null) return setError(`Informe o valor de “${l.product.name}”.`);
      if ((lineQty(l) ?? 0) > stockOf(l.product)) return setError(`Estoque insuficiente de “${l.product.name}” (disponível: ${l.product.saleMode === 'WEIGHT' ? formatGrams(stockOf(l.product)) : stockOf(l.product)}).`);
    }
    if (cMode === 'existing' && !customer) return setError('Escolha o cliente (ou cadastre um novo).');
    if (cMode === 'new' && newName.trim().length < 2) return setError('Informe o nome do cliente.');
    if (addressFilled(address) && !addressComplete(address)) return setError('Complete o endereço de entrega (endereço, cidade e país) ou deixe tudo em branco.');
    if (discount.trim() && parsePriceToCents(discount) === null) return setError('Desconto inválido.');
    if (shippingCost.trim() && parsePriceToCents(shippingCost) === null) return setError('Valor do frete inválido.');
    if (clickRef.trim() && !/^[A-Za-z2-9]{6}$/.test(clickRef.trim())) return setError('O código de referência do WhatsApp tem 6 caracteres (letras e números 2–9).');

    const shipTo = addressComplete(address)
      ? { recipient: address.recipient || undefined, line1: address.line1, line2: address.line2 || undefined, city: address.city, region: address.region || undefined, postalCode: address.postalCode || undefined, country: address.country }
      : undefined;
    const payload = {
      soldAt: new Date(soldAt).toISOString(),
      status,
      ...(cMode === 'existing'
        ? { customerId: customer!.id }
        : {
            customer: {
              name: newName,
              email: newEmail || undefined,
              phone: newPhone || undefined,
              addressLine1: address.line1 || undefined,
              addressLine2: address.line2 || undefined,
              city: address.city || undefined,
              region: address.region || undefined,
              postalCode: address.postalCode || undefined,
              country: addressComplete(address) ? address.country : undefined,
            },
          }),
      shipTo,
      shippingMethod: (shipping === 'Outro' ? shippingOther : shipping) || undefined,
      shippingCostCents: shippingCents,
      trackingCode: tracking || undefined,
      paymentMethod: payment,
      discountCents,
      notes: notes || undefined,
      clickRef: clickRef.trim() || undefined,
      items: lines.map((l) => ({ productId: l.product.id, quantity: lineQty(l)!, unitPriceCents: parsePriceToCents(l.price)! })),
    };

    setSaving(true);
    try {
      setProgress('Registrando a venda…');
      const sale = await api<Sale>('/admin/sales', { method: 'POST', json: payload, ...nav });
      for (const [i, f] of files.entries()) {
        setProgress(`Enviando foto ${i + 1} de ${files.length}…`);
        try {
          const fd = new FormData();
          fd.append('file', f.file);
          await api(`/admin/sales/${sale.id}/photos`, { method: 'POST', form: fd, ...nav });
        } catch (err) {
          toast(errorText(err, m, 'Uma das fotos não foi enviada.'), 'error');
        }
      }
      await revalidateCatalog(); // stock and "sold" status changed on the public site
      toast(`Venda #${sale.number} registrada.`);
      router.push(href(`/admin/sales/${sale.id}`));
    } catch (err) {
      setError(errorText(err, m, 'Não foi possível registrar a venda.'));
      setSaving(false);
      setProgress('');
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list).slice(0, 6 - files.length)) {
      try {
        const prepared = await prepareImage(f, m.admin.images);
        setFiles((cur) => [...cur, { key: crypto.randomUUID(), file: prepared, url: URL.createObjectURL(prepared) }]);
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-8">
        <Link href={href('/admin/sales')} className="text-sm text-pearl/50 transition-colors hover:text-gold-300">← Voltar às vendas</Link>
        <h1 className="mt-2 font-display text-4xl font-medium text-pearl sm:text-5xl">Registrar venda</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* 1. items */}
          <Card n={1} title="O que foi vendido">
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {lines.map((l) => {
                  const w = l.product.saleMode === 'WEIGHT';
                  const q = lineQty(l);
                  const over = q !== null && q > stockOf(l.product);
                  return (
                    <motion.li key={l.key} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 24 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start gap-3">
                        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-navy-900">
                          {l.product.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.product.images[0].url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-gold-400/40"><IconGem /></span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-xl text-pearl">{l.product.name}</p>
                          <p className="text-xs text-pearl/45">
                            {w ? 'Vendido por quilo' : 'Vendido por peça'} · estoque {w ? formatGrams(l.product.stockGrams ?? 0) : `${l.product.stockQuantity ?? 0} un.`}
                          </p>
                        </div>
                        <button type="button" aria-label={`Remover ${l.product.name}`} onClick={() => setLines((c) => c.filter((x) => x.key !== l.key))} className="grid h-9 w-9 place-items-center rounded-full text-pearl/45 transition-colors hover:bg-red-500/15 hover:text-red-300">
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div>
                          <label className="label" htmlFor={`q-${l.key}`}>{w ? 'Peso (kg)' : 'Quantidade'}</label>
                          <input id={`q-${l.key}`} className={`field ${over ? '!border-red-400/60' : ''}`} inputMode={w ? 'decimal' : 'numeric'} value={l.qty} placeholder={w ? '0,5' : '1'} onChange={(e) => setLines((c) => c.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))} />
                          {over && <p className="mt-1 text-xs text-red-300">Acima do estoque.</p>}
                          {w && q !== null && <p className="mt-1 text-xs text-pearl/40">= {formatGrams(q)}</p>}
                        </div>
                        <div>
                          <label className="label" htmlFor={`p-${l.key}`}>{w ? 'Valor por kg (R$)' : 'Valor unitário (R$)'}</label>
                          <input id={`p-${l.key}`} className="field" inputMode="decimal" value={l.price} onChange={(e) => setLines((c) => c.map((x) => (x.key === l.key ? { ...x, price: e.target.value } : x)))} />
                        </div>
                        <p className="pb-3 text-right font-display text-2xl text-gold-300">{brl(lineTotal(l))}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <div className="relative mt-4">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pearl/40" />
              <input
                className="field !pl-11"
                placeholder="Buscar pedra para adicionar…"
                aria-label="Buscar pedra"
                value={pq}
                onFocus={() => setPickerOpen(true)}
                onChange={(e) => {
                  setPq(e.target.value);
                  setPickerOpen(true);
                }}
              />
              <AnimatePresence>
                {pickerOpen && (
                  <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-full z-20 mt-2 border border-gold-400/25 bg-navy-950 shadow-2xl shadow-black/60 max-h-80 overflow-y-auto rounded-2xl p-2">
                    {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-pearl/45">Nenhuma pedra encontrada.</li>}
                    {results.map((p) => {
                      const out = stockOf(p) <= 0;
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => addProduct(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gold-400/10">
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-navy-900">
                              {p.images[0] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-pearl">{p.name}</span>
                              <span className="block text-xs text-pearl/45">{p.category} · {p.saleMode === 'WEIGHT' ? 'por kg' : 'por peça'}</span>
                            </span>
                            <span className={`text-xs ${out ? 'text-red-300' : 'text-pearl/55'}`}>{out ? 'sem estoque' : `estoque ${p.saleMode === 'WEIGHT' ? formatGrams(p.stockGrams ?? 0) : p.stockQuantity}`}</span>
                          </button>
                        </li>
                      );
                    })}
                    <li className="px-3 pb-1 pt-2 text-right"><button type="button" onClick={() => setPickerOpen(false)} className="text-xs text-pearl/40 hover:text-pearl">fechar</button></li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* 2. customer */}
          <Card n={2} title="Quem comprou">
            <div role="tablist" className="glass inline-flex gap-1 rounded-full p-1">
              {([['existing', 'Cliente cadastrado'], ['new', 'Novo cliente']] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={cMode === k} onClick={() => setCMode(k)} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${cMode === k ? 'bg-gold-400/25 text-gold-300' : 'text-pearl/60 hover:text-pearl'}`}>
                  {label}
                </button>
              ))}
            </div>
            {cMode === 'existing' ? (
              <div className="mt-4">
                <input className="field" placeholder="Buscar por nome, e-mail, telefone ou cidade…" aria-label="Buscar cliente" value={cq} onChange={(e) => setCq(e.target.value)} />
                {customer && (
                  <p className="mt-3 flex items-center gap-2 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-2.5 text-sm text-gold-300">
                    <IconCheck className="h-4 w-4" /> {customer.name}
                    <button type="button" className="ml-auto text-xs text-pearl/50 hover:text-pearl" onClick={() => setCustomer(null)}>trocar</button>
                  </p>
                )}
                {!customer && (
                  <ul className="mt-3 space-y-1">
                    {cResults.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-2.5 text-left text-sm transition-colors hover:border-gold-400/40 hover:bg-gold-400/[0.06]">
                          <span className="font-medium text-pearl">{c.name}</span>
                          <span className="text-xs text-pearl/45">{[c.city, c.country].filter(Boolean).join(' · ') || c.email || ''}</span>
                        </button>
                      </li>
                    ))}
                    {cResults.length === 0 && <li className="px-2 py-3 text-sm text-pearl/45">Nenhum cliente encontrado. Use “Novo cliente”.</li>}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="nc-name" className="label">Nome</label>
                  <input id="nc-name" className="field" maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="nc-email" className="label">E-mail <span className="normal-case tracking-normal text-pearl/30">(opcional)</span></label>
                  <input id="nc-email" type="email" className="field" maxLength={160} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="nc-phone" className="label">Telefone / WhatsApp <span className="normal-case tracking-normal text-pearl/30">(opcional)</span></label>
                  <input id="nc-phone" className="field" maxLength={30} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
              </div>
            )}
          </Card>

          {/* 3. delivery */}
          <Card n={3} title="Entrega (envio para o mundo todo)">
            <AddressFields value={address} onChange={setAddress} idPrefix="ship" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sm" className="label">Método de envio</label>
                <select id="sm" className="field" value={shipping} onChange={(e) => setShipping(e.target.value)}>
                  {SHIPPING.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {shipping === 'Outro' ? (
                <div>
                  <label htmlFor="smo" className="label">Qual método?</label>
                  <input id="smo" className="field" maxLength={60} value={shippingOther} onChange={(e) => setShippingOther(e.target.value)} />
                </div>
              ) : (
                <div>
                  <label htmlFor="track" className="label">Código de rastreio <span className="normal-case tracking-normal text-pearl/30">(opcional)</span></label>
                  <input id="track" className="field font-mono" maxLength={80} value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </div>
              )}
              <div>
                <label htmlFor="sc" className="label">Frete cobrado (R$)</label>
                <input id="sc" className="field" inputMode="decimal" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </Card>

          {/* 4. payment */}
          <Card n={4} title="Pagamento e detalhes">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pay" className="label">Forma de pagamento</label>
                <select id="pay" className="field" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="st" className="label">Situação</label>
                <select id="st" className="field" value={status} onChange={(e) => setStatus(e.target.value as 'PAID' | 'PENDING')}>
                  <option value="PAID">Pago</option>
                  <option value="PENDING">Pendente (aguardando pagamento)</option>
                </select>
              </div>
              <div>
                <label htmlFor="disc" className="label">Desconto (R$)</label>
                <input id="disc" className="field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label htmlFor="date" className="label">Data da venda</label>
                <input id="date" type="datetime-local" className="field" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ref" className="label">Código Ref do WhatsApp <span className="normal-case tracking-normal text-pearl/30">(opcional)</span></label>
                <input id="ref" className="field font-mono uppercase" maxLength={6} value={clickRef} onChange={(e) => setClickRef(e.target.value.toUpperCase())} placeholder="K7M2QX" />
                <p className="mt-1.5 text-xs text-pearl/40">Está na mensagem que o cliente enviou (“Ref: …”). Liga esta venda ao clique no site.</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="notes" className="label">Observações</label>
                <textarea id="notes" className="field min-h-24 resize-y" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="mt-6">
              <p className="label">Fotos da pedra / do envio <span className="normal-case tracking-normal text-pearl/30">(opcional)</span></p>
              <div className="mt-2 flex flex-wrap gap-3">
                {files.map((f) => (
                  <div key={f.key} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                    <button type="button" aria-label="Remover foto" onClick={() => setFiles((c) => c.filter((x) => x.key !== f.key))} className="absolute inset-0 grid place-items-center bg-navy-950/70 text-red-200 opacity-0 transition-opacity group-hover:opacity-100"><IconTrash className="h-5 w-5" /></button>
                  </div>
                ))}
                {files.length < 6 && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-white/15 text-pearl/50 transition-colors hover:border-gold-400/60 hover:text-gold-300" aria-label="Adicionar foto">
                    <IconImage className="h-6 w-6" />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
            </div>
          </Card>

          <AnimatePresence>
            {error && (
              <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* summary */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="glass-strong gold-border rounded-3xl p-6">
            <h3 className="font-display text-2xl text-pearl">Resumo</h3>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-pearl/55">Subtotal</dt><dd className="tabular-nums text-pearl">{brl(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-pearl/55">Desconto</dt><dd className="tabular-nums text-pearl">− {brl(discountCents)}</dd></div>
              <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-pearl/55"><IconTruck className="h-4 w-4" /> Frete</dt><dd className="tabular-nums text-pearl">{brl(shippingCents)}</dd></div>
              <div className="flex items-baseline justify-between border-t border-white/10 pt-3"><dt className="font-semibold text-pearl">Total</dt><dd className="font-display text-3xl text-gold-300 tabular-nums">{brl(total)}</dd></div>
            </dl>
            {lines.length > 0 && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <div className="flex justify-between"><span className="text-pearl/55">Custo estimado</span><span className="tabular-nums text-pearl">{brl(costEstimate)}</span></div>
                <div className="mt-1.5 flex justify-between"><span className="text-pearl/55">Lucro estimado</span><span className={`tabular-nums font-semibold ${subtotal - discountCents - costEstimate >= 0 ? 'text-gold-300' : 'text-red-300'}`}>{brl(subtotal - discountCents - costEstimate)}</span></div>
                {missingCost && <p className="mt-2 text-xs text-amber-300/80">Alguma pedra está sem custo cadastrado: o lucro real é menor que o estimado.</p>}
              </div>
            )}
            <button type="submit" disabled={saving} className="btn btn-primary mt-6 w-full">
              {saving ? 'Registrando…' : (<><IconPlus className="h-4 w-4" /> Registrar venda</>)}
            </button>
            {progress && (
              <p role="status" className="mt-3 flex items-center gap-2 text-sm text-gold-300">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" /> {progress}
              </p>
            )}
            <p className="mt-4 text-xs text-pearl/40">Os totais são recalculados no servidor. O estoque é baixado automaticamente.</p>
          </div>
        </aside>
      </div>
    </form>
  );
}
