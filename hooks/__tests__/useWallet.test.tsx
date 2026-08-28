import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "../useWallet";
import {
  connect as fConnect,
  getConnectedAddress,
  getWalletNetwork,
  isFreighterInstalled,
} from "@/lib/freighter";

jest.mock("@/lib/freighter", () => ({
  isFreighterInstalled: jest.fn(),
  getConnectedAddress: jest.fn(),
  getWalletNetwork: jest.fn(),
  connect: jest.fn(),
  signTx: jest.fn(),
  watchWallet: jest.fn(() => () => {}),
}));

describe("useWallet", () => {
  const STORAGE_KEY = "rwa.wallet.connected";

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("throws error when used outside WalletProvider", () => {
    // Suppress console error for expected throw
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used within a WalletProvider",
    );
    spy.mockRestore();
  });

  it("initializes with default disconnected state when no session stored", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(false);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.address).toBeNull();
    expect(result.current.connecting).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it("restores session on mount ONLY when account is still authorized", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (getConnectedAddress as jest.Mock).mockResolvedValue("GAUTHORIZED123");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(result.current.address).toBe("GAUTHORIZED123"));

    expect(result.current.installed).toBe(true);
    expect(result.current.network).toBe("testnet");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("clears storage key and does NOT restore address when account is unauthorized / revoked", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    // getConnectedAddress returns null because access was revoked in wallet extension
    (getConnectedAddress as jest.Mock).mockResolvedValue(null);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(isFreighterInstalled).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());

    expect(result.current.address).toBeNull();
  });

  it("clears state and local storage on disconnect", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (getConnectedAddress as jest.Mock).mockResolvedValue("GCONNECTED123");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(result.current.address).toBe("GCONNECTED123"));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.walletNetwork).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("connects wallet successfully and sets storage key", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (fConnect as jest.Mock).mockResolvedValue("GNEWLYCONNECTED");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe("GNEWLYCONNECTED");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});
