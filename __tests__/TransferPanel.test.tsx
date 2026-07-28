/**
 * Render and interaction tests for TransferPanel
 *
 * Covers every gating state the component can be in:
 *  1. No wallet connected → prompt to connect
 *  2. Compliance loading → "Checking…" spinner
 *  3. Not approved (None / Pending / Suspended / other) → amber warning
 *  4. Asset paused → paused warning
 *  5. Approved + balance > 0 → form is enabled
 *  6. Max button fills the amount field
 *  7. Form validation: invalid address, self-transfer, zero amount, over-balance
 *  8. Successful transfer → calls tx.run, resets fields, calls onTransferred
 *  9. Transaction in progress → TxProgress shown, inputs disabled
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransferPanel } from "@/components/asset/TransferPanel";
import type { AssetDetail } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produces a valid Stellar G-address of exactly 56 characters. */
function gAddress(fill: string): string {
  const base = `G${fill.repeat(55)}`;
  return base.slice(0, 56);
}

/** Produces a valid Stellar C-address of exactly 56 characters. */
function cAddress(fill: string): string {
  const base = `C${fill.repeat(55)}`;
  return base.slice(0, 56);
}

const CONNECTED_ADDRESS = gAddress("A"); // 56-char G... address
const VALID_RECIPIENT = gAddress("B");   // different 56-char G... address

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: (v: string) => v.startsWith("G") && v.length === 56,
    isValidContract: (v: string) => v.startsWith("C") && v.length === 56,
  },
}));

jest.mock("@/lib/contracts", () => ({
  assetToken: {
    transfer: jest.fn(),
  },
}));

// Defaults for hooks; individual tests override via module-level mutable vars
let mockAddress: string | null = CONNECTED_ADDRESS;
let mockCompliance = {
  data: { allowed: true, status: "Approved", record: null },
  loading: false,
  error: null,
  refetch: jest.fn(),
};
let mockTx = {
  phase: "idle" as string,
  hash: null as string | null,
  error: null as string | null,
  pending: false,
  run: jest.fn().mockResolvedValue({ hash: "TXHASH123" }),
  reset: jest.fn(),
};

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: mockAddress,
    network: "testnet",
    writeCtx: jest.fn(),
  }),
}));

jest.mock("@/hooks/useCompliance", () => ({
  useCompliance: () => mockCompliance,
}));

jest.mock("@/hooks/useTx", () => ({
  useTx: () => mockTx,
}));

// TxProgress is only rendered when tx.phase !== "idle"; mock it lightly
jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: ({
    phase,
    error,
    onDismiss,
    successMessage,
  }: {
    phase: string;
    error: string | null;
    onDismiss: () => void;
    successMessage?: string;
  }) => (
    <div data-testid="tx-progress" data-phase={phase}>
      {error && <span data-testid="tx-error">{error}</span>}
      {phase === "success" && <span>{successMessage}</span>}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

// ComplianceBadge is tested independently; just render the status label
jest.mock("@/components/compliance/ComplianceBadge", () => ({
  ComplianceBadge: ({ status }: { status: string }) => (
    <span data-testid="compliance-badge">{status}</span>
  ),
}));

// lib/format — lightweight stubs
jest.mock("@/lib/format", () => ({
  formatTokenAmount: (amount: bigint, decimals: number) =>
    (Number(amount) / 10 ** decimals).toFixed(2),
  parseTokenAmount: (value: string, decimals: number) => {
    const num = parseFloat(value);
    if (isNaN(num)) throw new Error("Invalid amount.");
    return BigInt(Math.round(num * 10 ** decimals));
  },
}));

// explorerTxUrl is used inside TxProgress (which is mocked) — no-op needed
jest.mock("@/lib/stellar", () => ({
  explorerTxUrl: () => "https://example.com/tx/hash",
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<AssetDetail["metadata"]> = {}): AssetDetail {
  return {
    id: 1n,
    tokenContract: cAddress("T"),
    issuer: CONNECTED_ADDRESS,
    name: "Test Asset",
    assetType: "real_estate",
    valuation: 100_000_00n,
    createdAt: 100,
    active: true,
    metadata: {
      name: "Test Asset",
      symbol: "TST",
      assetType: "real_estate",
      totalSupply: 1_000_000_0000000n,
      decimals: 7,
      admin: CONNECTED_ADDRESS,
      complianceContract: cAddress("C"),
      assetDescription: "A test tokenized asset.",
      valuation: 100_000_00n,
      paused: false,
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// renderPanel helper
// ---------------------------------------------------------------------------

function renderPanel(
  props: Partial<React.ComponentProps<typeof TransferPanel>> = {},
) {
  const asset = makeAsset();
  return render(
    <TransferPanel
      asset={asset}
      balance={1_000_0000000n} // 1000.00 TST (7 decimals)
      onTransferred={jest.fn()}
      {...props}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TransferPanel", () => {
  beforeEach(() => {
    mockAddress = CONNECTED_ADDRESS;
    mockCompliance = {
      data: { allowed: true, status: "Approved", record: null },
      loading: false,
      error: null,
      refetch: jest.fn(),
    };
    mockTx = {
      phase: "idle",
      hash: null,
      error: null,
      pending: false,
      run: jest.fn().mockResolvedValue({ hash: "TXHASH123" }),
      reset: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ── 1. No wallet ──────────────────────────────────────────────────────────

  it("shows a connect-wallet prompt when no address is connected", () => {
    mockAddress = null;
    renderPanel();
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    // The transfer form must not be rendered
    expect(screen.queryByLabelText(/recipient address/i)).not.toBeInTheDocument();
  });

  // ── 2. Compliance loading ─────────────────────────────────────────────────

  it("shows 'Checking…' while compliance is loading", () => {
    mockCompliance = {
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    };
    renderPanel();
    expect(screen.getByText(/checking/i)).toBeInTheDocument();
    // ComplianceBadge must not be shown yet
    expect(screen.queryByTestId("compliance-badge")).not.toBeInTheDocument();
  });

  // ── 3. Not approved ───────────────────────────────────────────────────────

  it("shows a KYC warning when the address is not on the allowlist (None)", () => {
    mockCompliance = {
      data: { allowed: false, status: "None", record: null },
      loading: false,
      error: null,
      refetch: jest.fn(),
    };
    renderPanel();
    expect(
      screen.getByText(/isn't on this asset's kyc allowlist/i),
    ).toBeInTheDocument();
  });

  it("shows a Suspended warning message (not just the badge)", () => {
    mockCompliance = {
      data: { allowed: false, status: "Suspended", record: null },
      loading: false,
      error: null,
      refetch: jest.fn(),
    };
    renderPanel();
    // The amber warning paragraph contains "suspended"; scope to it specifically
    expect(
      screen.getByText(/approval is suspended for this asset/i),
    ).toBeInTheDocument();
  });

  it("shows a Pending warning message (not just the badge)", () => {
    mockCompliance = {
      data: { allowed: false, status: "Pending", record: null },
      loading: false,
      error: null,
      refetch: jest.fn(),
    };
    renderPanel();
    expect(
      screen.getByText(/kyc approval is pending/i),
    ).toBeInTheDocument();
  });

  it("disables the transfer button when not approved", () => {
    mockCompliance = {
      data: { allowed: false, status: "None", record: null },
      loading: false,
      error: null,
      refetch: jest.fn(),
    };
    renderPanel();
    expect(screen.getByRole("button", { name: /transfer/i })).toBeDisabled();
  });

  // ── 4. Asset paused ───────────────────────────────────────────────────────

  it("shows a paused warning when the asset is paused", () => {
    renderPanel({ asset: makeAsset({ paused: true }) });
    expect(screen.getByText(/paused by the issuer/i)).toBeInTheDocument();
  });

  it("disables the transfer button when the asset is paused", () => {
    renderPanel({ asset: makeAsset({ paused: true }) });
    expect(screen.getByRole("button", { name: /transfer/i })).toBeDisabled();
  });

  // ── 5. Approved + balance > 0 → enabled ───────────────────────────────────

  it("renders an enabled form when approved and balance > 0", () => {
    renderPanel();
    expect(screen.getByLabelText(/recipient address/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/amount/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^Transfer$/i })).not.toBeDisabled();
  });

  it("shows the compliance badge when compliance data is loaded", () => {
    renderPanel();
    expect(screen.getByTestId("compliance-badge")).toHaveTextContent("Approved");
  });

  // ── 6. Max button ──────────────────────────────────────────────────────────

  it("fills the amount field with the formatted balance when Max is clicked", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /max/i }));
    const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
    // 1_000_0000000n at 7 decimals = 1000.00
    expect(amountInput.value).toContain("1000");
  });

  // ── 7. Form validation ────────────────────────────────────────────────────

  it("shows a validation error for an invalid recipient address", async () => {
    renderPanel();
    await userEvent.type(screen.getByLabelText(/recipient address/i), "INVALID");
    await userEvent.type(screen.getByLabelText(/amount/i), "10");
    fireEvent.submit(
      screen.getByLabelText(/recipient address/i).closest("form")!,
    );

    await waitFor(() =>
      expect(screen.getByText(/valid stellar address/i)).toBeInTheDocument(),
    );
  });

  it("shows a validation error when the recipient is the sender's own address", async () => {
    renderPanel();
    await userEvent.type(
      screen.getByLabelText(/recipient address/i),
      CONNECTED_ADDRESS,
    );
    await userEvent.type(screen.getByLabelText(/amount/i), "10");
    fireEvent.submit(
      screen.getByLabelText(/recipient address/i).closest("form")!,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/can't transfer to your own address/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows a validation error for a zero amount", async () => {
    renderPanel();
    await userEvent.type(
      screen.getByLabelText(/recipient address/i),
      VALID_RECIPIENT,
    );
    await userEvent.type(screen.getByLabelText(/amount/i), "0");
    fireEvent.submit(
      screen.getByLabelText(/recipient address/i).closest("form")!,
    );

    await waitFor(() =>
      expect(screen.getByText(/must be greater than zero/i)).toBeInTheDocument(),
    );
  });

  it("shows a validation error when the amount exceeds the balance", async () => {
    // balance is 1000.00 TST (7 decimals); enter something larger
    renderPanel();
    await userEvent.type(
      screen.getByLabelText(/recipient address/i),
      VALID_RECIPIENT,
    );
    await userEvent.type(screen.getByLabelText(/amount/i), "99999");
    fireEvent.submit(
      screen.getByLabelText(/recipient address/i).closest("form")!,
    );

    await waitFor(() =>
      expect(screen.getByText(/exceeds your balance/i)).toBeInTheDocument(),
    );
  });

  // ── 8. Successful transfer ────────────────────────────────────────────────

  it("calls tx.run on a valid submission and invokes onTransferred", async () => {
    const onTransferred = jest.fn();
    mockTx.run = jest.fn().mockResolvedValue({ hash: "TXHASH123" });
    renderPanel({ onTransferred });

    await userEvent.type(
      screen.getByLabelText(/recipient address/i),
      VALID_RECIPIENT,
    );
    await userEvent.type(screen.getByLabelText(/amount/i), "50");
    fireEvent.submit(
      screen.getByLabelText(/recipient address/i).closest("form")!,
    );

    await waitFor(() => {
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(onTransferred).toHaveBeenCalledTimes(1);
    });
  });

  it("clears the form fields after a successful transfer", async () => {
    mockTx.run = jest.fn().mockResolvedValue({ hash: "TXHASH123" });
    renderPanel();

    const toInput = screen.getByLabelText(/recipient address/i) as HTMLInputElement;
    const amtInput = screen.getByLabelText(/amount/i) as HTMLInputElement;

    await userEvent.type(toInput, VALID_RECIPIENT);
    await userEvent.type(amtInput, "50");
    fireEvent.submit(toInput.closest("form")!);

    await waitFor(() => {
      expect(toInput.value).toBe("");
      expect(amtInput.value).toBe("");
    });
  });

  // ── 9. Transaction in progress ────────────────────────────────────────────

  it("shows TxProgress and disables inputs while a transaction is pending", () => {
    mockTx = { ...mockTx, phase: "signing", pending: true };
    renderPanel();

    const progress = screen.getByTestId("tx-progress");
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveAttribute("data-phase", "signing");
    expect(screen.getByLabelText(/recipient address/i)).toBeDisabled();
    expect(screen.getByLabelText(/amount/i)).toBeDisabled();
  });

  it("shows TxProgress in error state with the error message", () => {
    mockTx = { ...mockTx, phase: "error", error: "User rejected signature" };
    renderPanel();

    expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
    expect(screen.getByTestId("tx-error")).toHaveTextContent(
      "User rejected signature",
    );
  });
});
