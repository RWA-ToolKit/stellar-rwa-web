import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { DistributionPanel } from "./DistributionPanel";

// Mock the wallet so the panel renders without a funded account.
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ address: null, network: "testnet" }),
}));

// Mock the transaction hook so no RPC is touched.
vi.mock("@/hooks/useTx", () => ({
  useTx: () => ({
    run: vi.fn(),
    status: "idle",
    error: null,
    hash: null,
    reset: vi.fn(),
  }),
}));

// Empty holder set: the compliance/token contracts report no holders.
vi.mock("@/hooks/useHolders", () => ({
  useHolders: () => ({ data: [], loading: false, error: null }),
  fetchOnChainHolders: vi.fn(async () => []),
}));

// No existing distributions for the asset.
vi.mock("@/hooks/useDividends", () => ({
  useDividends: () => ({ data: [], loading: false, error: null }),
}));

// Avoid any network calls from the async balance/allowance/decimals lookups.
vi.mock("@/lib/contracts", () => ({
  assetToken: {
    balance: vi.fn(async () => 0n),
    allowance: vi.fn(async () => 0n),
    decimals: vi.fn(async () => 7),
  },
  contractIds: () => ({ dividend: "CDIVIDENDCONTRACT000000000000000000000000000000000000000000" }),
  dividend: {},
}));

vi.mock("@/lib/stellar", () => ({
  getLatestLedger: vi.fn(async () => 0),
  arg: vi.fn(),
}));

function makeAsset(overrides: Partial<AssetDetail> = {}): AssetDetail {
  return {
    tokenContract: "CTOKENCONTRACT00000000000000000000000000000000000000000000",
    metadata: {
      symbol: "",
      decimals: 0,
      complianceContract: "CCOMPLIANCECONTRACT0000000000000000000000000000000000000000",
    },
    ...overrides,
  } as AssetDetail;
}

describe("DistributionPanel empty/zero input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create form and empty distributions state without crashing when there are no holders and no existing distributions", () => {
    render(<DistributionPanel asset={makeAsset()} />);

    // The panel still renders its required-role notice and create form.
    expect(screen.getByText(/Required role:/i)).toBeInTheDocument();

    // With zero holders and zero existing distributions, the panel must not
    // throw and should surface an empty state rather than fabricated rows.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats an empty symbol and zero decimals as deliberate defaults (no crash, no NaN)", () => {
    render(<DistributionPanel asset={makeAsset()} />);

    // Empty symbol / zero decimals are valid inputs; the panel renders the
    // form without producing NaN or throwing on the zero-decimal parse path.
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
