/**
 * Tests for components/issuer/panels/TokenPanel.tsx
 *
 * Focus: the PauseCard must show a ConfirmDialog before executing the pause
 * transaction, and must execute without confirmation when unpausing.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";

// ── mocks ──────────────────────────────────────────────────────────────────

jest.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: jest.fn(() => true),
    isValidContract: jest.fn(() => false),
  },
}));

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(() => ({ address: "GTEST", network: "testnet" })),
}));

jest.mock("@/lib/contracts", () => ({
  assetToken: {
    mint: jest.fn(),
    pause: jest.fn(),
    unpause: jest.fn(),
  },
}));

jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: () => <div data-testid="tx-progress" />,
}));

// ── imports after mocks ────────────────────────────────────────────────────

import { useTx } from "@/hooks/useTx";
import { TokenPanel } from "./TokenPanel";

const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;

const mockRun = jest.fn();
const mockReset = jest.fn();

function setupTx() {
  mockUseTx.mockReturnValue({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    run: mockRun,
    reset: mockReset,
  });
}

const ASSET_UNPAUSED: AssetDetail = {
  id: 1n,
  tokenContract: "CTOKEN",
  issuer: "GISSUER",
  name: "Test Asset",
  assetType: "real_estate",
  valuation: 100_00n,
  createdAt: 1000,
  active: true,
  metadata: {
    name: "Test Asset",
    symbol: "TST",
    assetType: "real_estate",
    totalSupply: 1000n,
    decimals: 2,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "A test asset",
    valuation: 100_00n,
    paused: false,
  },
};

const ASSET_PAUSED: AssetDetail = {
  ...ASSET_UNPAUSED,
  metadata: { ...ASSET_UNPAUSED.metadata, paused: true },
};

// ── tests ──────────────────────────────────────────────────────────────────

describe("TokenPanel — PauseCard confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTx();
  });

  describe("when token is NOT paused", () => {
    it("shows the 'Pause transfers' button", () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);
      expect(
        screen.getByRole("button", { name: /pause transfers/i }),
      ).toBeInTheDocument();
    });

    it("opens a confirmation dialog before pausing", () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /pause transfers/i }));
      // Dialog should now be visible
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/pause all transfers\?/i)).toBeInTheDocument();
    });

    it("does NOT call tx.run before the user confirms", () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /pause transfers/i }));
      expect(mockRun).not.toHaveBeenCalled();
    });

    it("calls tx.run after the user confirms in the dialog", () => {
      mockRun.mockResolvedValue(true);
      render(<TokenPanel asset={ASSET_UNPAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /pause transfers/i }));
      fireEvent.click(screen.getByRole("button", { name: /yes, pause transfers/i }));
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it("dismisses the dialog when cancel is clicked", () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /pause transfers/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does NOT call tx.run when cancel is clicked", () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /pause transfers/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe("when token IS already paused", () => {
    it("shows the 'Unpause transfers' button", () => {
      render(<TokenPanel asset={ASSET_PAUSED} />);
      expect(
        screen.getByRole("button", { name: /unpause transfers/i }),
      ).toBeInTheDocument();
    });

    it("executes the unpause tx immediately WITHOUT a confirmation dialog", () => {
      mockRun.mockResolvedValue(true);
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /unpause transfers/i }));
      // No dialog should appear
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // tx.run should have been called right away
      expect(mockRun).toHaveBeenCalledTimes(1);
    });
  });
});
