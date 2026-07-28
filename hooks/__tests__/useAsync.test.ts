import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAsync } from "@/hooks/useAsync";

describe("useAsync", () => {
  it("returns data after the loader resolves", async () => {
    const loader = vi.fn().mockResolvedValue("result");
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("result");
    expect(result.current.error).toBeNull();
  });

  it("sets error when the loader rejects", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("fail");
  });

  it("does not run when enabled is false", async () => {
    const loader = vi.fn().mockResolvedValue("result");
    const { result } = renderHook(() => useAsync(loader, [], false));

    // Give it a tick to settle
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("clears stale data when dependencies change", async () => {
    let resolveFirst: (v: string) => void;
    let resolveSecond: (v: string) => void;
    const firstPromise = new Promise<string>((r) => { resolveFirst = r; });
    const secondPromise = new Promise<string>((r) => { resolveSecond = r; });

    const loader = vi.fn()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    let dep = "testnet";
    const { result, rerender } = renderHook(() => useAsync(loader, [dep]));

    // Resolve first load
    await act(async () => { resolveFirst!("testnet-data"); });
    expect(result.current.data).toBe("testnet-data");
    expect(result.current.loading).toBe(false);

    // Change dependency (simulates network switch)
    dep = "mainnet";
    rerender();

    // Data should be cleared immediately while loading new data
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    // Resolve second load
    await act(async () => { resolveSecond!("mainnet-data"); });
    expect(result.current.data).toBe("mainnet-data");
    expect(result.current.loading).toBe(false);
  });

  it("ignores out-of-order responses", async () => {
    let resolveFirst: (v: string) => void;
    let resolveSecond: (v: string) => void;
    const firstPromise = new Promise<string>((r) => { resolveFirst = r; });
    const secondPromise = new Promise<string>((r) => { resolveSecond = r; });

    const loader = vi.fn()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    let dep = "a";
    const { result, rerender } = renderHook(() => useAsync(loader, [dep]));

    // Trigger second request before first resolves
    dep = "b";
    rerender();

    // Second resolves first
    await act(async () => { resolveSecond!("b-data"); });
    expect(result.current.data).toBe("b-data");

    // First resolves late — should be ignored
    await act(async () => { resolveFirst!("a-data"); });
    expect(result.current.data).toBe("b-data");
  });

  it("refetch triggers a new load", async () => {
    let callCount = 0;
    const loader = vi.fn().mockImplementation(() => Promise.resolve(`result-${++callCount}`));
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("result-1");

    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("result-2");
  });
});
