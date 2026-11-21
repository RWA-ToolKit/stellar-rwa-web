import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompliance } from './useCompliance';

const mockGetCompliance = vi.fn();

vi.mock('@/lib/contracts', () => ({
  getCompliance: (...args: unknown[]) => mockGetCompliance(...args),
}));

describe('useCompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces a rejected compliance lookup as readable error state', async () => {
    mockGetCompliance.mockRejectedValueOnce(new Error('RPC unavailable'));

    const { result } = renderHook(() => useCompliance('GABC123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('RPC unavailable');
    expect(result.current.compliance).toBeNull();
  });

  it('does not query and stays idle for empty/zero/null input', async () => {
    // Empty, zero, and null addresses are treated as "no subject": the hook
    // must not hit the contract and must settle into a deliberate idle state
    // (loading false, no error, compliance null) rather than firing a lookup.
    const inputs = ['', '0', null] as const;

    for (const input of inputs) {
      mockGetCompliance.mockClear();

      const { result } = renderHook(() => useCompliance(input as unknown as string));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetCompliance).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
      expect(result.current.compliance).toBeNull();
    }
  });
});
