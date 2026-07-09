"use client";

import { dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { TxProgress } from "@/components/ui/TxProgress";
import { formatTokenAmount } from "@/lib/format";

/** Stellar classic / SAC payment tokens use 7 decimals. */
export const PAYMENT_TOKEN_DECIMALS = 7;

interface ClaimButtonProps {
  distributionId: bigint;
  claimable: bigint;
  claimed: boolean;
  onClaimed?: () => void;
}

/**
 * Lets a holder claim their proportional share of a distribution. Disabled
 * (with an explanatory label) when there is nothing to claim or it's already
 * been claimed.
 */
export function ClaimButton({ distributionId, claimable, claimed, onClaimed }: ClaimButtonProps) {
  const { address } = useWallet();
  const tx = useTx();

  if (!address) {
    return <p className="text-xs text-base-100/40">Connect a wallet to claim.</p>;
  }

  if (claimed) {
    return (
      <span className="chip border border-white/10 bg-white/5 text-base-100/50">
        Claimed
      </span>
    );
  }

  const nothing = claimable <= 0n;

  async function onClaim() {
    const res = await tx.run((ctx) => dividend.claim(ctx, distributionId));
    if (res) onClaimed?.();
  }

  return (
    <div className="space-y-2">
      {tx.phase === "idle" ? (
        <button onClick={onClaim} disabled={nothing} className="btn-primary w-full sm:w-auto">
          {nothing
            ? "Nothing to claim"
            : `Claim ${formatTokenAmount(claimable, PAYMENT_TOKEN_DECIMALS)}`}
        </button>
      ) : (
        <TxProgress
          phase={tx.phase}
          hash={tx.hash}
          error={tx.error}
          onDismiss={tx.reset}
          successMessage="Dividend claimed to your wallet."
        />
      )}
    </div>
  );
}
