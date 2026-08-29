import { renderHook, waitFor } from "@testing-library/react";
import { useHolders } from "../useHolders";
import { compliance, assetToken } from "@/lib/contracts";
import { api } from "@/lib/api";

// ─── mocks ────────────────────────────────────────────────────────────────────

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
  useWallet: () => ({ network: "testnet" }),
}));

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useHolders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not fetch and returns null/empty when parameters are missing", async () => {
    const { result } = renderHook(() => useHolders(null, "TOKEN_A"));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(compliance.getAllowlist).not.toHaveBeenCalled();

    const { result: result2 } = renderHook(() => useHolders("COMP_A", null));
    expect(result2.current.loading).toBe(false);
    expect(result2.current.data).toBeNull();
  });

  it("returns holders from API when api.getHolders succeeds, sorted by balance descending", async () => {
    (api.getHolders as jest.Mock).mockResolvedValue([
      { address: "HOLDER_1", balance: 500n },
      { address: "HOLDER_2", balance: 1000n },
      { address: "HOLDER_ZERO", balance: 0n },
    ]);

    const { result } = renderHook(() => useHolders("COMP_A", "TOKEN_A"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.getHolders).toHaveBeenCalledWith("TOKEN_A");
    expect(result.current.data).toEqual([
      { address: "HOLDER_2", balance: 1000n },
      { address: "HOLDER_1", balance: 500n },
    ]);
  });

  it("handles an asset with a single holder at 100%", async () => {
    (api.getHolders as jest.Mock).mockResolvedValue([
      { address: "SOLO_HOLDER", balance: 1000000n },
    ]);

    const { result } = renderHook(() => useHolders("COMP_A", "TOKEN_A"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([
      { address: "SOLO_HOLDER", balance: 1000000n },
    ]);
  });

  it("falls back to allowlist + contract balances when api.getHolders returns null", async () => {
    (api.getHolders as jest.Mock).mockResolvedValue(null);
    (compliance.getAllowlist as jest.Mock).mockResolvedValue([
      "ADDR_1",
      "ADDR_2",
      "ADDR_3",
    ]);
    (assetToken.balance as jest.Mock).mockImplementation((_net, _contract, addr) => {
      if (addr === "ADDR_1") return Promise.resolve(200n);
      if (addr === "ADDR_2") return Promise.resolve(0n);
      if (addr === "ADDR_3") return Promise.resolve(800n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(() => useHolders("COMP_A", "TOKEN_A"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(compliance.getAllowlist).toHaveBeenCalledWith("testnet", "COMP_A");
    expect(assetToken.balance).toHaveBeenCalledTimes(3);
    expect(result.current.data).toEqual([
      { address: "ADDR_3", balance: 800n },
      { address: "ADDR_1", balance: 200n },
    ]);
  });

  it("refetches when refreshKey changes", async () => {
    (api.getHolders as jest.Mock).mockResolvedValue([
      { address: "HOLDER_1", balance: 500n },
    ]);

    let refreshKey = 0;
    const { result, rerender } = renderHook(() =>
      useHolders("COMP_A", "TOKEN_A", refreshKey),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.getHolders).toHaveBeenCalledTimes(1);

    refreshKey = 1;
    rerender();

    await waitFor(() => expect(api.getHolders).toHaveBeenCalledTimes(2));
  });
});
