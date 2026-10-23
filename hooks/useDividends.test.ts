import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDividends } from './useDividends';

describe('useDividends', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces a rejected fetch as readable error state instead of throwing', async () => {
    const failure = new Error('RPC unavailable');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(failure);

    const { result } = renderHook(() => useDividends());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('RPC unavailable');
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('returns an empty, zeroed result for empty/zero/null input without erroring', async () => {
    // Empty input is deliberate: no distributions to fetch, so the hook should
    // resolve to an empty list with zero totals and no error rather than throw.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => [],
      } as unknown as Response);

    const { result } = renderHook(() => useDividends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeFalsy();
    expect(result.current.dividends).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
