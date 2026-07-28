/**
 * Tests for DistributionCard (issue #71)
 *
 * Covers:
 *  - Basic render: distribution ID, payment token (truncated), progress bar
 *  - "Complete" vs "Active" status chip
 *  - Total pool amount formatted correctly
 *  - Claimed / distributed progress text
 *  - Date shown when currentLedger is provided; ledger number shown when null
 *  - ClaimButton rendered only when claimable > 0 or claimed = true
 *  - ClaimButton NOT rendered when claimable = 0 and claimed = false
 *  - onClaimed callback passed through to ClaimButton
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { DistributionCard } from "@/components/dividend/DistributionCard";
import type { DistributionWithClaim } from "@/hooks/useDividends";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub ClaimButton so DistributionCard tests are isolated from its wallet/tx
// logic. We just verify the right props are forwarded.
jest.mock("@/components/dividend/ClaimButton", () => ({
  PAYMENT_TOKEN_DECIMALS: 7,
  ClaimButton: ({
    distributionId,
    claimable,
    claimed,
    onClaimed,
  }: {
    distributionId: bigint;
    claimable: bigint;
    claimed: boolean;
    onClaimed?: () => void;
  }) => (
    <div
      data-testid="claim-button"
      data-distribution-id={String(distributionId)}
      data-claimable={String(claimable)}
      data-claimed={String(claimed)}
    >
      <button onClick={onClaimed}>stub-claim</button>
    </div>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Build a minimal DistributionWithClaim with sensible defaults. */
function makeDistribution(
  overrides: Partial<DistributionWithClaim> = {},
): DistributionWithClaim {
  return {
    id: 1n,
    assetToken: "GABC1234567890ASSETTOKEN",
    paymentToken: "GDEF1234567890PAYMENTTOKEN",
    totalAmount: 100_000_0000000n, // 10,000 tokens @ 7 decimals
    distributed: 50_000_0000000n,  //  5,000 tokens
    snapshotLedger: 1000,
    createdAt: 500,
    completed: false,
    claimable: 0n,
    claimed: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DistributionCard", () => {
  // ── Basic render ────────────────────────────────────────────────────────────

  it("renders the distribution ID in the heading", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ id: 42n })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByText("Distribution #42")).toBeInTheDocument();
  });

  it("renders the truncated payment token address", () => {
    render(
      <DistributionCard
        distribution={makeDistribution()}
        currentLedger={1000}
      />,
    );

    // truncateAddress("GDEF1234567890PAYMENTTOKEN") → "GDEF…OKEN"
    expect(screen.getByText(/GDEF.*OKEN/)).toBeInTheDocument();
  });

  // ── Status chip ─────────────────────────────────────────────────────────────

  it("shows Complete chip when distribution.completed = true", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ completed: true })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("shows Active chip when distribution.completed = false", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ completed: false })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  // ── Total pool ──────────────────────────────────────────────────────────────

  it("renders the total pool formatted with 7 decimals", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          totalAmount: 1_000_0000000n, // 1,000 tokens @ 7 decimals
        })}
        currentLedger={1000}
      />,
    );

    // formatTokenAmount(1_000_0000000n, 7) = "1,000"
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  // ── Progress bar section ─────────────────────────────────────────────────────

  it("renders distributed / total amounts in the progress section", () => {
    const { container } = render(
      <DistributionCard
        distribution={makeDistribution({
          totalAmount: 100_000_0000000n, // 100,000 tokens @ 7 decimals
          distributed:   2_500_0000000n, //   2,500 tokens → 2.5%
        })}
        currentLedger={1000}
      />,
    );

    // The progress span contains interleaved text nodes; check the full text.
    const text = container.textContent ?? "";
    expect(text).toMatch(/2,500/);
    expect(text).toMatch(/100,000/);
  });

  it("renders the correct percentage in the progress section", () => {
    // 50_000_0000000n / 100_000_0000000n = 50%
    render(
      <DistributionCard
        distribution={makeDistribution({
          totalAmount: 100_000_0000000n,
          distributed:  50_000_0000000n,
        })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
  });

  it("renders 0% correctly when nothing has been distributed yet", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          totalAmount: 100_000_0000000n,
          distributed: 0n,
        })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
  });

  // ── Date vs ledger display ───────────────────────────────────────────────────

  it("shows 'Created … ago' when currentLedger is provided", () => {
    // createdAt = 500, currentLedger = 500 → delta = 0 s → "less than a minute ago"
    render(
      <DistributionCard
        distribution={makeDistribution({ createdAt: 500 })}
        currentLedger={500}
      />,
    );

    // date-fns formatDistanceToNow should produce something like "less than a minute ago"
    expect(screen.getByText(/Created/i)).toBeInTheDocument();
  });

  it("shows 'Ledger …' when currentLedger is null", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ createdAt: 12345 })}
        currentLedger={null}
      />,
    );

    expect(screen.getByText(/Ledger 12345/)).toBeInTheDocument();
  });

  // ── ClaimButton visibility ───────────────────────────────────────────────────

  it("does NOT render ClaimButton when claimable=0 and claimed=false", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimable: 0n, claimed: false })}
        currentLedger={1000}
      />,
    );

    expect(screen.queryByTestId("claim-button")).not.toBeInTheDocument();
  });

  it("renders ClaimButton when claimable > 0", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimable: 1_000_000n, claimed: false })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByTestId("claim-button")).toBeInTheDocument();
  });

  it("renders ClaimButton when claimed = true (even if claimable = 0)", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimable: 0n, claimed: true })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByTestId("claim-button")).toBeInTheDocument();
  });

  // ── Prop forwarding to ClaimButton ───────────────────────────────────────────

  it("forwards distributionId to ClaimButton", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ id: 7n, claimable: 500n })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByTestId("claim-button")).toHaveAttribute(
      "data-distribution-id",
      "7",
    );
  });

  it("forwards claimable to ClaimButton", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimable: 999_999n })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByTestId("claim-button")).toHaveAttribute(
      "data-claimable",
      "999999",
    );
  });

  it("forwards claimed flag to ClaimButton", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimable: 0n, claimed: true })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByTestId("claim-button")).toHaveAttribute(
      "data-claimed",
      "true",
    );
  });

  it("passes onClaimed callback to ClaimButton and it can be invoked", () => {
    const onClaimed = jest.fn();
    render(
      <DistributionCard
        distribution={makeDistribution({ claimable: 1_000_000n })}
        currentLedger={1000}
        onClaimed={onClaimed}
      />,
    );

    screen.getByRole("button", { name: "stub-claim" }).click();
    expect(onClaimed).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it("renders without crashing when totalAmount is 0 (0% progress)", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ totalAmount: 0n, distributed: 0n })}
        currentLedger={1000}
      />,
    );

    expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
  });

  it("clamps progress bar to 100% even if distributed exceeds total", () => {
    const { container } = render(
      <DistributionCard
        distribution={makeDistribution({
          totalAmount: 100n,
          distributed: 200n,
        })}
        currentLedger={1000}
      />,
    );

    // The inline style width should be capped at 100%
    const bar = container.querySelector<HTMLElement>(".rounded-full.bg-gradient-to-r");
    expect(bar?.style.width).toBe("100%");
  });
});
