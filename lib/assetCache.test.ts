import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assetCache } from './assetCache';

describe('assetCache', () => {
  beforeEach(() => {
    assetCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    assetCache.clear();
  });

  it('returns cached value on subsequent calls', async () => {
    const loader = vi.fn().mockResolvedValue('value');

    const first = await assetCache.get('key', loader);
    const second = await assetCache.get('key', loader);

    expect(first).toBe('value');
    expect(second).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('surfaces loader rejection as a readable error state instead of crashing', async () => {
    const failure = new Error('network down');
    const loader = vi.fn().mockRejectedValue(failure);

    let result: unknown;
    await expect(
      (async () => {
        result = await assetCache.get('failing-key', loader);
      })(),
    ).resolves.not.toThrow();

    expect(result).toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load and retries on next call', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    await assetCache.get('retry-key', loader).catch(() => undefined);
    const value = await assetCache.get('retry-key', loader);

    expect(value).toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('treats an empty string key as a valid cache key', async () => {
    // The cache is keyed by string; an empty key is not special-cased, so it
    // behaves like any other key: the loader runs once and the value is reused.
    const loader = vi.fn().mockResolvedValue('empty-key-value');

    const first = await assetCache.get('', loader);
    const second = await assetCache.get('', loader);

    expect(first).toBe('empty-key-value');
    expect(second).toBe('empty-key-value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('returns the loader result for zero/empty input without throwing', async () => {
    // Zero/empty values are passed straight through to the loader; the cache
    // does not reject falsy inputs, so the loader decides the result.
    const loader = vi.fn().mockResolvedValue(0);

    const result = await assetCache.get('zero-key', loader);

    expect(result).toBe(0);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a null/undefined loader result', async () => {
    // A nullish result is still returned to the caller, but it is not treated
    // as a cacheable value, so a subsequent call re-invokes the loader.
    const loader = vi.fn().mockResolvedValue(null);

    const first = await assetCache.get('null-key', loader);
    const second = await assetCache.get('null-key', loader);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
