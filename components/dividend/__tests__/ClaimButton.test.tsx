/**
 * Tests for ClaimButton (issue #72)
 *
 * Covers:
 *  - No wallet connected  → "Connect a wallet to claim." message
 *  - Already claimed      → "Claimed" chip rendered
 *  - Nothing to claim     → disabled "Nothing to claim" button
 *  - Claimable amount     → enabled "Claim …" button with formatted amount
 *  - Click triggers tx.run and onClaimed callback on success
 *  - TxProgress shown during in-flight phases (building / signing / etc.)
 *  - Error phase shown in TxProgress
 *  - Success phase shown in TxProgress
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ClaimButton } from "@/components/dividend/ClaimButton";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock useWallet so we can control `address` per-test.
const mockUseWallet = jest.fn();
jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockUseWallet(),
}));

// Mock useTx so we control phase / run / reset / hash / error.
const mockUseTx = jest.fn();
jest.mock("@/hooks/useTx", () => ({
  useTx: () => mockUseTx(),
}));

// Mock the dividend contract — we only care that `claim` is called with the
// right distributionId; the return value is irrelevant here because tx.run is
// fully mocked.
jest.mock("@/lib/contracts", () => ({
  dividend: {
    claim: jest.fn(),
  },
}));

// TxProgress reads `useWallet` too; stub it out with a simple div to keep
// tests focused on ClaimButton's own logic.
jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: ({ phase, error, successMessage, onDismiss }: {
    phase: string;
    error: string | null;
    successMessage?: string;
    onDismiss?: () => void;
  }) => (
    <div data-testid="tx-progress" data-phase={phase}>
      {error && <span data-testid="tx-error">{error}</span>}
      {phase === "success" && <span data-testid="tx-success">{successMessage}</span>}
      {onDismiss && (
        <button data-testid="tx-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default idle tx state used across most tests. */
function idleTx(overrides: Partial<ReturnType<typeof mockUseTx>> = {}) {
  return {
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    run: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  };
}

const DEFAULT_DISTRIBUTION_ID = 1n;
const CLAIMABLE_AMOUNT = 10_000_000n; // 1.0 token (7 decimals)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ClaimButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── State: no wallet ──────────────────────────────────────────────────────

  it("renders connect-wallet message when no address", () => {
    mockUseWallet.mockReturnValue({ address: null });
    mockUseTx.mockReturnValue(idleTx());

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    expect(screen.getByText("Connect a wallet to claim.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // ── State: already claimed ────────────────────────────────────────────────

  it("renders Claimed chip when claimed=true", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(idleTx());

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={0n}
        claimed={true}
      />,
    );

    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // ── State: nothing to claim ───────────────────────────────────────────────

  it("renders disabled Nothing to claim button when claimable=0", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(idleTx());

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={0n}
        claimed={false}
      />,
    );

    const btn = screen.getByRole("button", { name: /nothing to claim/i });
    expect(btn).toBeDisabled();
  });

  it("renders disabled button for negative claimable value", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(idleTx());

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={-1n}
        claimed={false}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  // ── State: claimable amount ───────────────────────────────────────────────

  it("renders enabled Claim button with formatted amount when claimable > 0", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(idleTx());

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    // 10_000_000 stroops @ 7 decimals = "1" token
    const btn = screen.getByRole("button", { name: /claim 1/i });
    expect(btn).toBeEnabled();
  });

  it("formats larger claimable amounts correctly in the button label", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(idleTx());

    // 123_456_7890000n @ 7 decimals = 123,456.789
    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={123_456_7890000n}
        claimed={false}
      />,
    );

    const btn = screen.getByRole("button");
    expect(btn.textContent).toMatch(/123,456\.789/);
  });

  // ── Interaction: clicking Claim ───────────────────────────────────────────

  it("calls tx.run when Claim button is clicked", async () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    const run = jest.fn().mockResolvedValue(null);
    mockUseTx.mockReturnValue(idleTx({ run }));

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("calls onClaimed callback after a successful claim", async () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    const onClaimed = jest.fn();
    // run resolves with a truthy TxResult to trigger onClaimed
    const run = jest.fn().mockResolvedValue({ hash: "abc123" });
    mockUseTx.mockReturnValue(idleTx({ run }));

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
        onClaimed={onClaimed}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(onClaimed).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClaimed when tx.run returns null (failure)", async () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    const onClaimed = jest.fn();
    const run = jest.fn().mockResolvedValue(null);
    mockUseTx.mockReturnValue(idleTx({ run }));

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
        onClaimed={onClaimed}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(onClaimed).not.toHaveBeenCalled();
  });

  it("does not call onClaimed when no callback is provided", async () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    const run = jest.fn().mockResolvedValue({ hash: "abc123" });
    mockUseTx.mockReturnValue(idleTx({ run }));

    // Should not throw even without the optional onClaimed prop
    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
  });

  // ── State: TxProgress shown during in-flight phases ───────────────────────

  it("shows TxProgress (not the claim button) during building phase", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(
      idleTx({ phase: "building", pending: true }),
    );

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
  });

  it("shows TxProgress during signing phase", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(idleTx({ phase: "signing", pending: true }));

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
  });

  it("shows TxProgress with error on error phase", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(
      idleTx({ phase: "error", error: "User rejected the request." }),
    );

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    const progress = screen.getByTestId("tx-progress");
    expect(progress).toBeInTheDocument();
    expect(screen.getByTestId("tx-error")).toHaveTextContent(
      "User rejected the request.",
    );
  });

  it("shows TxProgress with success message on success phase", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    mockUseTx.mockReturnValue(
      idleTx({ phase: "success", hash: "deadbeef" }),
    );

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    expect(screen.getByTestId("tx-success")).toHaveTextContent(
      "Dividend claimed to your wallet.",
    );
  });

  it("calls tx.reset when TxProgress dismiss button is clicked", () => {
    mockUseWallet.mockReturnValue({ address: "GABC123" });
    const reset = jest.fn();
    mockUseTx.mockReturnValue(idleTx({ phase: "error", error: "Oops", reset }));

    render(
      <ClaimButton
        distributionId={DEFAULT_DISTRIBUTION_ID}
        claimable={CLAIMABLE_AMOUNT}
        claimed={false}
      />,
    );

    fireEvent.click(screen.getByTestId("tx-dismiss"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
