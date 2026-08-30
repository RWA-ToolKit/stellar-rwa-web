/**
 * Tests for components/issuer/panels/DistributionPanel.tsx
 *
 * Focus: ExistingDistributionsCard renders a progress bar whose width is
 * derived from percent(d.distributed, d.totalAmount). The width must always be
 * clamped to [0, 100] — even if percent() or upstream data produces a value
 * outside that range due to rounding or a stale snapshot.
 *
 * Strategy: mock useDividends so we control the Distribution objects directly,
 * mock useTx / CreateDistributionCard dependencies so we only test the
 * ExistingDistributionsCard branch, and spy on percent() to confirm the clamp
 * at the render site defends against an out-of-range return.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";

// ── mock useDividends ──────────────────────────────────────────────────────

jest.mock("@/hooks/useDividends", () => ({
  useDividends: jest.fn(),
}));

// ── mock useTx (CreateDistributionCard) ───────────────────────────────────

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(() => ({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    run: jest.fn(),
    reset: jest.fn(),
  })),
}));

// ── mock @stellar/stellar-sdk ─────────────────────────────────────────────

jest.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: () => false,
    isValidContract: () => false,
  },
}));

// ── mock ActionCard / TxProgress / Spinner / EmptyState / ErrorState ──────

jest.mock("@/components/issuer/ActionCard", () => ({
  ActionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: () => <div data-testid="tx-progress" />,
}));
jest.mock("@/components/ui/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));
jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));
jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));

// ── mock ClaimButton constant ─────────────────────────────────────────────

jest.mock("@/components/dividend/ClaimButton", () => ({
  PAYMENT_TOKEN_DECIMALS: 7,
}));

// ── mock percent so we can force out-of-range values ──────────────────────
// By default we proxy to the real implementation; individual tests override.

import * as formatModule from "@/lib/format";
const realPercent = formatModule.percent;
const percentSpy = jest.spyOn(formatModule, "percent");

// ── imports after mocks ────────────────────────────────────────────────────

import { useDividends } from "@/hooks/useDividends";
import { DistributionPanel } from "../DistributionPanel";

const mockUseDividends = useDividends as jest.MockedFunction<typeof useDividends>;

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(): AssetDetail {
  return {
    id: 1n,
    tokenContract: "CTOKEN123",
    issuer: "GISSUER123",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 50000,
    active: true,
    metadata: {
      name: "Test Asset",
      symbol: "TST",
      assetType: "real_estate",
      totalSupply: 1_000_000n,
      decimals: 7,
      admin: "GISSUER123",
      complianceContract: "CCOMPLIANCE",
      assetDescription: "",
      valuation: 1_000_000_00n,
      paused: false,
    },
  };
}

type DistributionItem = ReturnType<typeof useDividends>["data"] extends Array<infer T> | null
  ? T
  : never;

function makeDistribution(
  id: bigint,
  distributed: bigint,
  totalAmount: bigint,
  completed = false,
): DistributionItem {
  return {
    id,
    assetToken: "CTOKEN123",
    paymentToken: "CPAYTOKEN",
    totalAmount,
    distributed,
    createdAt: 100,
    completed,
    claimable: 0n,
    claimed: false,
  };
}

type DividendsReturn = ReturnType<typeof useDividends>;

function setupDividends(data: DividendsReturn["data"], extras: Partial<DividendsReturn> = {}) {
  mockUseDividends.mockReturnValue({
    data,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...extras,
  } as DividendsReturn);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("DistributionPanel – ExistingDistributionsCard progress bar clamping", () => {
  beforeEach(() => {
    percentSpy.mockImplementation(realPercent);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders a progress bar at 50% when half the total is distributed", () => {
    setupDividends([makeDistribution(1n, 5_000_000n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBe("50%");
  });

  it("renders the bar at 100% when fully distributed (normal complete case)", () => {
    setupDividends([makeDistribution(1n, 10_000_000n, 10_000_000n, true)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("clamps bar width to 100% when percent() returns above 100", () => {
    // Force percent() to return 102.5 to simulate a rounding path where
    // distributed slightly exceeds totalAmount.
    percentSpy.mockReturnValue(102.5);

    setupDividends([makeDistribution(1n, 10_200_000n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("clamps bar width to 0% when percent() returns a negative value", () => {
    // Defensive: percent() itself clamps but we guard at the render site too.
    percentSpy.mockReturnValue(-5);

    setupDividends([makeDistribution(1n, 0n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("renders a bar at 0% for a brand-new distribution with nothing distributed", () => {
    setupDividends([makeDistribution(1n, 0n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("renders multiple distributions with individually correct bar widths", () => {
    setupDividends([
      makeDistribution(1n, 2_500_000n, 10_000_000n),   // 25%
      makeDistribution(2n, 10_000_000n, 10_000_000n, true), // 100%
    ]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bars = Array.from(
      document.querySelectorAll<HTMLElement>(".bg-gradient-to-r"),
    );
    expect(bars).toHaveLength(2);
    expect(bars[0].style.width).toBe("25%");
    expect(bars[1].style.width).toBe("100%");
  });

  it("shows an empty state when there are no distributions", () => {
    setupDividends([]);
    render(<DistributionPanel asset={makeAsset()} />);

    expect(screen.getByText(/no distributions yet/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when the distributions fetch fails", () => {
    setupDividends(null, { error: "RPC unavailable", loading: false });
    render(<DistributionPanel asset={makeAsset()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
