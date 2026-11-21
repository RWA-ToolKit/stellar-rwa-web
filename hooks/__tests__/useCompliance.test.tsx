import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompliance } from '../useCompliance';

// Mock the network selection source so we can switch networks mid-session.
const networkState = { network: 'testnet' as 'testnet' | 'mainnet' };

vi.mock('@/context/NetworkContext', () => ({
  useNetwork: () => ({
    network: networkState.network,
    setNetwork: (n: 'testnet' | 'mainnet') => {
      networkState.network = n;
    },
  }),
}));

// Mock the compliance data source. Each network returns distinct data so we can
// assert that stale-network data never leaks into the returned state.
const fetchCompliance = vi.fn(async (network: string) => {
  if (network === 'testnet') {
    return { network: 'testnet', status: 'testnet-only' };
  }
  return { network: 'mainnet', status: 'mainnet-only' };
});

vi.mock('@/lib/compliance', () => ({
  fetchCompliance: (network: string) => fetchCompliance(network),
}));

describe('useCompliance network switch', () => {
  beforeEach(() => {
    networkState.network = 'testnet';
    fetchCompliance.mockClear();
  });

  it('does not show stale-network data after switching networks', async () => {
    const { result, rerender } = renderHook(() => useCompliance());

    // Initial load on testnet.
    await waitFor(() => {
      expect(result.current.data).toEqual({
        network: 'testnet',
        status: 'testnet-only',
      });
    });

    // Switch to mainnet mid-session.
    networkState.network = 'mainnet';
    rerender();

    // Immediately after the switch, stale testnet data must not be shown.
    expect(result.current.data?.network).not.toBe('testnet');

    // Eventually the mainnet data resolves and is shown.
    await waitFor(() => {
      expect(result.current.data).toEqual({
        network: 'mainnet',
        status: 'mainnet-only',
      });
    });

    // No cross-network leakage: only the current network's data is present.
    expect(result.current.data?.status).toBe('mainnet-only');
  });

  it('ignores in-flight responses from the previous network', async () => {
    // Make the testnet request resolve slowly so it is still in-flight when we
    // switch networks.
    let resolveTestnet: (v: unknown) => void = () => {};
    fetchCompliance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTestnet = resolve;
        }),
    );

    const { result, rerender } = renderHook(() => useCompliance());

    // Switch to mainnet while the testnet request is still in-flight.
    networkState.network = 'mainnet';
    rerender();

    await waitFor(() => {
      expect(result.current.data).toEqual({
        network: 'mainnet',
        status: 'mainnet-only',
      });
    });

    // Now let the stale testnet response arrive; it must be discarded.
    resolveTestnet({ network: 'testnet', status: 'testnet-only' });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        network: 'mainnet',
        status: 'mainnet-only',
      });
    });
    expect(result.current.data?.network).not.toBe('testnet');
  });
});
