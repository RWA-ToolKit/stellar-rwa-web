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
import {
  dedupeRequest,
  clearRequestCache,
  clearNetworkRequestCache,
} from "../requestCache";
import { useHolders } from "@/hooks/useHolders";
import { compliance, assetToken } from "@/lib/contracts";
import { api } from "@/lib/api";
import type { Network } from "@/types";

let mockNetwork: Network = "testnet";

jest.mock("@/lib/contracts", () => ({
  compliance: {
    getAllowlist: jest.fn(),
  },
  assetToken: {
    balance: jest.fn(),
  },
}));

jest.mock("@/lib/api", () => ({
  api: {
    getHolders: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockNetwork }),
}));

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

// ─── network switch mid-session (#590) ────────────────────────────────────────

describe("network switch mid-session (#590)", () => {
  beforeEach(() => {
    mockNetwork = "testnet";
    clearRequestCache();
    jest.clearAllMocks();
    (api.getHolders as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    clearRequestCache();
  });

  it("does not leak cached or in-flight testnet entries when switching to mainnet", async () => {
    let resolveTestnet!: (val: string[]) => void;
    const testnetFactory = jest.fn(
      () =>
        new Promise<string[]>((res) => {
          resolveTestnet = res;
        }),
    );
    const mainnetFactory = jest.fn().mockResolvedValue(["G_MAINNET"]);

    const pTestnet = dedupeRequest("allowlist:testnet:C123", testnetFactory);
    const pMainnet = dedupeRequest("allowlist:mainnet:C123", mainnetFactory);

    expect(pTestnet).not.toBe(pMainnet);
    expect(testnetFactory).toHaveBeenCalledTimes(1);
    expect(mainnetFactory).toHaveBeenCalledTimes(1);

    await expect(pMainnet).resolves.toEqual(["G_MAINNET"]);

    clearNetworkRequestCache("testnet");
    resolveTestnet(["G_TESTNET"]);
    await expect(pTestnet).resolves.toEqual(["G_TESTNET"]);

    // Subsequent testnet request after eviction invokes factory anew
    const pTestnetRetry = dedupeRequest("allowlist:testnet:C123", testnetFactory);
    expect(pTestnetRetry).not.toBe(pTestnet);
    expect(testnetFactory).toHaveBeenCalledTimes(2);
  });

  it("prevents stale-network holder data from leaking into hook state on a mid-flight network switch", async () => {
    let resolveSlowTestnet!: (addrs: string[]) => void;
    (compliance.getAllowlist as jest.Mock).mockImplementation((net: Network) => {
      if (net === "testnet") {
        return new Promise<string[]>((res) => {
          resolveSlowTestnet = res;
        });
      }
      return Promise.resolve(["G_MAINNET_HOLDER"]);
    });
    (assetToken.balance as jest.Mock).mockImplementation(
      (_net: Network, _token: string, addr: string) =>
        Promise.resolve(addr === "G_MAINNET_HOLDER" ? 900n : 100n),
    );

    const { result, rerender } = renderHook(() =>
      useHolders("COMP_1", "TOKEN_1"),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    // User switches network from testnet to mainnet while testnet allowlist is still in-flight
    mockNetwork = "mainnet";
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([
      { address: "G_MAINNET_HOLDER", balance: 900n },
    ]);

    // Late testnet response resolves — must never overwrite mainnet UI state
    await act(async () => {
      resolveSlowTestnet(["G_TESTNET_STALE"]);
    });

    expect(result.current.data).toEqual([
      { address: "G_MAINNET_HOLDER", balance: 900n },
    ]);
  });

  it("clears settled testnet data immediately on switch to mainnet before mainnet settles", async () => {
    let resolveMainnet!: (addrs: string[]) => void;
    (compliance.getAllowlist as jest.Mock).mockImplementation((net: Network) => {
      if (net === "testnet") {
        return Promise.resolve(["G_TESTNET_HOLDER"]);
      }
      return new Promise<string[]>((res) => {
        resolveMainnet = res;
      });
    });
    (assetToken.balance as jest.Mock).mockImplementation(
      (_net: Network, _token: string, addr: string) =>
        Promise.resolve(addr === "G_TESTNET_HOLDER" ? 250n : 750n),
    );

    const { result, rerender } = renderHook(() =>
      useHolders("COMP_2", "TOKEN_2"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([
      { address: "G_TESTNET_HOLDER", balance: 250n },
    ]);

    // Switch to mainnet — testnet data must be cleared immediately while mainnet loads
    mockNetwork = "mainnet";
    rerender();

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveMainnet(["G_MAINNET_FRESH"]);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([
      { address: "G_MAINNET_FRESH", balance: 750n },
    ]);
  });
});
