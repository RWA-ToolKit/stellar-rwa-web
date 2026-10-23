import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useActivity } from './useActivity';

describe('useActivity', () => {
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

    const { result } = renderHook(() => useActivity('GABC123'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('RPC unavailable');
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('surfaces a non-ok response as readable error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useActivity('GABC123'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
  });

  // Empty/zero/null input: the hook must not fetch and must settle into a
  // deliberate empty state (no data, no error, not loading) rather than
  // firing a request for a missing account.
  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('does not fetch and returns an empty state for %s input', async (_label, input) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() =>
      useActivity(input as unknown as string),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.error).toBeFalsy();
    expect(result.current.data ?? []).toEqual([]);
  });
});
