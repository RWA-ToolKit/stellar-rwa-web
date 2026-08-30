import { fireEvent, render, screen } from "@testing-library/react";
import { Keypair } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { useCompliance } from "@/hooks/useCompliance";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { TransferPanel } from "./TransferPanel";

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

const SENDER = Keypair.random().publicKey();
const RECIPIENT = Keypair.random().publicKey();

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

function setup() {
  mockUseWallet.mockReturnValue({ address: SENDER } as ReturnType<typeof useWallet>);
  mockUseCompliance.mockImplementation((_complianceId, address) => ({
    data: address === RECIPIENT
      ? { allowed: false, status: "Rejected", record: null }
      : { allowed: true, status: "Approved", record: null },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }));
  mockUseTx.mockReturnValue({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    run: jest.fn(),
    reset: jest.fn(),
  });

  render(<TransferPanel asset={asset} balance={100n} />);
}

describe("TransferPanel", () => {
  afterEach(() => jest.clearAllMocks());

  describe("when no wallet is connected and Freighter is not installed", () => {
    it("renders Freighter install link", () => {
      mockUseWallet.mockReturnValue({
        address: null,
        installed: false,
        network: "testnet",
        walletNetwork: null,
        networkUnknown: false,
        connecting: false,
        error: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        setNetwork: jest.fn(),
        sign: jest.fn(),
        writeCtx: jest.fn(),
      } as ReturnType<typeof useWallet>);
      mockUseCompliance.mockImplementation((_complianceId, address) => ({
        data: address === RECIPIENT
          ? { allowed: false, status: "Rejected", record: null }
          : { allowed: true, status: "Approved", record: null },
        loading: false,
        error: null,
        refetch: jest.fn(),
      }));
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<TransferPanel asset={asset} balance={100n} />);

      expect(screen.getByText(/freighter wallet not installed/i)).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /install freighter/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://www.freighter.app");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

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
});
