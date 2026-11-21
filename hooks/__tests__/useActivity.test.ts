import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useActivity } from '../useActivity';

// Mock the network context so we can switch networks mid-session.
const networkState = { network: 'testnet' as 'testnet' | 'mainnet' };

vi.mock('@/context/NetworkContext', () => ({
  useNetwork: () => ({ network: networkState.network }),
}));

// Mock the RPC layer. Each network returns a distinct, identifiable payload so
// we can assert that stale-network data never leaks into the UI.
const fetchActivityMock = vi.fn();

vi.mock('@/lib/rpc', () => ({
  fetchActivity: (...args: unknown[]) => fetchActivityMock(...args),
}));

describe('useActivity network switching', () => {
  beforeEach(() => {
    networkState.network = 'testnet';
    fetchActivityMock.mockReset();
  });

  it('does not show stale-network data after switching networks', async () => {
    // Testnet resolves immediately with testnet-only data.
    fetchActivityMock.mockImplementation(async (network: string) => {
      if (network === 'testnet') {
        return [{ id: 'testnet-1', network: 'testnet' }];
      }
      // Mainnet is slow so the switch happens while testnet data is cached.
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [{ id: 'mainnet-1', network: 'mainnet' }];
    });

    const { result, rerender } = renderHook(() => useActivity());

    await waitFor(() => {
      expect(result.current.activity).toEqual([
        { id: 'testnet-1', network: 'testnet' },
      ]);
    });

    // Switch network mid-session.
    networkState.network = 'mainnet';
    rerender();

    // Immediately after the switch, stale testnet data must not be shown.
    expect(result.current.activity).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ network: 'testnet' })]),
    );

    // Eventually the mainnet data arrives and replaces the stale data.
    await waitFor(() => {
      expect(result.current.activity).toEqual([
        { id: 'mainnet-1', network: 'mainnet' },
      ]);
    });

    // No cross-network leakage: only mainnet entries remain.
    expect(
      result.current.activity.every((item) => item.network === 'mainnet'),
    ).toBe(true);
  });

  it('ignores in-flight responses from the previous network', async () => {
    let resolveTestnet: (value: unknown) => void = () => {};

    fetchActivityMock.mockImplementation((network: string) => {
      if (network === 'testnet') {
        // In-flight testnet request that resolves after the switch.
        return new Promise((resolve) => {
          resolveTestnet = resolve;
        });
      }
      return Promise.resolve([{ id: 'mainnet-1', network: 'mainnet' }]);
    });

    const { result, rerender } = renderHook(() => useActivity());

    // Switch to mainnet while the testnet request is still in flight.
    networkState.network = 'mainnet';
    rerender();

    await waitFor(() => {
      expect(result.current.activity).toEqual([
        { id: 'mainnet-1', network: 'mainnet' },
      ]);
    });

    // Now let the stale testnet request resolve; it must be discarded.
    await act(async () => {
      resolveTestnet([{ id: 'testnet-1', network: 'testnet' }]);
      await Promise.resolve();
    });

    expect(result.current.activity).toEqual([
      { id: 'mainnet-1', network: 'mainnet' },
    ]);
  });
});
