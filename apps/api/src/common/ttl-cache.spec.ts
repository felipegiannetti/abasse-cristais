import { describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('computes once while the entry is fresh, then again after the ttl', async () => {
    let t = 1_000;
    const cache = new TtlCache<string, number>(30_000, () => t);
    const compute = vi.fn(() => Promise.resolve(42));

    expect(await cache.get('a', compute)).toBe(42);
    t += 29_999;
    expect(await cache.get('a', compute)).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);

    t += 2; // 30_001 ms after the first computation
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps separate entries per key', async () => {
    const cache = new TtlCache<number, string>(1_000, () => 0);
    expect(await cache.get(7, () => Promise.resolve('seven'))).toBe('seven');
    expect(await cache.get(30, () => Promise.resolve('thirty'))).toBe('thirty');
    expect(await cache.get(7, () => Promise.resolve('recomputed'))).toBe('seven');
  });

  it('clear() forces the next read to recompute', async () => {
    const cache = new TtlCache<string, number>(60_000, () => 0);
    const compute = vi.fn(() => Promise.resolve(1));
    await cache.get('k', compute);
    cache.clear();
    await cache.get('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed computation', async () => {
    const cache = new TtlCache<string, number>(60_000, () => 0);
    await expect(cache.get('k', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await cache.get('k', () => Promise.resolve(5))).toBe(5);
  });
});
