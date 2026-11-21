import { renderHook, waitFor } from '@testing-library/react';
import { useActivity } from './useActivity';

// Mock the RPC / wallet layer so no keys or funded account is needed.
const mockFetchActivity = jest.fn();

jest.mock('./useActivity', () => {
  const actual = jest.requireActual('./useActivity');
  return {
    ...actual,
    __esModule: true,
  };
});

describe('useActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not warn about state updates when unmounted during an in-flight async call', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    mockFetchActivity.mockReturnValue(pending);

    const { unmount } = renderHook(() => useActivity('GABC123'));

    // Unmount while the async call is still in flight.
    unmount();

    // Resolve the in-flight call after unmount.
    resolveFetch({ data: [] });

    // Allow any pending microtasks / effects to flush.
    await waitFor(() => {
      expect(mockFetchActivity).toHaveBeenCalled();
    });

    const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('unmounted component')
    );
    expect(stateUpdateWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  it('does not show stale-network data after switching network mid-session', async () => {
    // Simulate cached/in-flight data belonging to the testnet network.
    const testnetActivity = [{ id: 'testnet-tx-1', network: 'testnet' }];
    const mainnetActivity = [{ id: 'mainnet-tx-1', network: 'mainnet' }];

    let resolveTestnet: (value: unknown) => void = () => {};
    const testnetPending = new Promise((resolve) => {
      resolveTestnet = resolve;
    });

    // First call (testnet) stays in flight; second call (mainnet) resolves.
    mockFetchActivity
      .mockReturnValueOnce(testnetPending)
      .mockResolvedValueOnce({ data: mainnetActivity });

    const { result, rerender } = renderHook(
      ({ network }: { network: 'testnet' | 'mainnet' }) => useActivity('GABC123', network),
      { initialProps: { network: 'testnet' as 'testnet' | 'mainnet' } }
    );

    // Switch network while the testnet request is still in flight.
    rerender({ network: 'mainnet' });

    // The mainnet data should be reflected once resolved.
    await waitFor(() => {
      expect(result.current.data).toEqual(mainnetActivity);
    });

    // Now resolve the stale testnet request after the switch.
    resolveTestnet({ data: testnetActivity });

    // Allow any pending microtasks / effects to flush.
    await waitFor(() => {
      expect(mockFetchActivity).toHaveBeenCalledTimes(2);
    });

    // Stale testnet data must not leak into the UI after the switch.
    expect(result.current.data).toEqual(mainnetActivity);
    expect(result.current.data).not.toEqual(testnetActivity);
  });
});
