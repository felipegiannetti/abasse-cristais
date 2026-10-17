import { describe, expect, it } from 'vitest';
import { brtDateTime, csvText, itemsTable, salesTable, tablesToXlsx, tableToCsv, type ExportSale } from './sales-export';

const sale = (over: Partial<ExportSale> = {}): ExportSale =>
  ({
    id: 's1',
    number: 62,
    soldAt: new Date('2026-10-16T16:04:00.000Z'),
    status: 'PAID',
    customerName: 'Lucía Fernández',
    shipTo: { country: 'ES', city: 'Madrid' },
    shippingMethod: 'DHL Express',
    shippingCostCents: 2900,
    trackingCode: 'AB123',
    paymentMethod: 'PAYPAL',
    discountCents: 500,
    subtotalCents: 9800,
    totalCents: 12200,
    currency: 'USD',
    paidCurrency: 'USD',
    paidAmountCents: 12200,
    fxRate: null,
    notes: null,
    clickRef: 'K7M2QX',
    items: [
      { id: 'i1', saleId: 's1', productId: 'p1', productName: 'Drusa de Ametista', category: 'Ametista', mode: 'UNIT', quantity: 2, unitPriceCents: 4890, costCents: 2200, totalCents: 9780 },
      { id: 'i2', saleId: 's1', productId: 'p2', productName: 'Ametista Rolada (kg)', category: 'Pedras Roladas', mode: 'WEIGHT', quantity: 500, unitPriceCents: 4300, costCents: null, totalCents: 2150 },
    ],
    ...over,
  }) as unknown as ExportSale;

describe('csvText', () => {
  it('quotes cells with separators, quotes or line breaks', () => {
    expect(csvText('a;b')).toBe('"a;b"');
    expect(csvText('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvText('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(csvText('simples')).toBe('simples');
  });

  it('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(csvText('=HYPERLINK("http://x","clique")')).toBe('"\'=HYPERLINK(""http://x"",""clique"")"');
    expect(csvText('+55 11 99999-9999')).toBe("'+55 11 99999-9999");
    expect(csvText('-1')).toBe("'-1");
    expect(csvText('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});

describe('brtDateTime', () => {
  it('writes Brasília time', () => {
    expect(brtDateTime(new Date('2026-10-16T16:04:00.000Z'))).toBe('2026-10-16 13:04');
    expect(brtDateTime(new Date('2026-01-01T02:00:00.000Z'))).toBe('2025-12-31 23:00');
  });
});

describe('salesTable', () => {
  it('has one row per sale with dollars as numbers and the right columns', () => {
    const t = salesTable([sale()]);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toHaveLength(t.columns.length);
    const col = (name: string) => t.rows[0][t.columns.findIndex((c) => c.header === name)];
    expect(col('Pedido')).toBe(62);
    expect(col('Data')).toBe('2026-10-16 13:04');
    expect(col('Situação')).toBe('Pago');
    expect(col('País')).toBe('ES');
    expect(col('Forma de pagamento')).toBe('PayPal');
    expect(col('Peças')).toBe('Drusa de Ametista ×2 · Ametista Rolada (kg) 500 g');
    expect(col('Categorias')).toBe('Ametista, Pedras Roladas');
    expect(col('Total (US$)')).toBe(122);
    expect(col('Pago em')).toBe('US$');
    expect(col('Cotação (R$ por US$)')).toBeNull();
  });

  it('records the reais received and the rate for a sale paid in BRL', () => {
    const t = salesTable([sale({ paidCurrency: 'BRL', paidAmountCents: 62000, fxRate: 5.0826 as never })]);
    const col = (name: string) => t.rows[0][t.columns.findIndex((c) => c.header === name)];
    expect(col('Pago em')).toBe('R$');
    expect(col('Valor recebido')).toBe(620);
    expect(col('Cotação (R$ por US$)')).toBe(5.0826);
  });
});

describe('itemsTable', () => {
  it('has one row per item', () => {
    const t = itemsTable([sale()]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[1][t.columns.findIndex((c) => c.header === 'Venda por')]).toBe('kg');
    expect(t.rows[1][t.columns.findIndex((c) => c.header === 'Custo (US$ por peça ou kg)')]).toBeNull();
  });
});

describe('tableToCsv', () => {
  it('uses ";" and a decimal comma, with a header row', () => {
    const csv = tableToCsv(salesTable([sale()]));
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header.startsWith('Pedido;Data;Situação;')).toBe(true);
    expect(row).toContain(';122,00;');
    expect(row.startsWith('62;2026-10-16 13:04;Pago;Lucía Fernández;ES;Madrid;PayPal;')).toBe(true);
  });

  it('writes an empty cell for null and the rate with four decimals', () => {
    const csv = tableToCsv(salesTable([sale({ paidCurrency: 'BRL', paidAmountCents: 62000, fxRate: 5.0826 as never })]));
    expect(csv).toContain(';5,0826;');
  });
});

describe('tablesToXlsx', () => {
  it('produces a zip (an .xlsx) with both sheets', async () => {
    const buf = await tablesToXlsx([
      { name: 'Vendas', table: salesTable([sale()]) },
      { name: 'Itens', table: itemsTable([sale()]) },
    ]);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    expect(buf.length).toBeGreaterThan(1000);
  });
});
