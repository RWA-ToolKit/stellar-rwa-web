import { renderHook, waitFor } from "@testing-library/react";
import { useDividends } from "../useDividends";
import { dividend } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import type { Distribution } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  dividend: {
    getDistributionsForAsset: jest.fn(),
    claimable: jest.fn(),
    hasClaimed: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.Mock;

function makeDistribution(overrides: Partial<Distribution> = {}): Distribution {
  return {
    id: BigInt(1),
    assetToken: "TOKEN_A",
    amount: BigInt(1000),
    blockTimestamp: 1600000000,
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useDividends", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({ network: "testnet", address: "GUSER123" });
  });

  it("does not fetch and returns empty array when assetToken is null", async () => {
    const { result } = renderHook(() => useDividends(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(dividend.getDistributionsForAsset).not.toHaveBeenCalled();
  });

  it("returns distributions annotated with claimable and claimed when assetToken is provided and wallet connected", async () => {
    const dist1 = makeDistribution({ id: BigInt(1), amount: BigInt(100) });
    const dist2 = makeDistribution({ id: BigInt(2), amount: BigInt(200) });

    (dividend.getDistributionsForAsset as jest.Mock).mockResolvedValue([dist1, dist2]);
    (dividend.claimable as jest.Mock).mockImplementation((_net, id) => {
      return Promise.resolve(id === BigInt(1) ? BigInt(50) : BigInt(0));
    });
    (dividend.hasClaimed as jest.Mock).mockImplementation((_net, id) => {
      return Promise.resolve(id === BigInt(2));
    });

    const { result } = renderHook(() => useDividends("TOKEN_A"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(dividend.getDistributionsForAsset).toHaveBeenCalledWith("testnet", "TOKEN_A");
    expect(result.current.data).toEqual([
      { ...dist1, claimable: BigInt(50), claimed: false },
      { ...dist2, claimable: BigInt(0), claimed: true },
    ]);
  });

  it("returns empty array when there are no distributions for the asset", async () => {
    (dividend.getDistributionsForAsset as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useDividends("TOKEN_EMPTY"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(dividend.claimable).not.toHaveBeenCalled();
    expect(dividend.hasClaimed).not.toHaveBeenCalled();
  });

  it("returns distributions with default claimable: 0n and claimed: false when wallet is disconnected", async () => {
    mockUseWallet.mockReturnValue({ network: "testnet", address: null });

    const dist = makeDistribution({ id: BigInt(1) });
    (dividend.getDistributionsForAsset as jest.Mock).mockResolvedValue([dist]);

    const { result } = renderHook(() => useDividends("TOKEN_A"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([
      { ...dist, claimable: 0n, claimed: false },
    ]);
    expect(dividend.claimable).not.toHaveBeenCalled();
    expect(dividend.hasClaimed).not.toHaveBeenCalled();
  });
});
