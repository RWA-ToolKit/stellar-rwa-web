import { renderHook, waitFor } from "@testing-library/react";
import { useHolderTotals } from "../useHolderTotals";
import { assetToken, compliance } from "@/lib/contracts";
import { api } from "@/lib/api";
import type { AssetEntry } from "@/types";

jest.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: jest.fn(),
  },
  compliance: {
    getAllowlist: jest.fn(),
  },
}));

jest.mock("@/lib/api", () => ({
  api: {
    getStats: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

describe("useHolderTotals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when assets is null, and 0 for an empty array", async () => {
    const { result: res1 } = renderHook(() => useHolderTotals(null));
    expect(res1.current.data).toBeNull();
    expect(res1.current.loading).toBe(false);

    const { result: res2 } = renderHook(() => useHolderTotals([]));
    await waitFor(() => expect(res2.current.loading).toBe(false));
    expect(res2.current.data).toBe(0);
  });

  it("returns totalHolders from api.getStats when stats are available", async () => {
    (api.getStats as jest.Mock).mockResolvedValue({ totalHolders: 42 });

    const dummyAsset: AssetEntry = {
      id: "1",
      code: "USDX",
      tokenContract: "T1",
      issuer: "G1",
      supply: 1000n,
      holders: 5,
    };

    const { result } = renderHook(() => useHolderTotals([dummyAsset]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.getStats).toHaveBeenCalled();
    expect(result.current.data).toBe(42);
    expect(assetToken.getMetadata).not.toHaveBeenCalled();
  });

  it("deduplicates compliance contract reads across assets and counts unique holders when api stats are null", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);

    const assets: AssetEntry[] = [
      { id: "1", code: "USDX", tokenContract: "T1", issuer: "G1", supply: 100n, holders: 2 },
      { id: "2", code: "GOLD", tokenContract: "T2", issuer: "G1", supply: 200n, holders: 2 },
      { id: "3", code: "BOND", tokenContract: "T3", issuer: "G2", supply: 300n, holders: 2 },
    ];

    // T1 and T2 share compliance contract C1, while T3 uses compliance contract C2
    (assetToken.getMetadata as jest.Mock).mockImplementation(async (_net, tokenContract) => {
      if (tokenContract === "T1" || tokenContract === "T2") {
        return { complianceContract: "C1" };
      }
      return { complianceContract: "C2" };
    });

    (compliance.getAllowlist as jest.Mock).mockImplementation(async (_net, complianceContract) => {
      if (complianceContract === "C1") {
        return ["addr1", "addr2"];
      }
      if (complianceContract === "C2") {
        return ["addr2", "addr3"];
      }
      return [];
    });

    const { result } = renderHook(() => useHolderTotals(assets));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify metadata fetched for all 3 assets
    expect(assetToken.getMetadata).toHaveBeenCalledTimes(3);

    // Assert deduplication: compliance.getAllowlist was called ONLY twice (once for C1, once for C2)
    expect(compliance.getAllowlist).toHaveBeenCalledTimes(2);
    expect(compliance.getAllowlist).toHaveBeenCalledWith("testnet", "C1");
    expect(compliance.getAllowlist).toHaveBeenCalledWith("testnet", "C2");

    // Total unique addresses: addr1, addr2, addr3 = 3
    expect(result.current.data).toBe(3);
  });

  it("handles contract read failure gracefully", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (assetToken.getMetadata as jest.Mock).mockRejectedValue(new Error("Failed to read metadata"));

    const assets: AssetEntry[] = [
      { id: "1", code: "USDX", tokenContract: "T1", issuer: "G1", supply: 100n, holders: 2 },
    ];

    const { result } = renderHook(() => useHolderTotals(assets));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to read metadata");
    expect(result.current.data).toBeNull();
  });
});
