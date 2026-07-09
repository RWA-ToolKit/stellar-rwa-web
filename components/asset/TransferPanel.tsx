"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { assetToken } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useTx } from "@/hooks/useTx";
import { useCompliance } from "@/hooks/useCompliance";
import { formatTokenAmount, parseTokenAmount } from "@/lib/format";
import { TxProgress } from "@/components/ui/TxProgress";
import { ComplianceBadge } from "@/components/compliance/ComplianceBadge";

interface TransferPanelProps {
  asset: AssetDetail;
  balance: bigint;
  onTransferred?: () => void;
}

/**
 * Transfer form for an asset token. The action is gated on the connected
 * wallet's compliance status: transfers are only enabled for KYC-approved
 * holders, and the recipient is validated up front. Every gating condition is
 * surfaced with an explicit message rather than a silently disabled button.
 */
export function TransferPanel({ asset, balance, onTransferred }: TransferPanelProps) {
  const { address } = useWallet();
  const { metadata } = asset;
  const compliance = useCompliance(metadata.complianceContract, address);
  const tx = useTx();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!address) {
    return (
      <p className="text-sm text-base-100/50">
        Connect your wallet to view your balance and transfer this asset.
      </p>
    );
  }

  const approved = compliance.data?.allowed ?? false;
  const status = compliance.data?.status ?? "None";
  const paused = metadata.paused;
  const canTransfer = approved && !paused && balance > 0n;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const recipient = to.trim();
    if (!StrKey.isValidEd25519PublicKey(recipient) && !StrKey.isValidContract(recipient)) {
      setFormError("Enter a valid Stellar address (starts with G or C).");
      return;
    }
    if (recipient === address) {
      setFormError("You can't transfer to your own address.");
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
    if (raw > balance) {
      setFormError("Amount exceeds your balance.");
      return;
    }

    const res = await tx.run((ctx) =>
      assetToken.transfer(ctx, asset.tokenContract, recipient, raw),
    );
    if (res) {
      setTo("");
      setAmount("");
      onTransferred?.();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-base-100/50">Your balance</span>
        <span className="font-semibold text-base-100">
          {formatTokenAmount(balance, metadata.decimals)} {metadata.symbol}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-base-100/50">Your compliance status</span>
        {compliance.loading ? (
          <span className="text-xs text-base-100/40">Checking…</span>
        ) : (
          <ComplianceBadge status={status} />
        )}
      </div>

      {/* Explicit gating messages. */}
      {!compliance.loading && !approved && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-200/90">
          {status === "None"
            ? "Your address isn't on this asset's KYC allowlist. Ask the issuer to approve you before you can hold or transfer it."
            : status === "Suspended"
              ? "Your approval is suspended for this asset. Contact the issuer to reinstate it."
              : status === "Pending"
                ? "Your KYC approval is pending. Transfers unlock once the issuer approves you."
                : "Your address is not permitted to transfer this asset (rejected or expired approval)."}
        </p>
      )}
      {paused && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-200/90">
          Transfers are paused by the issuer for this asset.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3 border-t border-white/5 pt-4">
        <div>
          <label htmlFor="transfer-to" className="label">Recipient address</label>
          <input
            id="transfer-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G… or C…"
            disabled={!canTransfer || tx.pending}
            className="input font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="transfer-amount" className="label">Amount</label>
            {canTransfer && (
              <button
                type="button"
                onClick={() => setAmount(formatTokenAmount(balance, metadata.decimals).replace(/,/g, ""))}
                className="mb-1.5 text-xs text-brand-400 hover:text-brand-300"
              >
                Max
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="transfer-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              disabled={!canTransfer || tx.pending}
              className="input pr-16"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/40">
              {metadata.symbol}
            </span>
          </div>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button type="submit" disabled={!canTransfer} className="btn-primary w-full">
            {canTransfer ? "Transfer" : "Transfer unavailable"}
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            onDismiss={tx.reset}
            successMessage="Transfer confirmed."
          />
        )}
      </form>
    </div>
  );
}
