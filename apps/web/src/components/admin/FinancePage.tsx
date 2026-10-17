'use client';

import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, errorText } from '@/lib/client-api';
import { countryName, flag } from '@/lib/countries';
import { PAYMENT_LABELS, SOURCE_LABELS, brl, usd, formatGrams } from '@/lib/format';
import { useFx } from '@/lib/useFx';
import type { ClicksSummary, FinanceSummary } from '@/lib/types';
import { IconChart, IconCheck, IconGem, IconSparkle, IconStar, IconTruck, IconCart } from './AdminIcons';
import { AreaChart, DonutChart, Funnel, HBars } from './charts';
import { useToast } from './Toast';

const RANGES = [
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: '365', label: '1 ano' },
  { key: 'all', label: 'Tudo' },
] as const;

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item: Variants = { hidden: { opacity: 0, y: 20, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };
const COLORS = ['#e0bd7a', '#6e9be0', '#a37bff', '#5fd0a8', '#f08fa9', '#7d8aa6', '#efd9a8', '#4f86e0'];

function Kpi({ icon, label, children, note, accent }: { icon: ReactNode; label: string; children: ReactNode; note?: ReactNode; accent?: boolean }) {
  return (
    <motion.div variants={item}>
      <div className={`relative glass-strong h-full rounded-3xl p-5 ${accent ? 'gold-border' : ''}`}>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">{icon}</span>
        <p className="mt-4 font-display text-2xl font-semibold leading-none tabular-nums text-pearl sm:text-3xl">{children}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-pearl/45">{label}</p>
        {note && <div className="mt-2 text-xs">{note}</div>}
      </div>
    </motion.div>
  );
}

function Panel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={item} className={`glass-strong rounded-3xl p-6 ${className}`}>
      <h2 className="font-display text-2xl text-pearl">{title}</h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

const fmtLabel = (date: string, perDay: boolean) => {
  const d = new Date(perDay ? `${date}T12:00:00` : `${date}-01T12:00:00`);
  return perDay ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
};

export function FinancePage() {
  const { m, href } = useI18n();
  const toast = useToast();
  const nav = { homePath: href('/'), changePasswordPath: href('/admin/change-password') };
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('30');
  const [fin, setFin] = useState<FinanceSummary | null>(null);
  const [clicks, setClicks] = useState<ClicksSummary | null>(null);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');
  const [confirming, setConfirming] = useState(false);
  // money is stored in dollars; "R$" shows the same numbers converted at the current rate
  const fx = useFx();
  const [inReais, setInReais] = useState(false);
  const money = (cents: number) => (inReais && fx ? brl(Math.round(cents * fx.rate)) : usd(cents));

  const load = useCallback(() => {
    setError('');
    const days = range === 'all' ? 365 : Number(range);
    Promise.all([
      api<FinanceSummary>(`/admin/finance/summary?range=${range}`, nav),
      api<ClicksSummary>(`/admin/analytics/clicks?days=${days}`, nav),
    ])
      .then(([f, c]) => {
        setFin(f);
        setClicks(c);
      })
      .catch((e) => setError(errorText(e, m, 'Não foi possível carregar o financeiro.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, m]);
  useEffect(load, [load]);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setConfirming(true);
    try {
      const r = await api<{ alreadyConfirmed: boolean; source: string }>('/admin/analytics/confirm', { method: 'POST', json: { ref: ref.trim().toUpperCase() }, ...nav });
      toast(r.alreadyConfirmed ? 'Essa conversa já estava confirmada.' : `Conversa confirmada (origem: ${SOURCE_LABELS[r.source] ?? r.source}).`);
      setRef('');
      load();
    } catch (err) {
      toast(errorText(err, m, 'Não foi possível confirmar.'), 'error');
    } finally {
      setConfirming(false);
    }
  }

  if (error) return <p role="alert" className="glass rounded-3xl px-6 py-5 text-sm text-red-200">{error}</p>;

  const delta = fin?.previous && fin.previous.revenueCents > 0 ? Math.round(((fin.revenueCents - fin.previous.revenueCents) / fin.previous.revenueCents) * 100) : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Financeiro</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-pearl sm:text-3xl">Como está o negócio</h1>
          <p className="mt-3 max-w-xl text-pearl/55">Faturamento, lucro, produtos e países que mais vendem, e quantos cliques no WhatsApp viraram venda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {fx && (
          <div role="group" aria-label="Moeda" className="glass inline-flex gap-1 rounded-lg p-1">
            {([['USD', 'US$', false], ['BRL', 'R$', true]] as const).map(([k, label, reais]) => (
              <button key={k} type="button" aria-pressed={inReais === reais} onClick={() => setInReais(reais)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${inReais === reais ? 'bg-gold-400 text-navy-950' : 'text-pearl/65 hover:text-pearl'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div role="tablist" className="glass inline-flex flex-wrap gap-1 rounded-lg p-1">
          {RANGES.map((r) => (
            <button key={r.key} role="tab" aria-selected={range === r.key} onClick={() => setRange(r.key)} className={`relative whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${range === r.key ? 'text-navy-950' : 'text-pearl/65 hover:text-pearl'}`}>
              {range === r.key && <motion.span layoutId="fin-range" className="absolute inset-0 rounded-md bg-gold-400" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
        </div>
      </div>

      {!fin || !clicks ? (
        <div className="mt-8 space-y-6" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40" />)}</div>
          <div className="skeleton h-72" />
        </div>
      ) : (
        <motion.div key={range} variants={container} initial="hidden" animate="show" className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi accent icon={<IconCart />} label="Faturamento" note={delta !== null ? <span className={delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs. período anterior</span> : <span className="text-pearl/35">sem período anterior</span>}>
              {money(Math.round(fin.revenueCents))}
            </Kpi>
            <Kpi icon={<IconChart />} label="Lucro" note={fin.marginPct !== null ? <span className="text-pearl/55">margem {fin.marginPct.toLocaleString('pt-BR')}%{fin.costCoveragePct < 100 && <span className="text-amber-300/80"> · custo em {fin.costCoveragePct}% das vendas</span>}</span> : <span className="text-amber-300/80">cadastre o custo dos produtos</span>}>
              {money(Math.round(fin.profitCents))}
            </Kpi>
            <Kpi icon={<IconGem />} label="Pedidos" note={<span className="text-pearl/55">ticket médio {money(fin.averageTicketCents)}</span>}>
              {fin.orders.toLocaleString('pt-BR')}
            </Kpi>
            <Kpi icon={<IconTruck />} label="Frete cobrado" note={<span className="text-pearl/55">{fin.units} peças · {formatGrams(fin.grams)} vendidos</span>}>
              {money(Math.round(fin.shippingCents))}
            </Kpi>
          </div>

          <Panel title="Faturamento no período">
            {fin.orders === 0 ? (
              <p className="py-10 text-center text-pearl/45">Nenhuma venda paga neste período.</p>
            ) : (
              <AreaChart
                points={fin.series.map((s) => ({ label: fmtLabel(s.date, fin.perDay), value: s.revenueCents, sub: `${s.orders} ${s.orders === 1 ? 'pedido' : 'pedidos'}` }))}
                format={money}
              />
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Por categoria">
              {fin.byCategory.length === 0 ? <p className="text-sm text-pearl/45">Sem vendas.</p> : (
                <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                  <DonutChart slices={fin.byCategory.map((c, i) => ({ label: c.name, value: c.revenueCents, color: COLORS[i % COLORS.length] }))} center={<span className="font-display text-2xl text-pearl">{fin.byCategory.length}<span className="block text-[0.65rem] font-sans uppercase tracking-wider text-pearl/40">categorias</span></span>} />
                  <ul className="space-y-2.5 text-sm">
                    {fin.byCategory.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-2.5">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 truncate text-pearl/75">{c.name}</span>
                        <span className="tabular-nums text-pearl/60">{money(c.revenueCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <Panel title="Pedras que mais vendem">
              {fin.topProducts.length === 0 ? <p className="text-sm text-pearl/45">Sem vendas.</p> : (
                <HBars rows={fin.topProducts.map((p) => ({ label: p.name, value: p.revenueCents, note: p.grams > 0 ? formatGrams(p.grams) : `${p.units} un.` }))} format={money} />
              )}
            </Panel>

            <Panel title="Países (envio para o mundo)">
              {fin.byCountry.length === 0 ? <p className="text-sm text-pearl/45">Sem vendas.</p> : (
                <HBars rows={fin.byCountry.map((c) => ({ label: `${flag(c.country)} ${c.country === '—' ? 'Sem endereço' : countryName(c.country)}`, value: c.revenueCents, note: `${c.orders} ${c.orders === 1 ? 'pedido' : 'pedidos'}` }))} format={money} />
              )}
            </Panel>

            <Panel title="Formas de pagamento">
              {fin.byPayment.length === 0 ? <p className="text-sm text-pearl/45">Sem vendas.</p> : (
                <HBars rows={fin.byPayment.map((p) => ({ label: PAYMENT_LABELS[p.method] ?? p.method, value: p.revenueCents, note: `${p.orders}×` }))} format={money} />
              )}
            </Panel>
          </div>

          {/* funnel + WhatsApp analytics */}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Panel title="Do clique no WhatsApp até a venda">
              <Funnel
                steps={[
                  { label: 'Cliques nos botões do WhatsApp', value: fin.funnel.clicks, hint: 'Contados no site (não guardamos dados pessoais).' },
                  { label: 'Conversas confirmadas', value: fin.funnel.confirmed, hint: 'Você confirma digitando o código “Ref” da mensagem, ou automaticamente ao registrar a venda com o código.' },
                  { label: 'Vendas registradas', value: fin.funnel.sales, hint: `${fin.funnel.salesFromClicks} delas ligadas a um código Ref.` },
                ]}
              />
              <p className="mt-5 text-xs leading-relaxed text-pearl/40">
                O site só consegue contar o clique: depois que o WhatsApp abre, ele não sabe se a mensagem foi enviada. Por isso a confirmação é feita pelo código “Ref” que vai na mensagem do cliente.
              </p>
              <form onSubmit={confirm} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="min-w-40 flex-1">
                  <label htmlFor="ref-confirm" className="label">Confirmar conversa pelo código Ref</label>
                  <input id="ref-confirm" className="field font-mono uppercase" maxLength={6} value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="K7M2QX" />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={confirming || ref.trim().length !== 6}>{confirming ? 'Confirmando…' : <><IconCheck className="h-4 w-4" /> Confirmar</>}</button>
              </form>
            </Panel>

            <Panel title="Cliques por botão">
              {clicks.total === 0 ? (
                <p className="text-sm text-pearl/45">Ainda não houve cliques neste período.</p>
              ) : (
                <>
                  <HBars rows={clicks.bySource.map((s) => ({ label: SOURCE_LABELS[s.source] ?? s.source, value: s.count }))} format={(n) => `${n}`} />
                  {clicks.topProducts.length > 0 && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <p className="label flex items-center gap-1.5"><IconStar className="h-3.5 w-3.5" /> Produtos mais clicados</p>
                      <ul className="space-y-2 text-sm">
                        {clicks.topProducts.map((p) => (
                          <li key={p.slug} className="flex justify-between gap-3"><span className="truncate text-pearl/75">{p.name}</span><span className="tabular-nums text-gold-300">{p.count}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>

          <AnimatePresence>
            {fin.costCoveragePct < 100 && fin.revenueCents > 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-5 py-4 text-sm text-amber-200/90">
                <IconSparkle className="mt-0.5 h-4 w-4 shrink-0" /> Só {fin.costCoveragePct}% do faturamento tem custo cadastrado, então lucro e margem estão parciais. Cadastre o custo nos produtos para ver o lucro real.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
