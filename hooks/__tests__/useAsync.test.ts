import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsync } from "../useAsync";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a loader that resolves after `delay` ms with `value`.
 * `signal` is an optional object whose `.called` flag lets us confirm the
 * loader was (or was not) invoked.
 */
function makeLoader<T>(
  value: T,
  delay = 0,
  signal?: { called: boolean },
): () => Promise<T> {
  return () => {
    if (signal) signal.called = true;
    return new Promise((resolve) => setTimeout(() => resolve(value), delay));
  };
}

/** Returns a loader that rejects with the given message after `delay` ms. */
function makeRejectingLoader(message: string, delay = 0): () => Promise<never> {
  return () =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), delay),
    );
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useAsync", () => {
  // ── basic lifecycle ──────────────────────────────────────────────────────

  it("starts in loading state when enabled (default)", () => {
    const loader = makeLoader("data", 1_000);
    const { result } = renderHook(() => useAsync(loader, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves data and clears loading on success", async () => {
    const loader = makeLoader("hello");
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe("hello");
    expect(result.current.error).toBeNull();
  });

  it("surfaces error message and clears loading on rejection", async () => {
    const loader = makeRejectingLoader("Network failure");
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network failure");
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("uses fallback error message for non-Error rejections", async () => {
    const loader = (): Promise<never> => Promise.reject("plain string error");
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Something went wrong.");
  });

  // ── enabled flag ─────────────────────────────────────────────────────────

  it("does not call the loader and sets loading=false when enabled=false", () => {
    const signal = { called: false };
    const loader = makeLoader("data", 0, signal);
    const { result } = renderHook(() => useAsync(loader, [], false));

    expect(result.current.loading).toBe(false);
    expect(signal.called).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("runs the loader once enabled flips to true", async () => {
    let enabled = false;
    const loader = makeLoader("ready");

    const { result, rerender } = renderHook(() =>
      useAsync(loader, [], enabled),
    );

    // Still disabled — no load
    expect(result.current.loading).toBe(false);

    enabled = true;
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("ready");
  });

  // ── stale response cancellation ──────────────────────────────────────────

  it("ignores a stale response when deps change before the first resolves", async () => {
    /**
     * We control two in-flight promises. The first loader is slow and resolves
     * with "stale". The second is instant and resolves with "fresh".
     *
     * When deps change (triggering a second invocation) the first result must
     * be discarded — the hook should only ever expose "fresh".
     */
    let resolveFirst!: (v: string) => void;
    const firstLoader = jest.fn(
      () => new Promise<string>((res) => { resolveFirst = res; }),
    );
    const secondLoader = jest.fn(() => Promise.resolve("fresh"));

    // Start with deps = [1], triggering firstLoader
    let deps = [1];
    let currentLoader = firstLoader;
    const { result, rerender } = renderHook(() =>
      useAsync(currentLoader, deps),
    );

    // Hook is loading, first request is in-flight
    expect(result.current.loading).toBe(true);
    expect(firstLoader).toHaveBeenCalledTimes(1);

    // Change deps — triggers a new (second) request with secondLoader
    deps = [2];
    currentLoader = secondLoader;
    rerender();

    // Wait for the second (fast) request to settle
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("fresh");

    // Now resolve the first (stale) request — it must be ignored
    act(() => { resolveFirst("stale"); });

    // Data must still be "fresh"; the stale value must not overwrite it
    expect(result.current.data).toBe("fresh");
    expect(result.current.loading).toBe(false);
  });

  it("ignores a stale error when deps change before the first rejects", async () => {
    let rejectFirst!: (e: Error) => void;
    const slowRejectLoader = jest.fn(
      () => new Promise<string>((_res, rej) => { rejectFirst = rej; }),
    );
    const fastSuccessLoader = jest.fn(() => Promise.resolve("ok"));

    let deps = [1];
    let currentLoader = slowRejectLoader;
    const { result, rerender } = renderHook(() =>
      useAsync(currentLoader, deps),
    );

    // Change deps — second request fires with fast success loader
    deps = [2];
    currentLoader = fastSuccessLoader;
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeNull();

    // First request now rejects — must be ignored
    act(() => { rejectFirst(new Error("stale error")); });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe("ok");
  });

  // ── refetch ───────────────────────────────────────────────────────────────

  it("refetch re-runs the loader and updates data", async () => {
    const loader = jest.fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("first");

    act(() => { result.current.refetch(); });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("second");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  // ── dep serialisation ────────────────────────────────────────────────────

  it("re-runs the loader when a dep value changes", async () => {
    const loader = jest.fn()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2");

    let dep = "a";
    const { result, rerender } = renderHook(() => useAsync(loader, [dep]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("v1");

    dep = "b";
    rerender();

    await waitFor(() => expect(result.current.data).toBe("v2"));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not re-run the loader when deps are the same value but different array identity", async () => {
    const loader = jest.fn().mockResolvedValue("stable");

    const { result, rerender } = renderHook(() => useAsync(loader, ["same"]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Rerender with a new array containing the same values
    rerender();

    // loader should still have been called exactly once
    expect(loader).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("stable");
  });
});
