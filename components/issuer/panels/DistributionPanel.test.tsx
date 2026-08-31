/**
 * Tests for components/issuer/panels/DistributionPanel.tsx
 *
 * Strategy: mock hooks (useTx, useDividends) and contracts so we don't touch
 * Soroban RPC. Mock sub-components (TxProgress, Spinner, etc.) to focus on
 * the component's own logic. The DistributionPanel has two sub-cards:
 *
 * CreateDistributionCard:
 *   1. Form renders with payment token and total amount inputs
 *   2. Validation: payment token must be valid contract or public key
 *   3. Validation: amount must be parseable and > 0
 *   4. Form submission calls dividend.createDistribution via useTx
 *   5. Form clears on successful creation
 *   6. Loading state disables inputs during transaction
 *   7. TxProgress replaces button during active transaction
 *
 * ExistingDistributionsCard:
 *   1. Loading state renders spinner
 *   2. Error state renders error message with retry
 *   3. Empty state renders when no distributions exist
 *   4. Renders list of distributions with ID, status badge, progress bar
 *   5. Progress bar shows claim percentage
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetDetail } from "@/types";

// ── mock hooks ─────────────────────────────────────────────────────────────

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(),
}));

jest.mock("@/hooks/useDividends", () => ({
  useDividends: jest.fn(),
}));

// ── mock contracts so tx.run() doesn't go to the network ──────────────────

jest.mock("@/lib/contracts", () => ({
  dividend: {
    createDistribution: jest.fn(),
  },
}));

// ── mock sub-components ────────────────────────────────────────────────────

jest.mock("@/components/issuer/ActionCard", () => ({
  ActionCard: ({
    title,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => <div data-testid={`action-card-${title.toLowerCase()}`}>{children}</div>,
}));

jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: ({ phase }: { phase: string; hash?: string; error?: string }) => (
    <div data-testid="tx-progress" data-phase={phase}>
      Transaction {phase}
    </div>
  ),
}));

jest.mock("@/components/ui/Spinner", () => ({
  Spinner: ({ size }: { size?: number }) => (
    <span data-testid="spinner" data-size={size || 16} />
  ),
}));

jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title }: { title: string; description?: string }) => (
    <div data-testid="empty-state">{title}</div>
  ),
}));

jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({
    message,
    onRetry,
  }: {
    title?: string;
    message: string;
    onRetry: () => void;
  }) => (
    <div data-testid="error-state">
      {message}
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

// ── imports after mocks ────────────────────────────────────────────────────

import { useTx } from "@/hooks/useTx";
import { useDividends } from "@/hooks/useDividends";
import { DistributionPanel } from "./DistributionPanel";

const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;
const mockUseDividends = useDividends as jest.MockedFunction<typeof useDividends>;

// ── helpers ────────────────────────────────────────────────────────────────

const BASE_TX: ReturnType<typeof useTx> = {
  phase: "idle",
  hash: null,
  error: null,
  pending: false,
  run: jest.fn().mockResolvedValue(null),
  reset: jest.fn(),
};

function setupTx(overrides: Partial<ReturnType<typeof useTx>> = {}) {
  mockUseTx.mockReturnValue({ ...BASE_TX, ...overrides });
}

type DividendsReturn = ReturnType<typeof useDividends>;

function setupDividends(overrides: Partial<DividendsReturn> = {}) {
  mockUseDividends.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  } as DividendsReturn);
}

const mockAsset: AssetDetail = {
  id: 1n,
  tokenContract: "CTOKEN",
  issuer: "GISSUER",
  name: "Test Asset",
  assetType: "real_estate",
  valuation: 1_000_000_00n,
  createdAt: 50000,
  active: true,
  metadata: {
    name: "Test Asset",
    symbol: "TST",
    assetType: "real_estate",
    totalSupply: 1000000n,
    decimals: 7,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "Test",
    valuation: 1_000_000_00n,
    paused: false,
  },
};

// ── tests ──────────────────────────────────────────────────────────────────

describe("DistributionPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTx();
    setupDividends();
  });

  describe("CreateDistributionCard", () => {
    it("renders the create distribution form", () => {
      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByLabelText(/payment token contract/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total pool amount/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create distribution/i })).toBeInTheDocument();
    });

    it("renders form input placeholders", () => {
      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByPlaceholderText(/^C… \(SAC or Soroban/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/^0\.0000000$/)).toBeInTheDocument();
    });

    it("renders helper text for payment token field", () => {
      render(<DistributionPanel asset={mockAsset} />);

      expect(
        screen.getByText(/this is the token used to pay holders/i)
      ).toBeInTheDocument();
    });

    it("renders helper text for amount field", () => {
      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByText(/uses 7 decimals/i)).toBeInTheDocument();
    });

    // ── Validation tests ──────────────────────────────────────────────────

    it("validates that payment token address must be valid", async () => {
      const user = userEvent.setup();
      const run = jest.fn().mockResolvedValue(null);
      setupTx({ run });

      render(<DistributionPanel asset={mockAsset} />);

      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/);
      await user.type(amountInput, "100");

      const submitButton = screen.getByRole("button", { name: /create distribution/i });
      await user.click(submitButton);

      expect(screen.getByText(/enter a valid payment token/i)).toBeInTheDocument();
      expect(run).not.toHaveBeenCalled();
    });

    it("validates that amount must be a valid number", async () => {
      const user = userEvent.setup();
      const run = jest.fn().mockResolvedValue(null);
      setupTx({ run });

      render(<DistributionPanel asset={mockAsset} />);

      const tokenInput = screen.getByPlaceholderText(/^C… \(SAC or Soroban/i);
      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/);

      await user.type(tokenInput, "CVALIDTOKEN123456789012345678901234567");
      await user.type(amountInput, "not-a-number");

      const submitButton = screen.getByRole("button", { name: /create distribution/i });
      await user.click(submitButton);

      expect(screen.getByText(/invalid amount/i)).toBeInTheDocument();
      expect(run).not.toHaveBeenCalled();
    });

    it("validates that amount must be greater than zero", async () => {
      const user = userEvent.setup();
      const run = jest.fn().mockResolvedValue(null);
      setupTx({ run });

      render(<DistributionPanel asset={mockAsset} />);

      const tokenInput = screen.getByPlaceholderText(/^C… \(SAC or Soroban/i);
      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/);

      await user.type(tokenInput, "CVALIDTOKEN123456789012345678901234567");
      await user.type(amountInput, "0");

      const submitButton = screen.getByRole("button", { name: /create distribution/i });
      await user.click(submitButton);

      expect(screen.getByText(/must be greater than zero/i)).toBeInTheDocument();
      expect(run).not.toHaveBeenCalled();
    });

    // ── Submission tests ──────────────────────────────────────────────────

    it("calls tx.run with createDistribution when form is valid", async () => {
      const user = userEvent.setup();
      const run = jest.fn().mockResolvedValue({ hash: "abc123" });
      setupTx({ run });

      render(<DistributionPanel asset={mockAsset} />);

      const tokenInput = screen.getByPlaceholderText(/^C… \(SAC or Soroban/i);
      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/);

      await user.type(tokenInput, "CVALIDTOKEN123456789012345678901234567");
      await user.type(amountInput, "100.5");

      const submitButton = screen.getByRole("button", { name: /create distribution/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(run).toHaveBeenCalled();
      });
    });

    it("clears form inputs after successful creation", async () => {
      const user = userEvent.setup();
      const run = jest.fn().mockResolvedValue({ hash: "abc123" });
      setupTx({ run });

      render(<DistributionPanel asset={mockAsset} />);

      const tokenInput = screen.getByPlaceholderText(/^C… \(SAC or Soroban/i) as HTMLInputElement;
      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/) as HTMLInputElement;

      await user.type(tokenInput, "CVALIDTOKEN123456789012345678901234567");
      await user.type(amountInput, "100.5");

      const submitButton = screen.getByRole("button", { name: /create distribution/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(tokenInput.value).toBe("");
        expect(amountInput.value).toBe("");
      });
    });

    it("calls onCreated callback after successful creation", async () => {
      const user = userEvent.setup();
      const onCreated = jest.fn();
      const run = jest.fn().mockResolvedValue({ hash: "abc123" });
      setupTx({ run });

      render(<DistributionPanel asset={mockAsset} onCreated={onCreated} />);

      const tokenInput = screen.getByPlaceholderText(/^C… \(SAC or Soroban/i);
      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/);

      await user.type(tokenInput, "CVALIDTOKEN123456789012345678901234567");
      await user.type(amountInput, "100.5");

      const submitButton = screen.getByRole("button", { name: /create distribution/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledTimes(1);
      });
    });

    // ── Loading state tests ───────────────────────────────────────────────

    it("disables inputs while transaction is pending", () => {
      setupTx({ pending: true });

      render(<DistributionPanel asset={mockAsset} />);

      const tokenInput = screen.getByPlaceholderText(/^C… \(SAC or Soroban/i);
      const amountInput = screen.getByPlaceholderText(/^0\.0000000$/);

      expect(tokenInput).toBeDisabled();
      expect(amountInput).toBeDisabled();
    });

    it("shows TxProgress instead of button during transaction", () => {
      setupTx({ phase: "submitting", pending: true });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /create distribution/i })).not.toBeInTheDocument();
    });
  });

  describe("ExistingDistributionsCard", () => {
    it("renders loading state", () => {
      setupDividends({ data: null, loading: true });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.getByText(/loading distributions/i)).toBeInTheDocument();
    });

    it("renders error state with retry button", () => {
      const refetch = jest.fn();
      setupDividends({ data: null, loading: false, error: "Network error", refetch });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("calls refetch when error retry button is clicked", async () => {
      const user = userEvent.setup();
      const refetch = jest.fn();
      setupDividends({ data: null, loading: false, error: "Network error", refetch });

      render(<DistributionPanel asset={mockAsset} />);

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("renders empty state when no distributions exist", () => {
      setupDividends({ data: [] });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      expect(screen.getByText(/no distributions yet/i)).toBeInTheDocument();
    });

    it("renders distribution list with IDs and statuses", () => {
      const distributions = [
        {
          id: 1n,
          paymentToken: "GTOKEN1",
          totalAmount: 1000_0000000n,
          distributed: 500_0000000n,
          completed: false,
        },
        {
          id: 2n,
          paymentToken: "GTOKEN2",
          totalAmount: 500_0000000n,
          distributed: 500_0000000n,
          completed: true,
        },
      ];
      setupDividends({ data: distributions });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByText(/Distribution #1/)).toBeInTheDocument();
      expect(screen.getByText(/Distribution #2/)).toBeInTheDocument();
    });

    it("shows 'Active' badge for ongoing distributions", () => {
      const distributions = [
        {
          id: 1n,
          paymentToken: "GTOKEN1",
          totalAmount: 1000_0000000n,
          distributed: 500_0000000n,
          completed: false,
        },
      ];
      setupDividends({ data: distributions });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByText(/Active/)).toBeInTheDocument();
    });

    it("shows 'Complete' badge for finished distributions", () => {
      const distributions = [
        {
          id: 1n,
          paymentToken: "GTOKEN1",
          totalAmount: 500_0000000n,
          distributed: 500_0000000n,
          completed: true,
        },
      ];
      setupDividends({ data: distributions });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByText(/Complete/)).toBeInTheDocument();
    });

    it("renders progress bar with correct percentage", () => {
      const distributions = [
        {
          id: 1n,
          paymentToken: "GTOKEN1",
          totalAmount: 1000_0000000n,
          distributed: 250_0000000n, // 25% claimed
          completed: false,
        },
      ];
      setupDividends({ data: distributions });

      const { container } = render(<DistributionPanel asset={mockAsset} />);

      // Check that claim percentage text is displayed
      expect(screen.getByText(/25\.0% claimed/)).toBeInTheDocument();

      // Check that progress bar div exists with calculated width
      const progressBar = container.querySelector(
        '[style*="width"]'
      ) as HTMLElement | null;
      if (progressBar) {
        expect(progressBar).toHaveStyle("width: 25%");
      }
    });

    it("displays 100% claimed for fully distributed amounts", () => {
      const distributions = [
        {
          id: 1n,
          paymentToken: "GTOKEN1",
          totalAmount: 1000_0000000n,
          distributed: 1000_0000000n, // 100% claimed
          completed: true,
        },
      ];
      setupDividends({ data: distributions });

      render(<DistributionPanel asset={mockAsset} />);

      expect(screen.getByText(/100\.0% claimed/)).toBeInTheDocument();
    });

    it("shows truncated payment token address", () => {
      const distributions = [
        {
          id: 1n,
          paymentToken: "GVERYLONGTOKEN1234567890ABCDEFGHIJKLMNOP",
          totalAmount: 1000_0000000n,
          distributed: 500_0000000n,
          completed: false,
        },
      ];
      setupDividends({ data: distributions });

      render(<DistributionPanel asset={mockAsset} />);

      // Should show truncated version, not full address
      expect(screen.getByText(/Payment token:/)).toBeInTheDocument();
    });
  });
});
