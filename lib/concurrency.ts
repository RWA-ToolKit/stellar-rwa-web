/**
 * Bounded-concurrency helpers for fanning out many per-item RPC calls
 * (e.g. one `simulateTransaction` per allowlisted address) without firing
 * them all at once at the public RPC.
 */

/** Default cap on simultaneous in-flight calls for a single fan-out. */
export const DEFAULT_CONCURRENCY = 8;

/**
 * Map over `items` with at most `limit` calls to `fn` in flight at a time.
 * Preserves input order in the returned array regardless of completion order.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
