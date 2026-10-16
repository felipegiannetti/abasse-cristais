/**
 * Tiny per-process cache with a fixed time-to-live, for expensive read-only summaries. Per instance on
 * purpose (like the rate limiter): under several serverless instances it is merely shorter-lived, never wrong
 * for longer than `ttlMs`. Callers `clear()` it right after the data they cache changes.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { at: number; value: V }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** The cached value for `key` if it is still fresh, otherwise `compute()` (whose result is then cached). */
  async get(key: K, compute: () => Promise<V>): Promise<V> {
    const hit = this.entries.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;
    const value = await compute();
    this.entries.set(key, { at: this.now(), value });
    return value;
  }

  clear(): void {
    this.entries.clear();
  }
}
