/**
 * Tests for useHolderTotals hook
 *
 * Covers:
 *  - empty set of assets → returns 0
 *  - null assets → returns 0
 *  - single asset: allowlist length
 *  - deduplication: two assets sharing the same compliance contract are
 *    counted only once (no double-count)
 *  - union: two assets with *different* compliance contracts union their
 *    allowlists; addresses that appear in both are still only counted once
 */

import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { useHolderTotals } from "@/hooks/useHolderTotals";
import type { AssetEntry } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the heavy @stellar/stellar-sdk so it doesn't attempt native bindings
jest.mock("@stellar/stellar-sdk", () => ({}));

// Mock contract bindings – we control what getMetadata and getAllowlist return
jest.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: jest.fn(),
  },
  compliance: {
    getAllowlist: jest.fn(),
  },
}));

// Mock useWallet to provide a stable network value
jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { assetToken, compliance } from "@/lib/contracts";

const mockGetMetadata = assetToken.getMetadata as jest.MockedFunction<
  typeof assetToken.getMetadata
>;
const mockGetAllowlist = compliance.getAllowlist as jest.MockedFunction<
  typeof compliance.getAllowlist
>;

/** Minimal AssetEntry factory */
function makeAsset(
  id: bigint,
  tokenContract: string,
): AssetEntry {
  return {
    id,
    tokenContract,
    issuer: "ISSUER",
    name: `Asset ${id}`,
    assetType: "real_estate",
    valuation: 100_00n,
    createdAt: 0,
    active: true,
  };
}

/** Minimal AssetMetadata factory */
function makeMetadata(complianceContract: string) {
  return {
    name: "Test",
    symbol: "TST",
    assetType: "real_estate",
    totalSupply: 1000n,
    decimals: 7,
    admin: "ADMIN",
    complianceContract,
    assetDescription: "",
    valuation: 100_00n,
    paused: false,
  };
}

// ---------------------------------------------------------------------------
// Wrapper providing the WalletProvider context (already mocked above, but
// renderHook needs a real React tree for hooks that use React context).
// Since useWallet is fully mocked, a bare wrapper is sufficient.
// ---------------------------------------------------------------------------
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useHolderTotals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 0 immediately when assets is null (disabled state)", () => {
    const { result } = renderHook(() => useHolderTotals(null), { wrapper });
    // enabled=false → loading starts as false, data is null → treat as 0
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("returns 0 for an empty asset array", async () => {
    const { result } = renderHook(() => useHolderTotals([]), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe(0);
    expect(mockGetMetadata).not.toHaveBeenCalled();
    expect(mockGetAllowlist).not.toHaveBeenCalled();
  });

  it("returns the allowlist size for a single asset", async () => {
    const asset = makeAsset(1n, "TOKEN_A");
    mockGetMetadata.mockResolvedValue(makeMetadata("COMPLIANCE_1"));
    mockGetAllowlist.mockResolvedValue(["ADDR_1", "ADDR_2", "ADDR_3"]);

    const { result } = renderHook(() => useHolderTotals([asset]), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe(3);
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    expect(mockGetMetadata).toHaveBeenCalledWith("testnet", "TOKEN_A");
    expect(mockGetAllowlist).toHaveBeenCalledTimes(1);
    expect(mockGetAllowlist).toHaveBeenCalledWith("testnet", "COMPLIANCE_1");
  });

  it("dedupes by compliance contract: two assets sharing the same compliance contract call getAllowlist only once", async () => {
    const asset1 = makeAsset(1n, "TOKEN_A");
    const asset2 = makeAsset(2n, "TOKEN_B");

    // Both tokens point at the same compliance contract
    mockGetMetadata
      .mockResolvedValueOnce(makeMetadata("SHARED_COMPLIANCE"))
      .mockResolvedValueOnce(makeMetadata("SHARED_COMPLIANCE"));

    mockGetAllowlist.mockResolvedValue(["ADDR_1", "ADDR_2"]);

    const { result } = renderHook(
      () => useHolderTotals([asset1, asset2]),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // getAllowlist must only be called once (deduped via Set)
    expect(mockGetAllowlist).toHaveBeenCalledTimes(1);
    expect(mockGetAllowlist).toHaveBeenCalledWith("testnet", "SHARED_COMPLIANCE");

    // Unique address count from the single compliance contract
    expect(result.current.data).toBe(2);
  });

  it("unions allowlists from different compliance contracts", async () => {
    const asset1 = makeAsset(1n, "TOKEN_A");
    const asset2 = makeAsset(2n, "TOKEN_B");

    mockGetMetadata
      .mockResolvedValueOnce(makeMetadata("COMPLIANCE_1"))
      .mockResolvedValueOnce(makeMetadata("COMPLIANCE_2"));

    // Each contract returns a distinct allowlist
    mockGetAllowlist
      .mockResolvedValueOnce(["ADDR_1", "ADDR_2"])
      .mockResolvedValueOnce(["ADDR_3", "ADDR_4"]);

    const { result } = renderHook(
      () => useHolderTotals([asset1, asset2]),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAllowlist).toHaveBeenCalledTimes(2);
    // Union → 4 unique addresses
    expect(result.current.data).toBe(4);
  });

  it("deduplicates addresses that appear in multiple compliance allowlists", async () => {
    const asset1 = makeAsset(1n, "TOKEN_A");
    const asset2 = makeAsset(2n, "TOKEN_B");

    mockGetMetadata
      .mockResolvedValueOnce(makeMetadata("COMPLIANCE_1"))
      .mockResolvedValueOnce(makeMetadata("COMPLIANCE_2"));

    // ADDR_2 appears in both lists — must only be counted once
    mockGetAllowlist
      .mockResolvedValueOnce(["ADDR_1", "ADDR_2"])
      .mockResolvedValueOnce(["ADDR_2", "ADDR_3"]);

    const { result } = renderHook(
      () => useHolderTotals([asset1, asset2]),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 3 unique addresses (ADDR_1, ADDR_2, ADDR_3)
    expect(result.current.data).toBe(3);
  });

  it("handles empty allowlists gracefully (0 holders)", async () => {
    const asset = makeAsset(1n, "TOKEN_A");
    mockGetMetadata.mockResolvedValue(makeMetadata("COMPLIANCE_1"));
    mockGetAllowlist.mockResolvedValue([]);

    const { result } = renderHook(() => useHolderTotals([asset]), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe(0);
  });

  it("exposes an error when a contract call rejects", async () => {
    const asset = makeAsset(1n, "TOKEN_A");
    mockGetMetadata.mockRejectedValue(new Error("RPC timeout"));

    const { result } = renderHook(() => useHolderTotals([asset]), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("RPC timeout");
    expect(result.current.data).toBeNull();
  });
});
