"use client";

import { useWallet } from "@/hooks/useWallet";
import type { Network } from "@/types";

const NETWORKS: { value: Network; label: string }[] = [
  { value: "testnet", label: "Testnet" },
  { value: "mainnet", label: "Mainnet" },
];

/**
 * Switches the active network for read-only browsing. While a wallet is
 * connected the app follows Freighter's network, so the control locks and
 * simply reflects the wallet's current network.
 */
export function NetworkSelector() {
  const { network, setNetwork, address, walletNetwork } = useWallet();
  const locked = Boolean(address);

  if (locked) {
    return (
      <span
        title="Network follows your connected wallet"
        className="chip border border-white/10 bg-white/5 text-base-100/60"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
        {label(walletNetwork ?? network)}
      </span>
    );
  }

  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-base-900/60 p-0.5">
      {NETWORKS.map((n) => (
        <button
          key={n.value}
          onClick={() => setNetwork(n.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            network === n.value
              ? "bg-white/10 text-base-100"
              : "text-base-100/50 hover:text-base-100/80"
          }`}
          aria-pressed={network === n.value}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

function label(n: Network): string {
  return n === "mainnet" ? "Mainnet" : "Testnet";
}
