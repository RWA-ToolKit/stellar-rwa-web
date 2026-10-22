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

describe("DistributionPanel dependency arrays / stale closures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-runs the async balance/allowance/decimals lookups when the asset prop changes", async () => {
    const contracts = await import("@/lib/contracts");
    const balanceSpy = contracts.assetToken.balance as unknown as ReturnType<typeof vi.fn>;
    const allowanceSpy = contracts.assetToken.allowance as unknown as ReturnType<typeof vi.fn>;
    const decimalsSpy = contracts.assetToken.decimals as unknown as ReturnType<typeof vi.fn>;

    const { rerender } = render(<DistributionPanel asset={makeAsset()} />);

    // Let the initial effect settle.
    await screen.findByText(/Required role:/i);
    const initialBalanceCalls = balanceSpy.mock.calls.length;
    const initialAllowanceCalls = allowanceSpy.mock.calls.length;
    const initialDecimalsCalls = decimalsSpy.mock.calls.length;

    // Swap in a different asset (new token contract). If the effect's
    // dependency array is missing `asset`, the lookups would not re-run and
    // the panel would keep showing stale balances for the previous asset.
    rerender(
      <DistributionPanel
        asset={makeAsset({
          tokenContract: "CTOKENCONTRACT11111111111111111111111111111111111111111111",
        })}
      />,
    );

    await screen.findByText(/Required role:/i);

    expect(balanceSpy.mock.calls.length).toBeGreaterThan(initialBalanceCalls);
    expect(allowanceSpy.mock.calls.length).toBeGreaterThan(initialAllowanceCalls);
    expect(decimalsSpy.mock.calls.length).toBeGreaterThan(initialDecimalsCalls);
  });

  it("does not re-run the lookups when re-rendered with an equivalent asset", async () => {
    const contracts = await import("@/lib/contracts");
    const balanceSpy = contracts.assetToken.balance as unknown as ReturnType<typeof vi.fn>;

    const { rerender } = render(<DistributionPanel asset={makeAsset()} />);

    await screen.findByText(/Required role:/i);
    const initialBalanceCalls = balanceSpy.mock.calls.length;

    // Same token contract: the effect should not thrash on unrelated renders.
    rerender(<DistributionPanel asset={makeAsset()} />);

    await screen.findByText(/Required role:/i);

    expect(balanceSpy.mock.calls.length).toBe(initialBalanceCalls);
  });
});
