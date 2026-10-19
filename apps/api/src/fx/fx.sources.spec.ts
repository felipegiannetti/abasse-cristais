import { describe, expect, it } from 'vitest';
import { isPlausible, parseAwesome, parseBrtTimestamp, parsePtax } from './fx.sources';

describe('parsePtax', () => {
  const body = {
    value: [
      { cotacaoCompra: 5.082, cotacaoVenda: 5.0826, dataHoraCotacao: '2026-10-16 13:04:14.548156' },
      { cotacaoCompra: 5.0515, cotacaoVenda: 5.0521, dataHoraCotacao: '2026-10-15 13:05:33.305854' },
    ],
  };

  it('uses the selling rate of the newest row and reads the time as Brasília time', () => {
    const q = parsePtax(body);
    expect(q).toEqual({ rate: 5.0826, source: 'BCB_PTAX', referenceAt: new Date('2026-10-16T16:04:14.000Z'), previousRate: 5.0521 });
  });

  it('skips older bulletins with the same rate when looking for the previous reading', () => {
    const rows = [5.1, 5.1, 5.1, 5.05].map((v, i) => ({ cotacaoVenda: v, dataHoraCotacao: `2026-10-1${6 - i} 13:00:00` }));
    expect(parsePtax({ value: rows })?.previousRate).toBe(5.05);
  });

  it('has no previousRate when every bulletin is the same value or there is only one', () => {
    expect(parsePtax({ value: [body.value[0]] })).not.toHaveProperty('previousRate');
    const same = [5.1, 5.1].map((v) => ({ cotacaoVenda: v, dataHoraCotacao: '2026-10-16 13:00:00' }));
    expect(parsePtax({ value: same })).not.toHaveProperty('previousRate');
  });

  it('returns null for an empty or malformed answer', () => {
    expect(parsePtax({ value: [] })).toBeNull();
    expect(parsePtax({})).toBeNull();
    expect(parsePtax(null)).toBeNull();
    expect(parsePtax({ value: [{ cotacaoVenda: 'abc', dataHoraCotacao: '2026-10-16 13:04:14' }] })).toBeNull();
    expect(parsePtax({ value: [{ cotacaoVenda: 5.1, dataHoraCotacao: 'ontem' }] })).toBeNull();
  });
});

describe('parseAwesome', () => {
  it('uses the asking price and the epoch timestamp', () => {
    const q = parseAwesome({ USDBRL: { bid: '5.0627', ask: '5.0631', timestamp: '1792184472', create_date: '2026-10-16 18:01:12' } });
    expect(q).toEqual({ rate: 5.0631, source: 'AWESOMEAPI', referenceAt: new Date(1792184472 * 1000) });
  });

  it('derives the previous reading from the daily percentage change', () => {
    const q = parseAwesome({ USDBRL: { ask: '5.0631', timestamp: '1792184472', pctChange: '-0.692429' } });
    expect(q?.previousRate).toBeCloseTo(5.0631 / (1 - 0.00692429), 4);
    expect(parseAwesome({ USDBRL: { ask: '5.0', timestamp: '1792184472', pctChange: '0' } })).not.toHaveProperty('previousRate');
    expect(parseAwesome({ USDBRL: { ask: '5.0', timestamp: '1792184472', pctChange: '900' } })).not.toHaveProperty('previousRate');
  });

  it('returns null for an unexpected shape', () => {
    expect(parseAwesome({})).toBeNull();
    expect(parseAwesome({ USDBRL: { ask: 'x', timestamp: '1' } })).toBeNull();
    expect(parseAwesome({ USDBRL: { ask: '5', timestamp: '0' } })).toBeNull();
    expect(parseAwesome([])).toBeNull();
  });
});

describe('parseBrtTimestamp', () => {
  it('converts Brasília wall-clock time to UTC (+3 h)', () => {
    expect(parseBrtTimestamp('2026-01-01 00:30:00')?.toISOString()).toBe('2026-01-01T03:30:00.000Z');
    expect(parseBrtTimestamp('lixo')).toBeNull();
  });
});

describe('isPlausible', () => {
  it('accepts a normal rate and rejects out-of-range or non-numeric ones', () => {
    expect(isPlausible(5.08)).toBe(true);
    expect(isPlausible(0.5)).toBe(false);
    expect(isPlausible(50)).toBe(false);
    expect(isPlausible(NaN)).toBe(false);
  });

  it('rejects a jump of more than 15% from the previous rate', () => {
    expect(isPlausible(5.2, 5.08)).toBe(true);
    expect(isPlausible(6.0, 5.08)).toBe(false);
    expect(isPlausible(4.2, 5.08)).toBe(false);
    expect(isPlausible(5.2, null)).toBe(true);
  });
});
