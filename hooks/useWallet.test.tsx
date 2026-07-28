import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const fConnect = vi.fn();
const getConnectedAddress = vi.fn();
const getWalletNetwork = vi.fn();
const isFreighterInstalled = vi.fn();
const signTx = vi.fn();
const watchWallet = vi.fn();

vi.mock("@/lib/freighter", () => ({
  connect: (...args: unknown[]) => fConnect(...args),
  getConnectedAddress: (...args: unknown[]) => getConnectedAddress(...args),
  getWalletNetwork: (...args: unknown[]) => getWalletNetwork(...args),
  isFreighterInstalled: (...args: unknown[]) => isFreighterInstalled(...args),
  signTx: (...args: unknown[]) => signTx(...args),
  watchWallet: (...args: unknown[]) => watchWallet(...args),
}));

import { WalletProvider, useWallet } from "@/hooks/useWallet";

const STORAGE_KEY = "rwa.wallet.connected";

function wrapper({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}

async function renderWallet() {
  const view = renderHook(() => useWallet(), { wrapper });
  await waitFor(() => expect(isFreighterInstalled).toHaveBeenCalled());
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  isFreighterInstalled.mockResolvedValue(false);
  getConnectedAddress.mockResolvedValue(null);
  getWalletNetwork.mockResolvedValue(null);
  watchWallet.mockReturnValue(() => {});
});

describe("connect / disconnect", () => {
  it("connect sets the address, persists the session flag, and syncs network", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    fConnect.mockResolvedValue("GADDR");
    getWalletNetwork.mockResolvedValue("mainnet");

    const { result } = await renderWallet();

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe("GADDR");
    expect(result.current.network).toBe("mainnet");
    expect(result.current.walletNetwork).toBe("mainnet");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a friendly error and resets `connecting` when connect fails", async () => {
    fConnect.mockRejectedValue(new Error("User declined access"));
    const { result } = await renderWallet();

    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow(
        "User declined access",
      );
    });

    expect(result.current.error).toBe("User declined access");
    expect(result.current.connecting).toBe(false);
    expect(result.current.address).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("disconnect clears the address, walletNetwork, and the stored session flag", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    fConnect.mockResolvedValue("GADDR");
    getWalletNetwork.mockResolvedValue("testnet");
    const { result } = await renderWallet();

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.address).toBe("GADDR");

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.walletNetwork).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("session restore", () => {
  it("restores a prior session from localStorage when the extension is installed", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    isFreighterInstalled.mockResolvedValue(true);
    getConnectedAddress.mockResolvedValue("GRESTORED");
    getWalletNetwork.mockResolvedValue("testnet");

    const { result } = await renderWallet();

    await waitFor(() => expect(result.current.address).toBe("GRESTORED"));
    expect(result.current.installed).toBe(true);
    expect(result.current.network).toBe("testnet");
  });

  it("does not attempt a restore when there is no stored session flag", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    const { result } = await renderWallet();

    await waitFor(() => expect(result.current.installed).toBe(true));
    expect(getConnectedAddress).not.toHaveBeenCalled();
    expect(result.current.address).toBeNull();
  });

  it("does not attempt a restore when the extension is not installed", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    isFreighterInstalled.mockResolvedValue(false);

    const { result } = await renderWallet();

    expect(result.current.installed).toBe(false);
    expect(getConnectedAddress).not.toHaveBeenCalled();
    expect(result.current.address).toBeNull();
  });
});

describe("network follows the wallet while connected", () => {
  it("re-syncs the network when the extension reports a change", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    fConnect.mockResolvedValue("GADDR");
    getWalletNetwork.mockResolvedValueOnce("testnet").mockResolvedValueOnce("mainnet");

    let onChange: ((info: { address: string; network: string }) => void) | undefined;
    watchWallet.mockImplementation((cb: typeof onChange) => {
      onChange = cb;
      return () => {};
    });

    const { result } = await renderWallet();

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.network).toBe("testnet");
    expect(watchWallet).toHaveBeenCalled();

    await act(async () => {
      onChange?.({ address: "GADDR", network: "mainnet passphrase" });
    });

    await waitFor(() => expect(result.current.network).toBe("mainnet"));
  });

  it("updates the address when the extension reports an account switch", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    fConnect.mockResolvedValue("GADDR1");
    getWalletNetwork.mockResolvedValue("testnet");

    let onChange: ((info: { address: string; network: string }) => void) | undefined;
    watchWallet.mockImplementation((cb: typeof onChange) => {
      onChange = cb;
      return () => {};
    });

    const { result } = await renderWallet();

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      onChange?.({ address: "GADDR2", network: "testnet" });
    });

    await waitFor(() => expect(result.current.address).toBe("GADDR2"));
  });

  it("does not subscribe to wallet changes while disconnected", async () => {
    await renderWallet();
    expect(watchWallet).not.toHaveBeenCalled();
  });
});

describe("setNetwork", () => {
  it("is ignored while connected — the app follows the wallet", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    fConnect.mockResolvedValue("GADDR");
    getWalletNetwork.mockResolvedValue("testnet");
    const { result } = await renderWallet();

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.network).toBe("testnet");

    act(() => {
      result.current.setNetwork("mainnet");
    });

    expect(result.current.network).toBe("testnet");
  });

  it("changes the network while disconnected", async () => {
    const { result } = await renderWallet();

    act(() => {
      result.current.setNetwork("mainnet");
    });

    expect(result.current.network).toBe("mainnet");
  });
});

describe("sign", () => {
  it("rejects when there is no connected address", async () => {
    const { result } = await renderWallet();

    await expect(result.current.sign("XDR")).rejects.toThrow(
      "Connect your wallet first.",
    );
    expect(signTx).not.toHaveBeenCalled();
  });

  it("delegates to signTx with the connected address once connected", async () => {
    isFreighterInstalled.mockResolvedValue(true);
    fConnect.mockResolvedValue("GADDR");
    getWalletNetwork.mockResolvedValue("testnet");
    signTx.mockResolvedValue("SIGNED_XDR");
    const { result } = await renderWallet();

    await act(async () => {
      await result.current.connect();
    });

    await expect(result.current.sign("XDR")).resolves.toBe("SIGNED_XDR");
    expect(signTx).toHaveBeenCalledWith("XDR", expect.any(String), "GADDR");
  });
});

describe("useWallet outside a provider", () => {
  it("throws a helpful error", () => {
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used within a WalletProvider",
    );
  });
});
