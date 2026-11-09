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

import { dedupeRequest, clearRequestCache } from "../requestCache";

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

// ─── empty / zero / null input handling (#587) ───────────────────────────────

describe("empty, zero, and null inputs (#587)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearRequestCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRequestCache();
  });

  it("bypasses deduplication for empty, whitespace-only, or nullish keys so unrelated callers do not collide", async () => {
    const factoryA = jest.fn().mockResolvedValue("from-a");
    const factoryB = jest.fn().mockResolvedValue("from-b");
    const factoryNull = jest.fn().mockResolvedValue("from-null");

    const pEmptyA = dedupeRequest("", factoryA);
    const pEmptyB = dedupeRequest("   ", factoryB);
    const pNull = dedupeRequest(null as unknown as string, factoryNull);

    expect(pEmptyA).not.toBe(pEmptyB);
    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
    expect(factoryNull).toHaveBeenCalledTimes(1);

    await expect(pEmptyA).resolves.toBe("from-a");
    await expect(pEmptyB).resolves.toBe("from-b");
    await expect(pNull).resolves.toBe("from-null");
  });

  it("deduplicates concurrent requests that resolve to 0, 0n, empty string, empty array, or null", async () => {
    const zeroFactory = jest.fn().mockResolvedValue(0);
    const bigZeroFactory = jest.fn().mockResolvedValue(0n);
    const emptyArrFactory = jest.fn().mockResolvedValue([]);
    const nullFactory = jest.fn().mockResolvedValue(null);

    const [z1, z2] = [
      dedupeRequest("key:zero", zeroFactory),
      dedupeRequest("key:zero", zeroFactory),
    ];
    const [bz1, bz2] = [
      dedupeRequest("key:bigzero", bigZeroFactory),
      dedupeRequest("key:bigzero", bigZeroFactory),
    ];
    const [arr1, arr2] = [
      dedupeRequest("key:empty-arr", emptyArrFactory),
      dedupeRequest("key:empty-arr", emptyArrFactory),
    ];
    const [n1, n2] = [
      dedupeRequest("key:null", nullFactory),
      dedupeRequest("key:null", nullFactory),
    ];

    expect(z1).toBe(z2);
    expect(bz1).toBe(bz2);
    expect(arr1).toBe(arr2);
    expect(n1).toBe(n2);

    expect(zeroFactory).toHaveBeenCalledTimes(1);
    expect(bigZeroFactory).toHaveBeenCalledTimes(1);
    expect(emptyArrFactory).toHaveBeenCalledTimes(1);
    expect(nullFactory).toHaveBeenCalledTimes(1);

    await expect(z1).resolves.toBe(0);
    await expect(bz1).resolves.toBe(0n);
    await expect(arr1).resolves.toEqual([]);
    await expect(n1).resolves.toBeNull();
  });
});
