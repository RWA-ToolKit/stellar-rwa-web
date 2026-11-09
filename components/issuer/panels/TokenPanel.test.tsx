/**
 * Tests for components/issuer/panels/TokenPanel.tsx
 *
 * Focus: the PauseCard must show a ConfirmDialog before executing both pause
 * and unpause transactions.
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
    transferBatch: jest.fn(),
    pause: jest.fn(),
    unpause: jest.fn(),
  },
  compliance: {
    isAllowed: jest.fn(() => Promise.resolve(true)),
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
    errorType: "generic",
    estimatedFee: null,
    pending: false,
    retryable: false,
    run: mockRun,
    retry: jest.fn(),
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

  describe("TokenPanel — large mint confirmation", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupTx();
    });

    it("uses exact bigint arithmetic at the large-mint threshold", () => {
      const asset: AssetDetail = {
        ...ASSET_UNPAUSED,
        metadata: {
          ...ASSET_UNPAUSED.metadata,
          decimals: 0,
          totalSupply: 18_014_398_509_481_985n,
        },
      };
      render(<TokenPanel asset={asset} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: "GDEST" },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "9007199254740993" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Confirm large mint\?/i)).toBeInTheDocument();
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

    it("opens a confirmation dialog before unpausing", () => {
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /unpause transfers/i }));
      // Dialog should now be visible
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/unpause transfers\?/i)).toBeInTheDocument();
    });

    it("does NOT call tx.run before the user confirms", () => {
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /unpause transfers/i }));
      expect(mockRun).not.toHaveBeenCalled();
    });

    it("calls tx.run after the user confirms in the dialog", () => {
      mockRun.mockResolvedValue(true);
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /unpause transfers/i }));
      fireEvent.click(screen.getByRole("button", { name: /yes, unpause transfers/i }));
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it("dismisses the dialog when cancel is clicked", () => {
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /unpause transfers/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does NOT call tx.run when cancel is clicked", () => {
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /unpause transfers/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe("TokenPanel — BatchTransferCard (#580)", () => {
    const { assetToken, compliance } = jest.requireMock("@/lib/contracts") as {
      assetToken: { transferBatch: jest.Mock };
      compliance: { isAllowed: jest.Mock };
    };

    beforeEach(() => {
      jest.clearAllMocks();
      setupTx();
      compliance.isAllowed.mockResolvedValue(true);
      mockRun.mockImplementation(async (fn: (ctx: unknown) => unknown) => {
        await fn({ network: "testnet", source: "GISSUER", sign: jest.fn() });
        return true;
      });
    });

    it("submits multiple multi-row recipients in a single transferBatch transaction after checking compliance per recipient", async () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);

      fireEvent.change(screen.getByLabelText("Destination wallet 1"), {
        target: { value: "GALICE" },
      });
      fireEvent.change(screen.getByLabelText("Token quantity 1"), {
        target: { value: "12.50" },
      });
      fireEvent.change(screen.getByLabelText("Destination wallet 2"), {
        target: { value: "GBOB" },
      });
      fireEvent.change(screen.getByLabelText("Token quantity 2"), {
        target: { value: "7.25" },
      });

      fireEvent.click(screen.getByRole("button", { name: /submit batch transfer/i }));

      await screen.findByRole("button", { name: /submit batch transfer/i });
      expect(compliance.isAllowed).toHaveBeenCalledTimes(2);
      expect(compliance.isAllowed).toHaveBeenNthCalledWith(
        1,
        "testnet",
        "CCOMPLIANCE",
        "GALICE",
      );
      expect(compliance.isAllowed).toHaveBeenNthCalledWith(
        2,
        "testnet",
        "CCOMPLIANCE",
        "GBOB",
      );
      expect(assetToken.transferBatch).toHaveBeenCalledTimes(1);
      expect(assetToken.transferBatch).toHaveBeenCalledWith(
        expect.anything(),
        "CTOKEN",
        [
          ["GALICE", 1250n],
          ["GBOB", 725n],
        ],
      );
    });

    it("parses CSV lines and submits all recipients in one transaction", async () => {
      render(<TokenPanel asset={ASSET_UNPAUSED} />);

      fireEvent.change(
        screen.getByLabelText(/or paste csv lines \(address,quantity\)/i),
        {
          target: { value: "GCAROL,10\nGDAVE,20.5" },
        },
      );

      fireEvent.click(screen.getByRole("button", { name: /submit batch transfer/i }));

      await screen.findByRole("button", { name: /submit batch transfer/i });
      expect(compliance.isAllowed).toHaveBeenCalledTimes(2);
      expect(assetToken.transferBatch).toHaveBeenCalledWith(
        expect.anything(),
        "CTOKEN",
        [
          ["GCAROL", 1000n],
          ["GDAVE", 2050n],
        ],
      );
    });

    it("blocks batch transfer submission when any recipient fails compliance validation", async () => {
      compliance.isAllowed
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      render(<TokenPanel asset={ASSET_UNPAUSED} />);

      fireEvent.change(screen.getByLabelText("Destination wallet 1"), {
        target: { value: "GALICE" },
      });
      fireEvent.change(screen.getByLabelText("Token quantity 1"), {
        target: { value: "5" },
      });
      fireEvent.change(screen.getByLabelText("Destination wallet 2"), {
        target: { value: "GUNAPPROVED" },
      });
      fireEvent.change(screen.getByLabelText("Token quantity 2"), {
        target: { value: "5" },
      });

      fireEvent.click(screen.getByRole("button", { name: /submit batch transfer/i }));

      expect(
        await screen.findByText(
          /Row 2 \(GUNAPPROVED\): Recipient isn't KYC-approved/i,
        ),
      ).toBeInTheDocument();
      expect(mockRun).not.toHaveBeenCalled();
    });

    it("blocks batch transfer when the token is paused", () => {
      render(<TokenPanel asset={ASSET_PAUSED} />);
      fireEvent.click(screen.getByRole("button", { name: /submit batch transfer/i }));
      expect(
        screen.getByText(/transfers are paused by the issuer for this asset/i),
      ).toBeInTheDocument();
      expect(mockRun).not.toHaveBeenCalled();
    });
  });
});
