import { describe, expect, it } from 'vitest';
import { lineTotal, nextStatus } from './sales.service';

describe('lineTotal', () => {
  it('UNIT: price per piece times the quantity of pieces', () => {
    expect(lineTotal('UNIT', 1000, 3)).toBe(3000);
  });

  it('WEIGHT: price per kg times grams, divided by 1000', () => {
    expect(lineTotal('WEIGHT', 50000, 500)).toBe(25000); // R$500,00/kg * 500 g = R$250,00
  });

  it('WEIGHT rounds to the nearest cent', () => {
    expect(lineTotal('WEIGHT', 10000, 333)).toBe(Math.round((10000 * 333) / 1000));
  });

  it('zero quantity is zero total regardless of mode', () => {
    expect(lineTotal('UNIT', 5000, 0)).toBe(0);
    expect(lineTotal('WEIGHT', 5000, 0)).toBe(0);
  });
});

describe('nextStatus', () => {
  it('flips AVAILABLE to SOLD_OUT when stock reaches zero', () => {
    expect(nextStatus(2, 0, 'AVAILABLE')).toBe('SOLD_OUT');
  });

  it('flips SOLD_OUT back to AVAILABLE when stock is restored', () => {
    expect(nextStatus(0, 5, 'SOLD_OUT')).toBe('AVAILABLE');
  });

  it('never touches a manually HIDDEN product', () => {
    expect(nextStatus(2, 0, 'HIDDEN')).toBe('HIDDEN');
    expect(nextStatus(0, 5, 'HIDDEN')).toBe('HIDDEN');
  });

  it('does nothing when stock was already zero and stays zero', () => {
    expect(nextStatus(0, 0, 'SOLD_OUT')).toBe('SOLD_OUT');
  });

  it('does nothing when stock drops but stays positive', () => {
    expect(nextStatus(10, 5, 'AVAILABLE')).toBe('AVAILABLE');
  });
});
