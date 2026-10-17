import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { financeCsv, financePdf, type FinanceSummary, type ReportOptions } from './finance-export';

const summary = (over: Partial<FinanceSummary> = {}): FinanceSummary => ({
  range: '30',
  perDay: true,
  revenueCents: 311060,
  shippingCents: 93780,
  orders: 16,
  averageTicketCents: 19441,
  units: 23,
  grams: 1500,
  costCents: 138050,
  profitCents: 173010,
  marginPct: 55.6,
  costCoveragePct: 100,
  previous: { revenueCents: 200000, orders: 10 },
  series: [
    { date: '2026-10-01', revenueCents: 0, orders: 0 },
    { date: '2026-10-02', revenueCents: 12000, orders: 1 },
    { date: '2026-10-03', revenueCents: 30000, orders: 2 },
  ],
  byCategory: [
    { name: 'Ametista', revenueCents: 150000 },
    { name: 'Quartzo', revenueCents: 90000 },
  ],
  topProducts: [{ name: 'Drusa de Ametista', revenueCents: 97800, orders: 3, units: 3, grams: 0 }],
  byCountry: [
    { country: 'BR', orders: 10, revenueCents: 200000 },
    { country: '—', orders: 1, revenueCents: 5000 },
  ],
  byPayment: [{ method: 'PIX', orders: 9, revenueCents: 180000 }],
  funnel: { clicks: 109, confirmed: 39, sales: 16, salesFromClicks: 6 },
  ...over,
});

const usd: ReportOptions = { currency: 'USD', rate: null, rateNote: '', generatedAt: new Date('2026-10-17T21:00:00Z') };
const brl: ReportOptions = { currency: 'BRL', rate: 5.0826, rateNote: 'cotação oficial do Banco Central (PTAX) de 16/10', generatedAt: new Date('2026-10-17T21:00:00Z') };

describe('financeCsv', () => {
  it('has the flat header and the dollar summary with decimal commas', () => {
    const lines = financeCsv(summary(), usd).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Seção;Item;Valor;Pedidos;Detalhe');
    expect(lines).toContain('Resumo;Faturamento (US$);3110,60;16;');
    expect(lines).toContain('Resumo;Peças vendidas;23;;unidades');
    expect(lines).toContain('Informações;Período;;;Últimos 30 dias');
    expect(lines).toContain('Por país;Sem endereço;50,00;1;');
    expect(lines).toContain('Por forma de pagamento;Pix;1800,00;9;');
    expect(lines).toContain('Faturamento por dia;2026-10-02;120,00;1;');
    expect(lines).toContain('Funil do WhatsApp;Cliques no WhatsApp;109;;');
  });

  it('converts to reais and states the rate used', () => {
    const lines = financeCsv(summary(), brl).trimEnd().split('\r\n');
    // 311060 US$ cents × 5.0826 = 1 580 993.6 → 1 580 994 R$ centavos
    expect(lines).toContain('Resumo;Faturamento (R$);15809,94;16;');
    expect(lines.some((l) => l.startsWith('Informações;Cotação usada;5,0826;;') && l.includes('Banco Central'))).toBe(true);
    expect(lines).toContain('Informações;Moeda;;;Reais (R$)');
  });

  it('omits the previous-period row when there is none and reports a missing margin', () => {
    const csv = financeCsv(summary({ previous: null, marginPct: null }), usd);
    expect(csv).not.toContain('período anterior');
    expect(csv).toContain('margem não calculável');
  });

  it('neutralises formulas in product names', () => {
    const csv = financeCsv(summary({ topProducts: [{ name: '=HYPERLINK("x")', revenueCents: 100, orders: 1, units: 1, grams: 0 }] }), usd);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('financePdf', () => {
  it('produces a PDF', async () => {
    const buf = await financePdf(summary(), usd);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
  });

  it('survives characters the standard fonts cannot draw, and empty data', async () => {
    const odd = summary({
      topProducts: [{ name: 'Cristal 💎 → raro ≈ ✨', revenueCents: 1, orders: 1, units: 1, grams: 0 }],
      byCategory: [],
      byCountry: [],
      byPayment: [],
      series: [],
      previous: null,
    });
    const buf = await financePdf(odd, brl);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('flows onto more pages when there is a lot of data', async () => {
    const many = summary({ topProducts: Array.from({ length: 120 }, (_, i) => ({ name: `Produto ${i}`, revenueCents: i * 100, orders: i, units: i, grams: 0 })) });
    const buf = await financePdf(many, usd);
    expect((await PDFDocument.load(buf)).getPageCount()).toBeGreaterThan(1);
  });
});
