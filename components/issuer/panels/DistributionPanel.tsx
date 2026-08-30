"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useDividends } from "@/hooks/useDividends";
import { parseTokenAmount, formatTokenAmount, truncateAddress } from "@/lib/format";
import { PAYMENT_TOKEN_DECIMALS } from "@/components/dividend/ClaimButton";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { percent } from "@/lib/format";

interface DistributionPanelProps {
  asset: AssetDetail;
  onCreated?: () => void;
}

/** Create new dividend distributions and view existing ones for the asset. */
export function DistributionPanel({ asset, onCreated }: DistributionPanelProps) {
  return (
    <div className="space-y-4">
      <CreateDistributionCard
        tokenContract={asset.tokenContract}
        onCreated={onCreated}
      />
      <ExistingDistributionsCard tokenContract={asset.tokenContract} />
    </div>
  );
}

// ---- Create distribution ----

function CreateDistributionCard({
  tokenContract,
  onCreated,
}: {
  tokenContract: string;
  onCreated?: () => void;
}) {
  const tx = useTx();
  const [paymentToken, setPaymentToken] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const pt = paymentToken.trim();
    if (!StrKey.isValidContract(pt) && !StrKey.isValidEd25519PublicKey(pt)) {
      setFormError("Enter a valid payment token contract address (C…).");
      return;
    }

    let raw: bigint;
    try {
      raw = parseTokenAmount(totalAmount, PAYMENT_TOKEN_DECIMALS);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }
    if (raw <= 0n) {
      setFormError("Total amount must be greater than zero.");
      return;
    }

    const res = await tx.run((ctx) =>
      dividend.createDistribution(ctx, tokenContract, pt, raw),
    );
    if (res) {
      setPaymentToken("");
      setTotalAmount("");
      onCreated?.();
    }
  }

  return (
    <ActionCard
      title="Create distribution"
      description="Fund a new dividend distribution. The payment token will be distributed proportionally to all token holders at snapshot time."
      accent="bg-gold-500/10 text-gold-400"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
        </svg>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="dist-payment-token" className="label">Payment token contract</label>
          <input
            id="dist-payment-token"
            value={paymentToken}
            onChange={(e) => setPaymentToken(e.target.value)}
            placeholder="C… (SAC or Soroban token contract)"
            disabled={tx.pending}
            className="input font-mono text-xs"
            spellCheck={false}
          />
          <p className="mt-1 text-[11px] text-base-100/40">
            This is the token used to pay holders — typically a stablecoin or XLM SAC.
          </p>
        </div>
        <div>
          <label htmlFor="dist-total" className="label">Total pool amount</label>
          <div className="relative">
            <input
              id="dist-total"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.0000000"
              inputMode="decimal"
              disabled={tx.pending}
              className="input pr-16"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/40">
              tokens
            </span>
          </div>
          <p className="mt-1 text-[11px] text-base-100/40">
            Uses {PAYMENT_TOKEN_DECIMALS} decimals (Stellar standard).
          </p>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button type="submit" disabled={tx.pending} className="btn-primary">
            Create distribution
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            onDismiss={tx.reset}
            successMessage="Distribution created. Holders can now claim their share."
          />
        )}
      </form>
    </ActionCard>
  );
}

// ---- Existing distributions ----

function ExistingDistributionsCard({ tokenContract }: { tokenContract: string }) {
  const { data, loading, error, refetch } = useDividends(tokenContract);
  const distributions = data ?? [];

  return (
    <ActionCard
      title="Distribution history"
      description="All distributions created for this asset and their claim progress."
      accent="bg-brand-500/10 text-brand-400"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z" rx="2" />
          <path d="M3 9h18M9 21V9" strokeLinecap="round" />
        </svg>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-base-100/40">
          <Spinner size={14} /> Loading distributions…
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load distributions"
          message={error}
          onRetry={refetch}
          className="py-6"
        />
      ) : distributions.length === 0 ? (
        <EmptyState
          title="No distributions yet"
          description="Create your first distribution above."
          className="py-8 border-0 bg-transparent"
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {distributions.map((d) => {
            const pct = percent(d.distributed, d.totalAmount);
            return (
              <li key={d.id.toString()} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-base-100">
                        Distribution #{d.id.toString()}
                      </span>
                      {d.completed ? (
                        <span className="chip border border-brand-500/25 bg-brand-500/10 text-brand-300 text-[10px]">Complete</span>
                      ) : (
                        <span className="chip border border-gold-500/25 bg-gold-500/10 text-gold-300 text-[10px]">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-base-100/40">
                      Payment token: {truncateAddress(d.paymentToken)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold-300">
                      {formatTokenAmount(d.totalAmount, PAYMENT_TOKEN_DECIMALS)}
                    </p>
                    <p className="text-[11px] text-base-100/40">{pct.toFixed(1)}% claimed</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ActionCard>
  );
}
