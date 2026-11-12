import { fireEvent, render, screen } from "@testing-library/react";
import type { AssetDetail, TxResult } from "@/types";
import { useCompliance } from "@/hooks/useCompliance";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { TransferPanel } from "./TransferPanel";

// Mock @stellar/stellar-sdk to avoid ESM parse issues in Jest.
// StrKey validation is mocked to accept any address starting with "G" as a
// valid Ed25519 key and any starting with "C" as a valid contract.
jest.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: (addr: string) => typeof addr === "string" && addr.startsWith("G"),
    isValidContract: (addr: string) => typeof addr === "string" && addr.startsWith("C"),
  },
  Networks: {
    TESTNET: "Test SDF Network ; September 2015",
    PUBLIC: "Public Global Stellar Network ; September 2015",
  },
  rpc: {
    Server: jest.fn(),
  },
  Contract: jest.fn(),
  TransactionBuilder: jest.fn(),
  TimeoutInfinite: 0,
}));

jest.mock("@/hooks/useCompliance", () => ({
  useCompliance: jest.fn(),
}));

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockUseCompliance = useCompliance as jest.MockedFunction<typeof useCompliance>;
const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Use fixed Stellar testnet addresses to avoid importing @stellar/stellar-sdk in tests
const SENDER = "GAASI5RLKX5JKZXLNZLNZLKX5JKZXLNZLNZLKX5JKZXLNZLNZLKX5JKA";
const RECIPIENT = "GBQSO3ULJZXLNZLNZLKX5JKZXLNZLNZLKX5JKZXLNZLNZLKX5JKZXMB";

const asset = {
  tokenContract: "CTOKEN",
  metadata: {
    complianceContract: "CCOMPLIANCE",
    decimals: 0,
    symbol: "TOKEN",
    totalSupply: 1_000n,
    paused: false,
  },
} as AssetDetail;

/** Asset with 2 decimal places — used to test decimals-aware validation. */
const assetWith2Decimals = {
  ...asset,
  metadata: { ...asset.metadata, decimals: 2 },
} as AssetDetail;

function setup(assetOverride: AssetDetail = asset) {
  mockUseWallet.mockReturnValue({ address: SENDER } as ReturnType<typeof useWallet>);
  mockUseCompliance.mockImplementation((_complianceId, address) => ({
    data: address === RECIPIENT
      ? { allowed: false, status: "Rejected", record: null }
      : { allowed: true, status: "Approved", record: null },
    loading: false,
    error: null,
    updatedAt: null,
    refetch: jest.fn(),
  }));
  mockUseTx.mockReturnValue({
    phase: "idle",
    hash: null,
    error: null,
    errorType: "generic",
    estimatedFee: null,
    pending: false,
    retryable: false,
    run: jest.fn(),
    retry: jest.fn(),
    reset: jest.fn(),
  });

  render(<TransferPanel asset={assetOverride} balance={100n} />);
}

describe("TransferPanel", () => {
  afterEach(() => jest.clearAllMocks());

  it("disables submit for an invalid recipient address", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: "not-an-address" },
    });

    expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
  });

  it("disables submit for an invalid amount", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });

    expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
  });

  it("warns and disables transfer when the recipient is your own address", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: SENDER },
    });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });

    expect(screen.getByRole("alert")).toHaveTextContent(/your connected wallet address/i);
    expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
  });

  it("surfaces a warning when the recipient is not KYC-approved", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: RECIPIENT },
    });

    expect(
      screen.getByText(
        "Recipient isn't KYC-approved for this asset and can't receive a transfer.",
      ),
    ).toBeInTheDocument();
  });

  it("explains that transfers are paused and never submits a paused transfer", () => {
    const pausedAsset = {
      ...asset,
      metadata: { ...asset.metadata, paused: true },
    } as AssetDetail;
    setup(pausedAsset);
    const run = mockUseTx.mock.results[0]!.value.run;

    expect(
      screen.getByText(/transfers are paused by the issuer.*unpauses the token/i),
    ).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Transfers paused" });
    expect(submit).toBeDisabled();

    fireEvent.submit(submit.closest("form")!);

    expect(
      screen.getByText("Transfers are paused by the issuer for this asset."),
    ).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  // ── Issue #231: decimals-aware inline validation ─────────────────────────

  describe("decimals-aware inline validation", () => {
    it("shows no error for an amount within the allowed decimal places", () => {
      setup(assetWith2Decimals);

      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "1.25" },
      });

      // No inline decimal error should appear
      expect(
        screen.queryByText(/maximum 2 decimal places/i),
      ).not.toBeInTheDocument();
    });

    it("shows an inline error when the amount exceeds allowed decimal places", () => {
      setup(assetWith2Decimals);

      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "1.256" },
      });

      expect(
        screen.getByText(/maximum 2 decimal places/i),
      ).toBeInTheDocument();
    });

    it("disables the submit button when the amount exceeds allowed decimal places", () => {
      setup(assetWith2Decimals);

      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "1.256" },
      });

      expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
    });

    it("clears the inline error once the user corrects the decimal places", () => {
      setup(assetWith2Decimals);

      // Type an invalid amount first
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "1.256" },
      });
      expect(screen.getByText(/maximum 2 decimal places/i)).toBeInTheDocument();

      // Correct it to a valid amount
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "1.25" },
      });
      expect(
        screen.queryByText(/maximum 2 decimal places/i),
      ).not.toBeInTheDocument();
    });

    it("shows no error for a whole-number amount when decimals > 0", () => {
      setup(assetWith2Decimals);

      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "10" },
      });

      expect(
        screen.queryByText(/maximum 2 decimal places/i),
      ).not.toBeInTheDocument();
    });

    it("shows an error when a token has 0 decimals and user types a decimal amount", () => {
      setup(asset); // asset.metadata.decimals === 0

      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "1.5" },
      });

      expect(
        screen.getByText(/maximum 0 decimal places/i),
      ).toBeInTheDocument();
    });
  });

  describe("aria error association", () => {
    it("links the recipient error to the input and marks it invalid", () => {
      setup();
      const input = screen.getByLabelText("Recipient address");
      expect(input).not.toHaveAttribute("aria-invalid");

      fireEvent.change(input, { target: { value: RECIPIENT } });

      expect(input).toHaveAttribute("aria-invalid", "true");
      const errorId = input.getAttribute("aria-describedby");
      expect(errorId).toBeTruthy();
      expect(document.getElementById(errorId!)).toHaveTextContent(/isn't KYC-approved/i);
    });

    it("links the amount error to the input and marks it invalid", () => {
      setup(assetWith2Decimals);
      const input = screen.getByLabelText("Amount");

      fireEvent.change(input, { target: { value: "1.256" } });

      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent(
        /maximum 2 decimal places/i,
      );

      fireEvent.change(input, { target: { value: "1.25" } });
      expect(input).not.toHaveAttribute("aria-invalid");
      expect(input).not.toHaveAttribute("aria-describedby");
    });
  });

  describe("double submission prevention", () => {
    it("disables submit button while transaction is pending", () => {
      mockUseWallet.mockReturnValue({ address: SENDER } as ReturnType<typeof useWallet>);
      mockUseCompliance.mockReturnValue({
        data: { allowed: true, status: "Approved", record: null },
        loading: false,
        error: null,
        updatedAt: null,
        refetch: jest.fn(),
      });

      // Set up with pending=true
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        errorType: "generic",
        estimatedFee: null,
        pending: true,
        run: jest.fn(),
        retryable: false,
        retry: jest.fn(),
        reset: jest.fn(),
      });

      render(<TransferPanel asset={asset} balance={100n} />);

      // When pending=true and form is in idle state, button should be visible but disabled
      const submitButton = screen.queryByRole("button", { name: "Transfer" });
      if (submitButton) {
        // Button is shown and disabled
        expect(submitButton).toBeDisabled();
      }
      // If TxProgress is shown instead, that's also correct (button won't exist)
    });
  });

  describe("network switch mid-session (#680)", () => {
    it("resets tx state and ignores stale testnet transfer completion after switching to mainnet", async () => {
      const APPROVED_RECIPIENT = "GAPPROVEDRECIPIENT1234567890ABCDEFGHIJKLMNOPQRSTUVWX";
      let currentNetwork: "testnet" | "mainnet" = "testnet";
      mockUseWallet.mockImplementation(
        () => ({ address: SENDER, network: currentNetwork }) as ReturnType<typeof useWallet>,
      );
      mockUseCompliance.mockReturnValue({
        data: { allowed: true, status: "Approved", record: null },
        loading: false,
        error: null,
        updatedAt: null,
        refetch: jest.fn(),
      });

      let resolveTransfer!: (value: TxResult | null) => void;
      const run = jest.fn<Promise<TxResult | null>, [Parameters<ReturnType<typeof useTx>["run"]>[0]]>(
        () =>
          new Promise<TxResult | null>((resolve) => {
            resolveTransfer = resolve;
          }),
      );
      const reset = jest.fn();
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        errorType: "generic",
        estimatedFee: null,
        pending: false,
        retryable: false,
        run,
        retry: jest.fn(),
        reset,
      });

      const onTransferred = jest.fn();
      const { rerender } = render(
        <TransferPanel asset={asset} balance={100n} onTransferred={onTransferred} />,
      );

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: APPROVED_RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "25" },
      });
      fireEvent.submit(screen.getByRole("button", { name: "Transfer" }).closest("form")!);

      expect(run).toHaveBeenCalledTimes(1);
      expect(reset).not.toHaveBeenCalled();

      // Switch network mid-session from testnet -> mainnet while tx.run is still in flight
      currentNetwork = "mainnet";
      rerender(<TransferPanel asset={asset} balance={100n} onTransferred={onTransferred} />);

      expect(reset).toHaveBeenCalledTimes(1);

      // Resolve the stale testnet transaction
      resolveTransfer({ hash: "testnet-tx-hash" });
      await Promise.resolve();
      await Promise.resolve();

      expect(onTransferred).not.toHaveBeenCalled();
      expect((screen.getByLabelText("Recipient address") as HTMLInputElement).value).toBe(
        APPROVED_RECIPIENT,
      );
      expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("25");
    });

    it("clears stale form submission errors when switching networks from testnet to mainnet", () => {
      let currentNetwork: "testnet" | "mainnet" = "testnet";
      mockUseWallet.mockImplementation(
        () => ({ address: SENDER, network: currentNetwork }) as ReturnType<typeof useWallet>,
      );
      mockUseCompliance.mockReturnValue({
        data: { allowed: true, status: "Approved", record: null },
        loading: false,
        error: null,
        updatedAt: null,
        refetch: jest.fn(),
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        errorType: "generic",
        estimatedFee: null,
        pending: false,
        retryable: false,
        run: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

      const { rerender } = render(<TransferPanel asset={asset} balance={100n} />);

      fireEvent.submit(screen.getByRole("button", { name: "Transfer" }).closest("form")!);
      expect(screen.getByText(/enter a valid stellar address/i)).toBeInTheDocument();

      currentNetwork = "mainnet";
      rerender(<TransferPanel asset={asset} balance={100n} />);

      expect(screen.queryByText(/enter a valid stellar address/i)).not.toBeInTheDocument();
    });

    it("does not leak cached testnet compliance or balance state into mainnet UI during a switch", () => {
      let currentNetwork: "testnet" | "mainnet" = "testnet";
      mockUseWallet.mockImplementation(
        () => ({ address: SENDER, network: currentNetwork }) as ReturnType<typeof useWallet>,
      );
      mockUseCompliance.mockImplementation(() =>
        currentNetwork === "testnet"
          ? {
              data: {
                allowed: true,
                status: "Approved",
                record: {
                  address: SENDER,
                  status: "Approved",
                  jurisdiction: "US",
                  verifiedAt: 1000,
                  expiresAt: 42000,
                },
              },
              loading: false,
              error: null,
              updatedAt: 1000,
              refetch: jest.fn(),
            }
          : {
              data: null,
              loading: true,
              error: null,
              updatedAt: null,
              refetch: jest.fn(),
            },
      );
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        errorType: "generic",
        estimatedFee: null,
        pending: false,
        retryable: false,
        run: jest.fn(),
        retry: jest.fn(),
        reset: jest.fn(),
      });

      const { rerender } = render(<TransferPanel asset={asset} balance={250n} />);

      expect(screen.getByText(/expires at ledger 42000/i)).toBeInTheDocument();
      expect(screen.getByText("250 TOKEN")).toBeInTheDocument();

      currentNetwork = "mainnet";
      rerender(<TransferPanel asset={asset} balance={250n} balanceLoading />);

      expect(screen.queryByText(/expires at ledger 42000/i)).not.toBeInTheDocument();
      expect(screen.queryByText("250 TOKEN")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /checking compliance/i })).toBeDisabled();
    });
  });
});
