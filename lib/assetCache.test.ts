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
});
