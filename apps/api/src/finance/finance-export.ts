import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { PAYMENT_LABEL, csvText } from '../sales/sales-export';
import type { FinanceService } from './finance.service';

/**
 * Finance report as CSV (flat, spreadsheet-friendly) or PDF (a printable one-pager-ish with the key numbers,
 * the revenue chart and the rankings). Money is stored in US dollars; `currency: 'BRL'` converts it with the
 * rate passed in (the caller decides which rate and says so in the report header).
 */
export type FinanceSummary = Awaited<ReturnType<FinanceService['summary']>>;

export interface ReportOptions {
  currency: 'USD' | 'BRL';
  /** reais per dollar; required when currency is BRL */
  rate: number | null;
  /** e.g. "cotação oficial do Banco Central (PTAX) de 16/10", shown next to the rate */
  rateNote: string;
  generatedAt: Date;
}

const RANGE_LABEL: Record<string, string> = { '7': 'Últimos 7 dias', '30': 'Últimos 30 dias', '90': 'Últimos 90 dias', '365': 'Último ano', all: 'Todo o período' };
const rangeLabel = (r: string) => RANGE_LABEL[r] ?? r;
const countryLabel = (c: string) => (c === '—' ? 'Sem endereço' : c);

/** cents in the stored currency (USD) → major units in the report currency */
const major = (cents: number, o: ReportOptions) => (o.currency === 'BRL' ? Math.round(cents * (o.rate ?? 1)) / 100 : cents / 100);
const symbol = (o: ReportOptions) => (o.currency === 'BRL' ? 'R$' : 'US$');
const brtStamp = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
const rateText = (o: ReportOptions) =>
  o.currency === 'BRL' && o.rate ? `US$ 1 = R$ ${o.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (${o.rateNote})` : '';

// ------------------------------------------------------------------------------------------------ CSV

/** Flat table: Seção;Item;Valor;Pedidos;Detalhe — one block per section, easy to filter or pivot. */
export function financeCsv(s: FinanceSummary, o: ReportOptions): string {
  const dec = (n: number, digits: number) => (digits === 0 ? String(n) : n.toFixed(digits).replace('.', ','));
  const lines = ['Seção;Item;Valor;Pedidos;Detalhe'];
  /** digits: 2 for money/percent, 0 for counts, 4 for the exchange rate */
  const add = (section: string, item: string, value: number | null, opts: { orders?: number; detail?: string; digits?: number } = {}) =>
    lines.push([csvText(section), csvText(item), value === null ? '' : dec(value, opts.digits ?? 2), opts.orders === undefined ? '' : String(opts.orders), csvText(opts.detail ?? '')].join(';'));

  add('Informações', 'Relatório', null, { detail: 'Abasse Crystal — financeiro' });
  add('Informações', 'Período', null, { detail: rangeLabel(s.range) });
  add('Informações', 'Moeda', null, { detail: o.currency === 'BRL' ? 'Reais (R$)' : 'Dólares (US$)' });
  if (o.currency === 'BRL') add('Informações', 'Cotação usada', o.rate, { digits: 4, detail: rateText(o) });
  add('Informações', 'Gerado em (Brasília)', null, { detail: brtStamp(o.generatedAt) });

  add('Resumo', `Faturamento (${symbol(o)})`, major(s.revenueCents, o), { orders: s.orders });
  add('Resumo', `Lucro (${symbol(o)})`, major(s.profitCents, o), { detail: s.marginPct === null ? 'margem não calculável (sem custos cadastrados)' : `margem ${dec(s.marginPct, 1)}%` });
  add('Resumo', `Custo das peças (${symbol(o)})`, major(s.costCents, o), { detail: `${s.costCoveragePct}% do faturamento tem custo cadastrado` });
  add('Resumo', `Ticket médio (${symbol(o)})`, major(s.averageTicketCents, o), { orders: s.orders });
  add('Resumo', `Frete cobrado (${symbol(o)})`, major(s.shippingCents, o));
  add('Resumo', 'Peças vendidas', s.units, { digits: 0, detail: 'unidades' });
  add('Resumo', 'Peso vendido', s.grams, { digits: 0, detail: 'gramas' });
  if (s.previous) add('Resumo', `Faturamento do período anterior (${symbol(o)})`, major(s.previous.revenueCents, o), { orders: s.previous.orders });

  for (const c of s.byCategory) add('Por categoria', c.name, major(c.revenueCents, o));
  for (const p of s.topProducts) add('Produtos mais vendidos', p.name, major(p.revenueCents, o), { orders: p.orders, detail: p.grams > 0 ? `${p.grams} g` : `${p.units} un.` });
  for (const c of s.byCountry) add('Por país', countryLabel(c.country), major(c.revenueCents, o), { orders: c.orders });
  for (const p of s.byPayment) add('Por forma de pagamento', PAYMENT_LABEL[p.method] ?? p.method, major(p.revenueCents, o), { orders: p.orders });
  for (const d of s.series) add(s.perDay ? 'Faturamento por dia' : 'Faturamento por mês', d.date, major(d.revenueCents, o), { orders: d.orders });
  add('Funil do WhatsApp', 'Cliques no WhatsApp', s.funnel.clicks, { digits: 0 });
  add('Funil do WhatsApp', 'Conversas confirmadas', s.funnel.confirmed, { digits: 0 });
  add('Funil do WhatsApp', 'Vendas no período', s.funnel.sales, { digits: 0 });
  add('Funil do WhatsApp', 'Vendas ligadas a um clique', s.funnel.salesFromClicks, { digits: 0 });
  return lines.join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------------------------------------ PDF

const NAVY = rgb(0.024, 0.07, 0.16);
const GOLD = rgb(0.88, 0.74, 0.48);
const INK = rgb(0.1, 0.12, 0.18);
const MUTED = rgb(0.4, 0.43, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const CONTENT_W = PAGE_W - 2 * M;

/** Standard PDF fonts only cover WinAnsi: anything else becomes "?" instead of throwing. */
function safe(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    out += c < 0x100 || '—–‘’“”•…€™'.includes(ch) ? ch : '?';
  }
  return out;
}

export async function financePdf(s: FinanceSummary, o: ReportOptions): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Abasse Crystal — Relatório financeiro (${rangeLabel(s.range)})`);
  pdf.setProducer('Abasse Crystal');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const money = (cents: number) => `${symbol(o)} ${major(cents, o).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;
  const draw = (t: string, x: number, yy: number, size = 9, f: PDFFont = font, color = INK) => page.drawText(safe(t), { x, y: yy, size, font: f, color });
  const width = (t: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(safe(t), size);
  const right = (t: string, xRight: number, yy: number, size = 9, f: PDFFont = font, color = INK) => draw(t, xRight - width(t, size, f), yy, size, f, color);
  const fit = (t: string, maxW: number, size: number, f: PDFFont = font) => {
    let s2 = t;
    while (s2.length > 1 && width(s2, size, f) > maxW) s2 = s2.slice(0, -2);
    return s2 === t ? t : s2 + '…';
  };
  const need = (h: number) => {
    if (y - h < M + 20) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  };
  const heading = (t: string) => {
    need(34);
    y -= 14;
    draw(t, M, y, 11, bold);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: 0.6, color: LINE });
    y -= 4;
  };

  // header band
  page.drawRectangle({ x: 0, y: PAGE_H - 78, width: PAGE_W, height: 78, color: NAVY });
  draw('Abasse Crystal', M, PAGE_H - 36, 20, bold, GOLD);
  draw(`Relatório financeiro — ${rangeLabel(s.range)}`, M, PAGE_H - 56, 11, font, rgb(1, 1, 1));
  right(`Gerado em ${brtStamp(o.generatedAt)} (Brasília)`, PAGE_W - M, PAGE_H - 56, 8, font, rgb(0.8, 0.84, 0.9));
  y = PAGE_H - 78 - 16;
  draw(o.currency === 'BRL' ? `Valores em reais (R$). ${rateText(o)}` : 'Valores em dólares (US$).', M, y, 8, font, MUTED);
  y -= 8;

  // KPI boxes (3 x 2)
  const kpis: [string, string, string][] = [
    ['Faturamento', money(s.revenueCents), s.previous ? `${s.previous.revenueCents > 0 ? (s.revenueCents >= s.previous.revenueCents ? '+' : '') + pct(((s.revenueCents - s.previous.revenueCents) / s.previous.revenueCents) * 100) + ' vs. período anterior' : 'sem período anterior para comparar'}` : ''],
    ['Lucro', money(s.profitCents), s.marginPct === null ? 'sem custos cadastrados' : `margem ${pct(s.marginPct)}`],
    ['Pedidos', String(s.orders), `ticket médio ${money(s.averageTicketCents)}`],
    ['Frete cobrado', money(s.shippingCents), ''],
    ['Peças vendidas', String(s.units), s.grams > 0 ? `${(s.grams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg a granel` : ''],
    ['Custo das peças', money(s.costCents), `${s.costCoveragePct}% do faturamento com custo cadastrado`],
  ];
  const bw = (CONTENT_W - 2 * 10) / 3;
  const bh = 56;
  kpis.forEach(([label, value, note], i) => {
    const bx = M + (i % 3) * (bw + 10);
    const by = y - 10 - Math.floor(i / 3) * (bh + 10) - bh;
    page.drawRectangle({ x: bx, y: by, width: bw, height: bh, borderColor: LINE, borderWidth: 0.8, color: rgb(0.98, 0.98, 0.99) });
    draw(label.toUpperCase(), bx + 10, by + bh - 15, 7, bold, MUTED);
    draw(fit(value, bw - 20, 15, bold), bx + 10, by + bh - 34, 15, bold, INK);
    if (note) draw(fit(note, bw - 20, 7), bx + 10, by + 9, 7, font, MUTED);
  });
  y -= 10 + 2 * (bh + 10);

  // revenue chart
  heading(s.perDay ? 'Faturamento por dia' : 'Faturamento por mês');
  const ch = 110;
  need(ch + 30);
  const top = y - 8;
  const base = top - ch;
  const series = s.series;
  const max = Math.max(1, ...series.map((p) => p.revenueCents));
  page.drawLine({ start: { x: M, y: base }, end: { x: M + CONTENT_W, y: base }, thickness: 0.6, color: LINE });
  page.drawLine({ start: { x: M, y: top }, end: { x: M + CONTENT_W, y: top }, thickness: 0.4, color: LINE });
  const px = (i: number) => M + (series.length > 1 ? (i / (series.length - 1)) * CONTENT_W : CONTENT_W / 2);
  const py = (c: number) => base + (c / max) * (ch - 6);
  for (let i = 1; i < series.length; i++) {
    page.drawLine({ start: { x: px(i - 1), y: py(series[i - 1].revenueCents) }, end: { x: px(i), y: py(series[i].revenueCents) }, thickness: 1.2, color: rgb(0.72, 0.55, 0.22) });
  }
  draw(`máx. ${money(max)}`, M + 2, top - 9, 7, font, MUTED);
  if (series.length) {
    draw(series[0].date, M, base - 10, 7, font, MUTED);
    right(series[series.length - 1].date, M + CONTENT_W, base - 10, 7, font, MUTED);
  }
  y = base - 16;

  // ranking tables
  const table = (title: string, header: string[], data: string[][], widths: number[]) => {
    need(70); // keep the title with its header and first rows
    heading(title);
    if (!data.length) {
      need(16);
      draw('Sem dados no período.', M, y - 10, 9, font, MUTED);
      y -= 18;
      return;
    }
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? M) + w], [M]);
    need(16);
    header.forEach((h, i) => (i === 0 ? draw(h, xs[i], y - 12, 7.5, bold, MUTED) : right(h, xs[i + 1] - 4, y - 12, 7.5, bold, MUTED)));
    y -= 16;
    for (const row of data) {
      need(15);
      row.forEach((cell, i) => (i === 0 ? draw(fit(cell, widths[0] - 8, 9), xs[i], y - 11, 9) : right(cell, xs[i + 1] - 4, y - 11, 9)));
      y -= 15;
      page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: 0.3, color: LINE });
    }
  };
  table('Produtos mais vendidos', ['Produto', 'Faturamento', 'Pedidos', 'Quantidade'], s.topProducts.map((p) => [p.name, money(p.revenueCents), String(p.orders), p.grams > 0 ? `${(p.grams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg` : `${p.units} un.`]), [235, 110, 70, 100]);
  const totalCat = s.byCategory.reduce((n, c) => n + c.revenueCents, 0) || 1;
  table('Faturamento por categoria', ['Categoria', 'Faturamento', 'Participação'], s.byCategory.map((c) => [c.name, money(c.revenueCents), pct((c.revenueCents / totalCat) * 100)]), [255, 130, 130]);
  table('Por país', ['País', 'Faturamento', 'Pedidos'], s.byCountry.map((c) => [countryLabel(c.country), money(c.revenueCents), String(c.orders)]), [255, 130, 130]);
  table('Por forma de pagamento', ['Forma de pagamento', 'Faturamento', 'Pedidos'], s.byPayment.map((p) => [PAYMENT_LABEL[p.method] ?? p.method, money(p.revenueCents), String(p.orders)]), [255, 130, 130]);
  table(
    'Funil do WhatsApp',
    ['Etapa', 'Quantidade'],
    [
      ['Cliques no WhatsApp', String(s.funnel.clicks)],
      ['Conversas confirmadas', String(s.funnel.confirmed)],
      ['Vendas no período', String(s.funnel.sales)],
      ['Vendas ligadas a um clique', String(s.funnel.salesFromClicks)],
    ],
    [385, 130],
  );

  // footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const t = safe(`Abasse Crystal — relatório financeiro — página ${i + 1} de ${pages.length}`);
    p.drawText(t, { x: PAGE_W / 2 - font.widthOfTextAtSize(t, 7) / 2, y: 22, size: 7, font, color: MUTED });
  });
  return Buffer.from(await pdf.save());
}
