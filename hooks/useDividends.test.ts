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
});
