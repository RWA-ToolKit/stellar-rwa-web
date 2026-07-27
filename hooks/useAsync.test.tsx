import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsync } from "./useAsync";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsync", () => {
  it("starts loading, then transitions to data on success", async () => {
    const { promise, resolve } = deferred<string>();
    const loader = vi.fn(() => promise);
    const { result } = renderHook(() => useAsync(loader, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    resolve("hello");
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe("hello");
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state when the loader rejects", async () => {
    const { promise, reject } = deferred<string>();
    const loader = vi.fn(() => promise);
    const { result } = renderHook(() => useAsync(loader, []));

    reject(new Error("boom"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("boom");
    expect(result.current.data).toBeNull();
  });

  it("falls back to a generic message for non-Error rejections", async () => {
    const loader = vi.fn(() => Promise.reject("nope"));
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Something went wrong.");
  });

  it("ignores a stale response that resolves after a newer request", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const loader = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    let dep = 1;
    const { result, rerender } = renderHook(() => useAsync(loader, [dep]));

    dep = 2;
    rerender();
    expect(loader).toHaveBeenCalledTimes(2);

    // Resolve the newer request first, then the stale one.
    second.resolve("second");
    await waitFor(() => expect(result.current.data).toBe("second"));

    first.resolve("first");
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data).toBe("second");
  });

  it("defers when enabled is false and does not invoke the loader", async () => {
    const loader = vi.fn(() => Promise.resolve("data"));
    const { result } = renderHook(() => useAsync(loader, [], false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(loader).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("refetch re-runs the loader and resets state", async () => {
    let call = 0;
    const loader = vi.fn(() => Promise.resolve(`call-${++call}`));
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(result.current.data).toBe("call-1"));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe("call-2"));
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
