import { describe, expect, it } from 'vitest';
import { aggregate } from './finance.service';

type Sale = Parameters<typeof aggregate>[0][number];
type Item = Sale['items'][number];

function item(overrides: Partial<Item> = {}): Item {
  return { productId: 'p1', productName: 'Ametista', category: 'Ametista', mode: 'UNIT', quantity: 1, costCents: 4000, totalCents: 10000, ...overrides };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    soldAt: new Date('2026-01-01T12:00:00Z'),
    subtotalCents: 10000,
    discountCents: 0,
    shippingCostCents: 0,
    paymentMethod: 'PIX',
    shipTo: { country: 'BR' },
    clickRef: null,
    items: [item()],
    ...overrides,
  };
}

describe('aggregate', () => {
  it('sums revenue net of discount, and tracks shipping separately', () => {
    const { t } = aggregate([sale({ subtotalCents: 10000, discountCents: 1000, shippingCostCents: 3000 })]);
    expect(t.revenueCents).toBe(9000);
    expect(t.shippingCents).toBe(3000);
    expect(t.orders).toBe(1);
  });

  it('spreads the discount proportionally across each line', () => {
    const twoLineSale = sale({
      subtotalCents: 20000,
      discountCents: 2000, // 10% off
      items: [
        item({ productId: 'p1', category: 'Cat A', totalCents: 10000 }),
        item({ productId: 'p2', category: 'Cat B', totalCents: 10000 }),
      ],
    });
    const { byCategory } = aggregate([twoLineSale]);
    expect(byCategory.get('Cat A')?.revenueCents).toBe(9000);
    expect(byCategory.get('Cat B')?.revenueCents).toBe(9000);
  });

  it('converts WEIGHT quantity (grams) and cost (per kg) correctly', () => {
    const { t } = aggregate([sale({ subtotalCents: 25000, items: [item({ mode: 'WEIGHT', quantity: 500, costCents: 20000, totalCents: 25000 })] })]);
    expect(t.grams).toBe(500);
    expect(t.units).toBe(0);
    expect(t.costCents).toBe(10000); // R$200,00/kg * 0,5 kg
  });

  it('only counts cost/profit for lines that actually have a registered cost', () => {
    const { t } = aggregate([sale({ items: [item({ costCents: null })] })]);
    expect(t.costCents).toBe(0);
    expect(t.revenueWithCostCents).toBe(0); // excluded from the coverage base, not counted as zero-cost profit
  });

  it('groups by country (no address falls under "—") and by payment method', () => {
    const { byCountry, byPayment } = aggregate([sale({ shipTo: null }), sale({ shipTo: { country: 'US' } })]);
    expect(byCountry.get('—')?.orders).toBe(1);
    expect(byCountry.get('US')?.orders).toBe(1);
    expect(byPayment.get('PIX')?.orders).toBe(2);
  });

  it('an empty list aggregates to all zeros', () => {
    const { t } = aggregate([]);
    expect(t).toEqual({ revenueCents: 0, shippingCents: 0, orders: 0, units: 0, grams: 0, costCents: 0, revenueWithCostCents: 0 });
  });
});
