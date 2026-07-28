import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworkSelector } from "../NetworkSelector";

// Mock useWallet with controllable return values
const mockSetNetwork = vi.fn();
const walletState = {
  address: null as string | null,
  network: "testnet" as "testnet" | "mainnet",
  walletNetwork: null as "testnet" | "mainnet" | null,
  setNetwork: mockSetNetwork,
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => walletState,
}));

beforeEach(() => {
  walletState.address = null;
  walletState.network = "testnet";
  walletState.walletNetwork = null;
  mockSetNetwork.mockClear();
});

describe("NetworkSelector — disconnected", () => {
  it("renders interactive buttons for both networks", () => {
    render(<NetworkSelector />);
    expect(screen.getByRole("button", { name: /testnet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mainnet/i })).toBeInTheDocument();
  });

  it("marks the active network as pressed", () => {
    render(<NetworkSelector />);
    const testnet = screen.getByRole("button", { name: /testnet/i });
    expect(testnet).toHaveAttribute("aria-pressed", "true");
    const mainnet = screen.getByRole("button", { name: /mainnet/i });
    expect(mainnet).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setNetwork when a button is clicked", async () => {
    const user = userEvent.setup();
    render(<NetworkSelector />);
    await user.click(screen.getByRole("button", { name: /mainnet/i }));
    expect(mockSetNetwork).toHaveBeenCalledWith("mainnet");
  });
});

describe("NetworkSelector — connected (locked)", () => {
  beforeEach(() => {
    walletState.address = "GABCDEFG";
    walletState.walletNetwork = "testnet";
  });

  it("does not render interactive buttons", () => {
    render(<NetworkSelector />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("displays the wallet network name", () => {
    render(<NetworkSelector />);
    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });

  it("shows a visible annotation explaining the network follows the wallet", () => {
    render(<NetworkSelector />);
    expect(screen.getByText(/via wallet/i)).toBeInTheDocument();
  });

  it("has an accessible label indicating the network follows the wallet", () => {
    render(<NetworkSelector />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute(
      "aria-label",
      expect.stringContaining("follows wallet"),
    );
  });

  it("shows mainnet label when wallet is on mainnet", () => {
    walletState.walletNetwork = "mainnet";
    render(<NetworkSelector />);
    expect(screen.getByText("Mainnet")).toBeInTheDocument();
  });
});
