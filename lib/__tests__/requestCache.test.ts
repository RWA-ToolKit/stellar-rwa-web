/**
 * Unit tests for lib/requestCache.ts
 *
 * Scenarios covered:
 *
 * dedupeRequest
 *   - Calls the factory once when two concurrent callers use the same key
 *   - Calls the factory separately for different keys
 *   - Calls the factory again after the first promise settles (and the
 *     internal setTimeout(0) cleanup has run)
 *   - Shares a rejection with all concurrent callers
 *   - Does not re-use a rejected entry (next call invokes factory again)
 *   - Re-uses the same entry within the 5 s window even after settlement
 *
 * clearRequestCache
 *   - Resets all in-flight entries so the next call invokes the factory
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { dedupeRequest, clearRequestCache } from "../requestCache";
import { useAsync } from "@/hooks/useAsync";

// ─── tests ────────────────────────────────────────────────────────────────────

describe("dedupeRequest", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearRequestCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRequestCache();
  });

  // ── concurrent callers ─────────────────────────────────────────────────

  it("calls the factory once for concurrent callers sharing the same key", async () => {
    const factory = jest.fn().mockResolvedValue("result");

    const requests = Array.from({ length: 5 }, () =>
      dedupeRequest("key-a", factory),
    );

    expect(factory).toHaveBeenCalledTimes(1);
    requests.forEach((request) => expect(request).toBe(requests[0]));

    await expect(Promise.all(requests)).resolves.toEqual(
      Array(5).fill("result"),
    );
  });

  it("calls the factory separately for different keys", async () => {
    const factoryA = jest.fn().mockResolvedValue("a");
    const factoryB = jest.fn().mockResolvedValue("b");

    const pA = dedupeRequest("key-a", factoryA);
    const pB = dedupeRequest("key-b", factoryB);

    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
    expect(pA).not.toBe(pB);

    await expect(pA).resolves.toBe("a");
    await expect(pB).resolves.toBe("b");
  });

  // ── post-settlement refetch ────────────────────────────────────────────

  it("calls the factory again after settlement and the cleanup setTimeout(0) fires", async () => {
    const factory = jest.fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const p1 = dedupeRequest("key-a", factory);
    await p1; // settle the promise

    // Run the setTimeout(0) cleanup that requestCache registers internally
    jest.runAllTimers();

    const p2 = dedupeRequest("key-a", factory);
    expect(factory).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toBe("second");
  });

  // ── within the 5 s window ──────────────────────────────────────────────

  it("re-uses the same entry within the 5 s dedup window", () => {
    const factory = jest.fn().mockReturnValue(new Promise(() => {}));

    const p1 = dedupeRequest("key-a", factory);
    jest.advanceTimersByTime(4_999);
    const p2 = dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);
  });

  it("calls the factory again after the 5 s window expires", () => {
    const factory = jest.fn().mockReturnValue(new Promise(() => {}));

    dedupeRequest("key-a", factory);
    jest.advanceTimersByTime(5_001);
    dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(2);
  });

  // ── rejection handling ─────────────────────────────────────────────────

  it("shares a rejection with all concurrent callers for the same key", async () => {
    const err = new Error("network failure");
    const factory = jest.fn().mockRejectedValue(err);

    const p1 = dedupeRequest("key-a", factory);
    const p2 = dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);

    await expect(p1).rejects.toThrow("network failure");
    await expect(p2).rejects.toThrow("network failure");
  });

  it("does not cache a rejected entry — next call invokes factory again", async () => {
    const err = new Error("transient error");
    const factory = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce("recovered");

    const p1 = dedupeRequest("key-a", factory);
    await expect(p1).rejects.toThrow("transient error");

    // Flush the setTimeout(0) cleanup
    jest.runAllTimers();

    const p2 = dedupeRequest("key-a", factory);
    expect(factory).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toBe("recovered");
  });
});

// ─── clearRequestCache ─────────────────────────────────────────────────────────

describe("clearRequestCache", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearRequestCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRequestCache();
  });

  it("resets all entries so the next call invokes the factory", () => {
    const factory = jest.fn().mockReturnValue(new Promise(() => {}));

    dedupeRequest("key-a", factory);
    dedupeRequest("key-b", factory);
    expect(factory).toHaveBeenCalledTimes(2);

    clearRequestCache();

    dedupeRequest("key-a", factory);
    dedupeRequest("key-b", factory);
    expect(factory).toHaveBeenCalledTimes(4);
  });

  it("allows concurrent calls after clear to share a single factory invocation", async () => {
    const factory = jest.fn().mockResolvedValue("after-clear");

    dedupeRequest("key-a", factory);
    clearRequestCache();

    const p1 = dedupeRequest("key-a", factory);
    const p2 = dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(2); // 1 before clear + 1 after
    expect(p1).toBe(p2);
    await expect(p1).resolves.toBe("after-clear");
  });
});

// ─── stale closure / dependency array audit (#588) ──────────────────────────

describe("stale closure and dependency array audit (#588)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearRequestCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRequestCache();
  });

  it("invokes the updated factory closure immediately when key reflects new closure inputs", async () => {
    let capturedParam = "initial";
    const calls: string[] = [];

    const p1 = dedupeRequest(`req:${capturedParam}`, async () => {
      calls.push(capturedParam);
      return `value:${capturedParam}`;
    });

    capturedParam = "updated";
    const p2 = dedupeRequest(`req:${capturedParam}`, async () => {
      calls.push(capturedParam);
      return `value:${capturedParam}`;
    });

    expect(p1).not.toBe(p2);
    await expect(p1).resolves.toBe("value:initial");
    await expect(p2).resolves.toBe("value:updated");
    expect(calls).toEqual(["initial", "updated"]);
  });

  it("never retains a stale factory closure after settlement and timer cleanup", async () => {
    let version = 1;
    const firstClosure = jest.fn(async () => `v${version}`);

    await expect(dedupeRequest("same-key", firstClosure)).resolves.toBe("v1");
    jest.runAllTimers();

    version = 2;
    const secondClosure = jest.fn(async () => `v${version}`);
    await expect(dedupeRequest("same-key", secondClosure)).resolves.toBe("v2");

    expect(firstClosure).toHaveBeenCalledTimes(1);
    expect(secondClosure).toHaveBeenCalledTimes(1);
  });

  it("uses the latest closure values across hook rerenders and manual refetch", async () => {
    jest.useRealTimers();
    const seenArgs: Array<{ complianceId: string; suffix: string }> = [];

    const { result, rerender } = renderHook(
      ({ complianceId, suffix }: { complianceId: string; suffix: string }) =>
        useAsync(
          () =>
            dedupeRequest(`allowlist:testnet:${complianceId}`, async () => {
              seenArgs.push({ complianceId, suffix });
              return `${complianceId}:${suffix}`;
            }),
          [complianceId],
        ),
      { initialProps: { complianceId: "C_1", suffix: "s1" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("C_1:s1");

    // Rerender with updated complianceId and suffix
    rerender({ complianceId: "C_2", suffix: "s2" });
    await waitFor(() => expect(result.current.data).toBe("C_2:s2"));

    // Even if only a non-dep prop changes before manual refetch(), loaderRef
    // ensures refetch() executes the latest closure rather than a stale one.
    rerender({ complianceId: "C_2", suffix: "s3" });
    await new Promise((r) => setTimeout(r, 10));
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.data).toBe("C_2:s3"));

    expect(seenArgs).toEqual([
      { complianceId: "C_1", suffix: "s1" },
      { complianceId: "C_2", suffix: "s2" },
      { complianceId: "C_2", suffix: "s3" },
    ]);
  });
});
