import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useContractErrors } from './contractErrors';

describe('useContractErrors unmount during in-flight async call', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('does not warn about state updates on an unmounted component', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => pending as Promise<Response>);

    const { unmount } = renderHook(() => useContractErrors('CTESTCONTRACT'));

    // Unmount while the async call is still in flight.
    unmount();

    // Resolve the in-flight call after unmount.
    resolveFetch({
      ok: true,
      json: async () => ({ errors: [] }),
    } as unknown as Response);

    // Allow any pending microtasks/effects to flush.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    await Promise.resolve();

    const unmountedWarning = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0]).includes('unmounted component'),
    );
    expect(unmountedWarning).toBeUndefined();
  });
});
