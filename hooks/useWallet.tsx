"use client";

/**
 * Wallet context: connection state, the active network, and a `sign` function
 * bound to the connected account. The app's network follows Freighter while
 * connected (so reads and writes always agree), and is user-selectable while
 * disconnected for read-only browsing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  connect as fConnect,
  getConnectedAddress,
  getWalletNetwork,
  isFreighterInstalled,
  signTx,
  watchWallet,
} from "@/lib/freighter";
import { DEFAULT_NETWORK, networkPassphrase } from "@/lib/stellar";
import type { WriteCtx } from "@/lib/contracts";
import type { Network } from "@/types";

interface WalletContextValue {
  address: string | null;
  network: Network;
  walletNetwork: Network | null;
  installed: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  setNetwork: (n: Network) => void;
  sign: (xdr: string) => Promise<string>;
  /** Build a write context for contract calls; throws if not connected. */
  writeCtx: (onPhase?: WriteCtx["onPhase"]) => WriteCtx;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "rwa.wallet.connected";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetworkState] = useState<Network>(DEFAULT_NETWORK);
  const [walletNetwork, setWalletNetwork] = useState<Network | null>(null);
  const [installed, setInstalled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addressRef = useRef<string | null>(null);
  addressRef.current = address;

  const syncNetwork = useCallback(async () => {
    const wn = await getWalletNetwork();
    setWalletNetwork(wn);
    if (wn) setNetworkState(wn);
  }, []);

  // Restore a prior session silently and detect the extension on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const present = await isFreighterInstalled();
      if (cancelled) return;
      setInstalled(present);
      if (!present) return;
      if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) {
        const existing = await getConnectedAddress();
        if (!cancelled && existing) {
          setAddress(existing);
          await syncNetwork();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncNetwork]);

  // React to account / network switches made inside the extension.
  useEffect(() => {
    if (!address) return;
    const stop = watchWallet(({ address: next }) => {
      if (next && next !== addressRef.current) setAddress(next);
      void syncNetwork();
    });
    return stop;
  }, [address, syncNetwork]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await fConnect();
      setAddress(addr);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
      await syncNetwork();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet.");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [syncNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletNetwork(null);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setNetwork = useCallback(
    (n: Network) => {
      // Only meaningful while disconnected; connected apps follow the wallet.
      if (!address) setNetworkState(n);
    },
    [address],
  );

  const sign = useCallback(
    (xdr: string) => {
      if (!addressRef.current) {
        return Promise.reject(new Error("Connect your wallet first."));
      }
      return signTx(xdr, networkPassphrase(network), addressRef.current);
    },
    [network],
  );

  const writeCtx = useCallback(
    (onPhase?: WriteCtx["onPhase"]): WriteCtx => {
      if (!addressRef.current) throw new Error("Connect your wallet first.");
      return { network, source: addressRef.current, sign, onPhase };
    },
    [network, sign],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      network,
      walletNetwork,
      installed,
      connecting,
      error,
      connect,
      disconnect,
      setNetwork,
      sign,
      writeCtx,
    }),
    [
      address,
      network,
      walletNetwork,
      installed,
      connecting,
      error,
      connect,
      disconnect,
      setNetwork,
      sign,
      writeCtx,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
