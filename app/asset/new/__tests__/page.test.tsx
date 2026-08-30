/**
 * Route-level tests for app/asset/new/page.tsx
 *
 * Strategy: mock useWallet to control connection state, and verify:
 *   1. When disconnected, the wallet-gate prompt renders with ConnectButton
 *   2. When connected, the TokenizeWizard renders with step indicator
 *   3. The wizard's first step (Step1TokenContract) is visible when connected
 *
 * Assertions use role-based queries to verify real rendered UI.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ── mock useWallet hook ────────────────────────────────────────────────────
jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

// ── mock heavy sub-components ──────────────────────────────────────────────
jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

jest.mock("@/components/tokenize/StepIndicator", () => ({
  StepIndicator: ({ steps, current }: { steps: Array<{ id: number; label: string }>; current: number }) => (
    <div data-testid="step-indicator">
      <p>Step {current} of {steps.length}</p>
      {steps.map((step) => (
        <button
          key={step.id}
          data-testid={`step-${step.id}`}
          aria-current={step.id === current ? "step" : undefined}
        >
          {step.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/components/tokenize/Step1TokenContract", () => ({
  Step1TokenContract: ({ onValidated }: { onValidated: (result: unknown) => void }) => (
    <div data-testid="step-1">
      Step 1: Token Contract
      <button onClick={() => onValidated({ tokenContract: "CTOKEN123" })}>
        Next
      </button>
    </div>
  ),
}));

jest.mock("@/components/tokenize/Step2AssetDetails", () => ({
  Step2AssetDetails: () => <div data-testid="step-2">Step 2: Asset Details</div>,
}));

jest.mock("@/components/tokenize/Step3Confirm", () => ({
  Step3Confirm: () => <div data-testid="step-3">Step 3: Confirm</div>,
}));

jest.mock("@/components/tokenize/Step4Done", () => ({
  Step4Done: () => <div data-testid="step-4">Step 4: Done</div>,
}));

// ── imports after mocks ────────────────────────────────────────────────────
import { useWallet } from "@/hooks/useWallet";
import NewAssetPage from "../page";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// ── helpers ────────────────────────────────────────────────────────────────

const BASE_WALLET: ReturnType<typeof useWallet> = {
  address: null,
  network: "testnet",
  walletNetwork: null,
  networkUnknown: false,
  installed: true,
  connecting: false,
  error: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  setNetwork: jest.fn(),
  sign: jest.fn(),
  writeCtx: jest.fn(),
};

function setupWallet(address: string | null) {
  mockUseWallet.mockReturnValue({ ...BASE_WALLET, address });
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("/asset/new route", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("when wallet is disconnected", () => {
    it("renders the wallet-gate heading", () => {
      setupWallet(null);
      render(<NewAssetPage />);
      expect(
        screen.getByRole("heading", { name: /connect your wallet/i }),
      ).toBeInTheDocument();
    });

    it("renders explanatory text about connecting the issuer wallet", () => {
      setupWallet(null);
      render(<NewAssetPage />);
      expect(
        screen.getByText(/you must connect the issuer wallet/i),
      ).toBeInTheDocument();
    });

    it("renders a ConnectButton", () => {
      setupWallet(null);
      render(<NewAssetPage />);
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument();
    });

    it("does not render the wizard when disconnected", () => {
      setupWallet(null);
      render(<NewAssetPage />);
      expect(screen.queryByTestId("step-indicator")).not.toBeInTheDocument();
      expect(screen.queryByTestId("step-1")).not.toBeInTheDocument();
    });
  });

  describe("when wallet is connected", () => {
    it("renders the StepIndicator", () => {
      setupWallet("GISSUER");
      render(<NewAssetPage />);
      expect(screen.getByTestId("step-indicator")).toBeInTheDocument();
    });

    it("renders all four step labels in the indicator", () => {
      setupWallet("GISSUER");
      render(<NewAssetPage />);

      expect(screen.getByText(/token contract/i)).toBeInTheDocument();
      expect(screen.getByText(/asset details/i)).toBeInTheDocument();
      expect(screen.getByText(/confirm/i)).toBeInTheDocument();
      expect(screen.getByText(/done/i)).toBeInTheDocument();
    });

    it("renders Step 1 (Token Contract) on initial render", () => {
      setupWallet("GISSUER");
      render(<NewAssetPage />);
      expect(screen.getByTestId("step-1")).toBeInTheDocument();
    });

    it("does not render the wallet-gate prompt when connected", () => {
      setupWallet("GISSUER");
      render(<NewAssetPage />);
      expect(
        screen.queryByRole("heading", { name: /connect your wallet/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /connect wallet/i }),
      ).not.toBeInTheDocument();
    });

    it("marks step 1 as current in the step indicator", () => {
      setupWallet("GISSUER");
      render(<NewAssetPage />);

      const step1Btn = screen.getByTestId("step-1");
      const parentIndicator = step1Btn.closest("[data-testid='step-indicator']");
      const step1InIndicator = parentIndicator?.querySelector(
        "[data-testid='step-1'][aria-current='step']",
      );
      expect(step1InIndicator).toBeInTheDocument();
    });
  });

  describe("wizard structure", () => {
    it("wraps the wizard in a max-width container", () => {
      setupWallet("GISSUER");
      const { container } = render(<NewAssetPage />);

      const maxWidthDiv = container.querySelector(".max-w-2xl");
      expect(maxWidthDiv).toBeInTheDocument();
    });
  });
});
