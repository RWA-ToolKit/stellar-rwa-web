"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { assetToken } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { parseTokenAmount, formatTokenAmount } from "@/lib/format";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";

interface TokenPanelProps {
  asset: AssetDetail;
  onMinted?: () => void;
  onPauseToggled?: () => void;
}

/** Mint tokens to an address, and pause / unpause the token contract. */
export function TokenPanel({ asset, onMinted, onPauseToggled }: TokenPanelProps) {
  const { metadata, tokenContract } = asset;

  return (
    <div className="space-y-4">
      <MintCard
        tokenContract={tokenContract}
        metadata={metadata}
        onMinted={onMinted}
      />
      <PauseCard
        tokenContract={tokenContract}
        paused={metadata.paused}
        onToggled={onPauseToggled}
      />
    </div>
  );
}

// ---- Mint ----

function MintCard({
  tokenContract,
  metadata,
  onMinted,
}: {
  tokenContract: string;
  metadata: AssetDetail["metadata"];
  onMinted?: () => void;
}) {
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const recipient = to.trim();
    if (!StrKey.isValidEd25519PublicKey(recipient) && !StrKey.isValidContract(recipient)) {
      setFormError("Enter a valid Stellar address (G… or C…).");
      return;
    }
    let raw: bigint;
    try {
      raw = parseTokenAmount(amount, metadata.decimals);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }
    if (raw <= 0n) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    const res = await tx.run((ctx) =>
      assetToken.mint(ctx, tokenContract, recipient, raw),
    );
    if (res) {
      setTo("");
      setAmount("");
      onMinted?.();
    }
  }

  return (
    <ActionCard
      title="Mint tokens"
      description="Issue new tokens to a KYC-approved address, increasing total supply."
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" strokeLinecap="round" />
        </svg>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="mint-to" className="label">Recipient address</label>
          <input
            id="mint-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G… or C…"
            disabled={tx.pending}
            className="input font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div>
          <label htmlFor="mint-amount" className="label">Amount</label>
          <div className="relative">
            <input
              id="mint-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              disabled={tx.pending}
              className="input pr-20"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/40">
              {metadata.symbol}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-base-100/40">
            Current supply: {formatTokenAmount(metadata.totalSupply, metadata.decimals)} {metadata.symbol}
          </p>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button type="submit" disabled={tx.pending} className="btn-primary">
            Mint
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            onDismiss={tx.reset}
            successMessage="Tokens minted successfully."
          />
        )}
      </form>
    </ActionCard>
  );
}

// ---- Pause / Unpause ----

function PauseCard({
  tokenContract,
  paused,
  onToggled,
}: {
  tokenContract: string;
  paused: boolean;
  onToggled?: () => void;
}) {
  const tx = useTx();

  async function onToggle() {
    const res = await tx.run((ctx) =>
      paused
        ? assetToken.unpause(ctx, tokenContract)
        : assetToken.pause(ctx, tokenContract),
    );
    if (res) onToggled?.();
  }

  return (
    <ActionCard
      title={paused ? "Unpause transfers" : "Pause transfers"}
      description={
        paused
          ? "All transfers are currently blocked. Unpause to allow compliant holders to transfer the asset again."
          : "Temporarily stop all transfers of this token. Useful during compliance reviews or emergency situations."
      }
      accent={paused ? "bg-brand-500/10 text-brand-400" : "bg-amber-500/10 text-amber-400"}
      icon={
        paused ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        )
      }
    >
      {paused && (
        <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90">
          Transfers are currently paused. Holders cannot send or receive this token.
        </p>
      )}
      {tx.phase === "idle" ? (
        <button
          onClick={onToggle}
          disabled={tx.pending}
          className={paused ? "btn-primary" : "btn-secondary"}
        >
          {paused ? "Unpause transfers" : "Pause transfers"}
        </button>
      ) : (
        <TxProgress
          phase={tx.phase}
          hash={tx.hash}
          error={tx.error}
          onDismiss={tx.reset}
          successMessage={paused ? "Token unpaused." : "Token paused."}
        />
      )}
    </ActionCard>
  );
}
