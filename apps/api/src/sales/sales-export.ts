import type { Prisma } from '@prisma/client';

/**
 * Turns sales into spreadsheet-friendly tables (one row per sale, plus one row per item) and writes them as
 * CSV or XLSX. Money columns are US dollars (the stored currency), as plain numbers, so the spreadsheet can
 * sum them; reais actually received and the rate used are separate columns.
 */
export type ExportSale = Prisma.SaleGetPayload<{ include: { items: true } }>;

type Cell = string | number | null;
export interface Column {
  header: string;
  /** money/rate/number are written as numbers in XLSX and with a decimal comma in CSV */
  kind: 'text' | 'money' | 'number' | 'rate';
  width: number;
}
export interface Table {
  columns: Column[];
  rows: Cell[][];
}

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendente', PAID: 'Pago', SHIPPED: 'Enviado', DELIVERED: 'Entregue', CANCELLED: 'Cancelado' };
export const PAYMENT_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Transferência bancária',
  WISE: 'Wise',
  STRIPE: 'Stripe',
  CASH: 'Dinheiro',
};

const BRT_OFFSET_MS = 3 * 3_600_000;
/** Brasília time, "2026-10-16 13:04". */
export const brtDateTime = (d: Date): string => new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');

const dollars = (cents: number | null | undefined): number | null => (cents == null ? null : cents / 100);

function shipToPart(s: ExportSale, key: 'city' | 'country'): string {
  const v = (s.shipTo as Record<string, unknown> | null)?.[key];
  return typeof v === 'string' ? v : '';
}

const qtyText = (i: ExportSale['items'][number]) => (i.mode === 'WEIGHT' ? `${i.quantity} g` : `×${i.quantity}`);

export function salesTable(sales: ExportSale[]): Table {
  const columns: Column[] = [
    { header: 'Pedido', kind: 'number', width: 9 },
    { header: 'Data', kind: 'text', width: 17 },
    { header: 'Situação', kind: 'text', width: 12 },
    { header: 'Cliente', kind: 'text', width: 26 },
    { header: 'País', kind: 'text', width: 7 },
    { header: 'Cidade', kind: 'text', width: 18 },
    { header: 'Forma de pagamento', kind: 'text', width: 20 },
    { header: 'Peças', kind: 'text', width: 44 },
    { header: 'Categorias', kind: 'text', width: 24 },
    { header: 'Subtotal (US$)', kind: 'money', width: 14 },
    { header: 'Desconto (US$)', kind: 'money', width: 14 },
    { header: 'Frete (US$)', kind: 'money', width: 12 },
    { header: 'Total (US$)', kind: 'money', width: 13 },
    { header: 'Pago em', kind: 'text', width: 9 },
    { header: 'Valor recebido', kind: 'money', width: 15 },
    { header: 'Cotação (R$ por US$)', kind: 'rate', width: 19 },
    { header: 'Envio', kind: 'text', width: 18 },
    { header: 'Rastreio', kind: 'text', width: 18 },
    { header: 'Código Ref', kind: 'text', width: 11 },
    { header: 'Observações', kind: 'text', width: 30 },
  ];
  const rows = sales.map((s): Cell[] => [
    s.number,
    brtDateTime(s.soldAt),
    STATUS_LABEL[s.status] ?? s.status,
    s.customerName,
    shipToPart(s, 'country'),
    shipToPart(s, 'city'),
    PAYMENT_LABEL[s.paymentMethod] ?? s.paymentMethod,
    s.items.map((i) => `${i.productName} ${qtyText(i)}`).join(' · '),
    [...new Set(s.items.map((i) => i.category))].join(', '),
    dollars(s.subtotalCents),
    dollars(s.discountCents),
    dollars(s.shippingCostCents),
    dollars(s.totalCents),
    s.paidCurrency === 'BRL' ? 'R$' : 'US$',
    dollars(s.paidAmountCents ?? s.totalCents),
    s.fxRate === null ? null : Number(s.fxRate),
    s.shippingMethod ?? '',
    s.trackingCode ?? '',
    s.clickRef ?? '',
    s.notes ?? '',
  ]);
  return { columns, rows };
}

export function itemsTable(sales: ExportSale[]): Table {
  const columns: Column[] = [
    { header: 'Pedido', kind: 'number', width: 9 },
    { header: 'Data', kind: 'text', width: 17 },
    { header: 'Produto', kind: 'text', width: 34 },
    { header: 'Categoria', kind: 'text', width: 20 },
    { header: 'Venda por', kind: 'text', width: 10 },
    { header: 'Quantidade (peças ou gramas)', kind: 'number', width: 27 },
    { header: 'Preço (US$ por peça ou kg)', kind: 'money', width: 25 },
    { header: 'Total da linha (US$)', kind: 'money', width: 19 },
    { header: 'Custo (US$ por peça ou kg)', kind: 'money', width: 25 },
  ];
  const rows = sales.flatMap((s) =>
    s.items.map((i): Cell[] => [
      s.number,
      brtDateTime(s.soldAt),
      i.productName,
      i.category,
      i.mode === 'WEIGHT' ? 'kg' : 'peça',
      i.quantity,
      dollars(i.unitPriceCents),
      dollars(i.totalCents),
      dollars(i.costCents),
    ]),
  );
  return { columns, rows };
}

// ---------------------------------------------------------------------------------------------- CSV

/**
 * One CSV cell. Text that starts with = + - @ (or a tab/CR) would be run as a formula by Excel/Sheets
 * ("CSV injection": a customer name or note typed as =HYPERLINK(...)), so it is prefixed with an apostrophe.
 */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Brazilian-Excel friendly: ";" separator, decimal comma, CRLF; the caller adds the UTF-8 BOM. */
export function tableToCsv(t: Table): string {
  const num = (n: number, kind: Column['kind']) => (kind === 'number' ? String(n) : n.toFixed(kind === 'rate' ? 4 : 2).replace('.', ','));
  const lines = [t.columns.map((c) => csvText(c.header)).join(';')];
  for (const row of t.rows) {
    lines.push(
      row
        .map((v, i) => {
          if (v === null) return '';
          return typeof v === 'number' ? num(v, t.columns[i].kind) : csvText(v);
        })
        .join(';'),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------------------------- XLSX

const XLSX_FORMAT: Record<Column['kind'], string | undefined> = { text: undefined, number: '0', money: '#,##0.00', rate: '0.0000' };

/** An .xlsx file with one sheet per table (header row in bold, money and rates as real numbers). */
export async function tablesToXlsx(sheets: { name: string; table: Table }[]): Promise<Buffer> {
  // an ESM-first package loaded from the CommonJS build (types: src/types/write-excel-file.d.ts)
  const { default: writeXlsxFile } = await import('write-excel-file/node');
  const data = sheets.map(({ name, table }) => ({
    sheet: name,
    columns: table.columns.map((c) => ({ width: c.width })),
    data: [
      table.columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
      ...table.rows.map((row) =>
        row.map((v, i) => {
          const kind = table.columns[i].kind;
          if (v === null) return null;
          // text starting with = + - @ is stored as a string cell (never a formula), so no escaping is needed
          return typeof v === 'number' ? { value: v, type: Number, format: XLSX_FORMAT[kind] } : { value: v, type: String };
        }),
      ),
    ],
  }));
  return writeXlsxFile(data).toBuffer();
}
