import { renderHook, waitFor } from "@testing-library/react";
import { useAsset } from "../useAsset";
import { registry, assetToken } from "@/lib/contracts";
import type { AssetEntry, AssetMetadata } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  registry: {
    getAsset: jest.fn(),
  },
  assetToken: {
    getMetadata: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: BigInt(1),
    tokenContract: "TOKEN_CONTRACT_A",
    issuer: "GISSUER",
    name: "Test Real Estate",
    assetType: "real_estate",
    valuation: BigInt(500_000_00),
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    name: "Test Real Estate",
    symbol: "TRE",
    assetType: "real_estate",
    totalSupply: BigInt(1_000_000),
    decimals: 7,
    admin: "GADMIN",
    complianceContract: "COMPLIANCE_CONTRACT",
    assetDescription: "A tokenised real estate asset",
    valuation: BigInt(500_000_00),
    paused: false,
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useAsset", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── id = null (disabled) ─────────────────────────────────────────────────

  it("does not fetch and has loading=false when id is null", () => {
    const { result } = renderHook(() => useAsset(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(registry.getAsset).not.toHaveBeenCalled();
    expect(assetToken.getMetadata).not.toHaveBeenCalled();
  });

  // ── happy path ───────────────────────────────────────────────────────────

  it("fetches registry entry then token metadata and returns joined detail", async () => {
    const entry = makeEntry();
    const metadata = makeMetadata();

    (registry.getAsset as jest.Mock).mockResolvedValue(entry);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(metadata);

    const { result } = renderHook(() => useAsset(BigInt(1)));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(registry.getAsset).toHaveBeenCalledWith("testnet", BigInt(1));
    expect(assetToken.getMetadata).toHaveBeenCalledWith(
      "testnet",
      entry.tokenContract,
    );
    expect(result.current.data).toEqual({ ...entry, metadata });
    expect(result.current.error).toBeNull();
  });

  // ── unknown / invalid id ─────────────────────────────────────────────────

  it("surfaces an error when the registry does not recognise the id", async () => {
    (registry.getAsset as jest.Mock).mockRejectedValue(
      new Error("Asset not found"),
    );

    const { result } = renderHook(() => useAsset(BigInt(9999)));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Asset not found");
    expect(result.current.data).toBeNull();
    // Metadata must not have been fetched when the registry call failed
    expect(assetToken.getMetadata).not.toHaveBeenCalled();
  });

  it("surfaces an error when token metadata fetch fails", async () => {
    const entry = makeEntry();
    (registry.getAsset as jest.Mock).mockResolvedValue(entry);
    (assetToken.getMetadata as jest.Mock).mockRejectedValue(
      new Error("Metadata unavailable"),
    );

    const { result } = renderHook(() => useAsset(BigInt(1)));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Metadata unavailable");
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  // ── id transitions ───────────────────────────────────────────────────────

  it("does not fetch when id transitions from a value to null", async () => {
    const entry = makeEntry({ id: BigInt(1) });
    const metadata = makeMetadata();

    (registry.getAsset as jest.Mock).mockResolvedValue(entry);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(metadata);

    let id: bigint | null = BigInt(1);
    const { result, rerender } = renderHook(() => useAsset(id));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ ...entry, metadata });

    // Transition to null — hook should be disabled again
    jest.clearAllMocks();
    id = null;
    rerender();

    expect(result.current.loading).toBe(false);
    expect(registry.getAsset).not.toHaveBeenCalled();
  });

  it("re-fetches when the id changes to a different value", async () => {
    const entry1 = makeEntry({ id: BigInt(1), name: "Asset One" });
    const entry2 = makeEntry({ id: BigInt(2), name: "Asset Two", tokenContract: "TOKEN_B" });
    const metadata1 = makeMetadata({ name: "Asset One" });
    const metadata2 = makeMetadata({ name: "Asset Two" });

    (registry.getAsset as jest.Mock)
      .mockResolvedValueOnce(entry1)
      .mockResolvedValueOnce(entry2);
    (assetToken.getMetadata as jest.Mock)
      .mockResolvedValueOnce(metadata1)
      .mockResolvedValueOnce(metadata2);

    let id = BigInt(1);
    const { result, rerender } = renderHook(() => useAsset(id));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.name).toBe("Asset One");

    id = BigInt(2);
    rerender();

    await waitFor(() =>
      expect(result.current.data?.name).toBe("Asset Two"),
    );
    expect(registry.getAsset).toHaveBeenCalledTimes(2);
    expect(registry.getAsset).toHaveBeenLastCalledWith("testnet", BigInt(2));
  });
});
