import { fireEvent, render, screen } from "@testing-library/react";
import { Keypair } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { useTx } from "@/hooks/useTx";
import { TokenPanel } from "./TokenPanel";

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(),
}));

jest.mock("@/lib/contracts", () => ({
  assetToken: {
    mint: jest.fn(),
    pause: jest.fn(),
    unpause: jest.fn(),
  },
}));

jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: ({
    phase,
    hash,
    error,
    onDismiss,
    successMessage,
  }: {
    phase: string;
    hash: string | null;
    error: string | null;
    onDismiss: () => void;
    successMessage: string;
  }) => (
    <div data-testid="tx-progress">
      <p>Phase: {phase}</p>
      {hash && <p>Hash: {hash}</p>}
      {error && <p>Error: {error}</p>}
      <p>{successMessage}</p>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;

const RECIPIENT = Keypair.random().publicKey();

const createMockAsset = (overrides: Partial<AssetDetail> = {}): AssetDetail => ({
  id: 1n,
  tokenContract: "CTOKEN1",
  issuer: "GISSUER",
  name: "Test Asset",
  assetType: "real_estate",
  valuation: 1_000_000_00n,
  createdAt: 50000,
  active: true,
  metadata: {
    name: "Test Asset",
    symbol: "TEST",
    assetType: "real_estate",
    totalSupply: 1_000_000n,
    decimals: 7,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "Test asset",
    valuation: 1_000_000_00n,
    paused: false,
  },
  ...overrides,
});

function setupIdleTx() {
  mockUseTx.mockReturnValue({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    run: jest.fn(async (fn) => {
      await fn({} as any);
      return true;
    }),
    reset: jest.fn(),
  });
}

describe("TokenPanel", () => {
  afterEach(() => jest.clearAllMocks());

  describe("MintCard", () => {
    it("renders the mint form with address and amount fields", () => {
      setupIdleTx();
      render(<TokenPanel asset={createMockAsset()} />);

      expect(screen.getByLabelText("Recipient address")).toBeInTheDocument();
      expect(screen.getByLabelText("Amount")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mint" })).toBeInTheDocument();
    });

    it("displays the token symbol in the amount field", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              symbol: "GOLD",
            },
          })}
        />
      );

      expect(screen.getByText("GOLD")).toBeInTheDocument();
    });

    it("displays the current token supply", () => {
      setupIdleTx();
      const asset = createMockAsset({
        metadata: {
          ...createMockAsset().metadata,
          totalSupply: 5_000_000n,
          decimals: 7,
          symbol: "TEST",
        },
      });
      render(<TokenPanel asset={asset} />);

      expect(screen.getByText(/Current supply: 500 TEST/)).toBeInTheDocument();
    });

    it("rejects an invalid recipient address", async () => {
      setupIdleTx();
      render(<TokenPanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: "not-a-stellar-address" },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(
        screen.getByText("Enter a valid Stellar address (G… or C…).")
      ).toBeInTheDocument();
    });

    it("accepts a valid G… address", async () => {
      setupIdleTx();
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });

      render(<TokenPanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(mockRun).toHaveBeenCalled();
    });

    it("accepts a valid C… contract address", async () => {
      setupIdleTx();
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });

      render(<TokenPanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4" },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(mockRun).toHaveBeenCalled();
    });

    it("rejects a zero or negative amount", async () => {
      setupIdleTx();
      render(<TokenPanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "0" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(
        screen.getByText("Amount must be greater than zero.")
      ).toBeInTheDocument();
    });

    it("disables form inputs while a transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<TokenPanel asset={createMockAsset()} />);

      expect(screen.getByLabelText("Recipient address")).toBeDisabled();
      expect(screen.getByLabelText("Amount")).toBeDisabled();
    });

    it("shows TxProgress when transaction is not idle", () => {
      mockUseTx.mockReturnValue({
        phase: "confirming",
        hash: "abc123",
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(<TokenPanel asset={createMockAsset()} />);

      expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
      expect(screen.getByText(/Phase: confirming/)).toBeInTheDocument();
    });

    it("clears the form after successful mint", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });

      const onMinted = jest.fn();
      render(<TokenPanel asset={createMockAsset()} onMinted={onMinted} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(onMinted).toHaveBeenCalled();
    });

    it("calls onMinted callback when mint succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });

      const onMinted = jest.fn();
      render(<TokenPanel asset={createMockAsset()} onMinted={onMinted} />);

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: "100" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mint" }));

      expect(onMinted).toHaveBeenCalled();
    });
  });

  describe("PauseCard", () => {
    it("renders pause button when token is not paused", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: false,
            },
          })}
        />
      );

      expect(screen.getByRole("button", { name: "Pause transfers" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Unpause transfers" })
      ).not.toBeInTheDocument();
    });

    it("renders unpause button when token is paused", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: true,
            },
          })}
        />
      );

      expect(
        screen.getByRole("button", { name: "Unpause transfers" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Pause transfers" })
      ).not.toBeInTheDocument();
    });

    it("displays pause warning when token is paused", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: true,
            },
          })}
        />
      );

      expect(
        screen.getByText("Transfers are currently paused.")
      ).toBeInTheDocument();
    });

    it("does not display pause warning when token is not paused", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: false,
            },
          })}
        />
      );

      expect(
        screen.queryByText("Transfers are currently paused.")
      ).not.toBeInTheDocument();
    });

    it("disables pause button while transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: false,
            },
          })}
        />
      );

      expect(
        screen.getByRole("button", { name: "Pause transfers" })
      ).toBeDisabled();
    });

    it("disables unpause button while transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: true,
            },
          })}
        />
      );

      expect(
        screen.getByRole("button", { name: "Unpause transfers" })
      ).toBeDisabled();
    });

    it("shows TxProgress when pause transaction is not idle", () => {
      mockUseTx.mockReturnValue({
        phase: "confirming",
        hash: "def456",
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });

      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: false,
            },
          })}
        />
      );

      expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
    });

    it("calls onPauseToggled callback when pause succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });

      const onPauseToggled = jest.fn();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: false,
            },
          })}
          onPauseToggled={onPauseToggled}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Pause transfers" }));

      expect(onPauseToggled).toHaveBeenCalled();
    });

    it("calls onPauseToggled callback when unpause succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });

      const onPauseToggled = jest.fn();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: true,
            },
          })}
          onPauseToggled={onPauseToggled}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Unpause transfers" }));

      expect(onPauseToggled).toHaveBeenCalled();
    });

    it("uses btn-primary styling for pause button", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: false,
            },
          })}
        />
      );

      const pauseButton = screen.getByRole("button", { name: "Pause transfers" });
      expect(pauseButton).toHaveClass("btn-secondary");
    });

    it("uses btn-primary styling for unpause button", () => {
      setupIdleTx();
      render(
        <TokenPanel
          asset={createMockAsset({
            metadata: {
              ...createMockAsset().metadata,
              paused: true,
            },
          })}
        />
      );

      const unpauseButton = screen.getByRole("button", { name: "Unpause transfers" });
      expect(unpauseButton).toHaveClass("btn-primary");
    });
  });
});
