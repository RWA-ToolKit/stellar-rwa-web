"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import type { Network } from "@/types";
import { assetToken, contractIds, dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useAsync } from "@/hooks/useAsync";
import { useWallet } from "@/hooks/useWallet";
import { useDividends } from "@/hooks/useDividends";
import { parseTokenAmount, formatTokenAmount, truncateAddress } from "@/lib/format";
import { PAYMENT_TOKEN_DECIMALS } from "@/components/dividend/ClaimButton";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { percent } from "@/lib/format";

// ---- Known-token presets (#323) ----
//
// Issuers most commonly pay dividends in the native XLM Stellar Asset Contract
// (SAC) or in a USDC-equivalent stablecoin. Hard-coding the well-known
// testnet/mainnet contract IDs here lets the form surface a one-click shortcut
// so the issuer doesn't have to find and paste the address manually.
//
// The XLM SAC is deterministic: on testnet it is the SEP-41 wrapper for the
// native XLM asset deployed by the Stellar Development Foundation.
// Sources:
//   Testnet  – https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN4
//   Mainnet  – https://stellar.expert/explorer/public/contract/CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA

interface KnownToken {
  label: string;
  symbol: string;
  contractId: string;
}

const KNOWN_TOKENS: Record<Network, KnownToken[]> = {
  testnet: [
    {
      label: "Native XLM (SAC)",
      symbol: "XLM",
      contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN4",
    },
  ],
  mainnet: [
    {
      label: "Native XLM (SAC)",
      symbol: "XLM",
      contractId: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    },
  ],
};

interface DistributionPanelProps {
  asset: AssetDetail;
  onCreated?: () => void;
  isAdmin?: boolean;
}

/** Create new dividend distributions and view existing ones for the asset. */
export function DistributionPanel({ asset, onCreated, isAdmin = true }: DistributionPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-base-100/50">
        <strong>Required role:</strong> dividend contract caller must be registered issuer for this asset
      </div>
      <CreateDistributionCard
        tokenContract={asset.tokenContract}
        onCreated={onCreated}
        isAdmin={isAdmin}
      />
      <ExistingDistributionsCard tokenContract={asset.tokenContract} />
    </div>
  );
}

// ---- Create distribution ----

function CreateDistributionCard({
  tokenContract,
  onCreated,
  isAdmin = true,
}: {
  tokenContract: string;
  onCreated?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const { address, network } = useWallet();
  const [paymentToken, setPaymentToken] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Only fetch when the input looks like a valid contract address.
  const isValidPt =
    paymentToken.trim().length > 0 &&
    (StrKey.isValidContract(paymentToken.trim()) ||
      StrKey.isValidEd25519PublicKey(paymentToken.trim()));

  // #293: Show the issuer's balance in the payment token before they submit.
  const { data: balance, loading: balanceLoading } = useAsync(
    () => assetToken.balance(network, paymentToken.trim(), address!),
    [network, paymentToken, address],
    isValidPt && !!address,
  );

  // #293: Show how much the dividend contract is already approved to pull.
  // Issuers need to approve at least totalAmount before the distribution can be funded.
  const dividendContractId = contractIds(network).dividend;
  const { data: allowance, loading: allowanceLoading } = useAsync(
    () => assetToken.allowance(network, paymentToken.trim(), address!, dividendContractId),
    [network, paymentToken, address, dividendContractId],
    isValidPt && !!address,
  );

  // Parse the requested amount for comparison (best-effort; errors handled on submit).
  let requestedRaw: bigint | null = null;
  try {
    if (totalAmount.trim()) requestedRaw = parseTokenAmount(totalAmount, PAYMENT_TOKEN_DECIMALS);
  } catch {
    // handled at submit time
  }

  const insufficientBalance = balance !== null && requestedRaw !== null && requestedRaw > balance;
  const needsApproval = allowance !== null && requestedRaw !== null && requestedRaw > allowance;

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
    if (allowance !== null && raw > allowance) {
      setFormError("The dividend contract allowance is insufficient. Approve it to spend at least the requested amount before creating this distribution.");
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
            disabled={tx.pending || !isAdmin}
            className="input font-mono text-xs"
            spellCheck={false}
          />
          <p className="mt-1 text-[11px] text-base-100/40">
            This is the token used to pay holders — typically a stablecoin or XLM SAC.
          </p>

          {/* #323: Known-token preset buttons so the issuer doesn't have to paste
              the XLM SAC address (or other well-known tokens) manually. */}
          {KNOWN_TOKENS[network] && KNOWN_TOKENS[network].length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-base-100/30">Presets:</span>
              {KNOWN_TOKENS[network].map((token) => (
                <button
                  key={token.contractId}
                  type="button"
                  disabled={tx.pending}
                  onClick={() => setPaymentToken(token.contractId)}
                  aria-label={`Use ${token.label} (${token.contractId})`}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    paymentToken.trim() === token.contractId
                      ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                      : "border-white/10 bg-white/[0.04] text-base-100/50 hover:border-white/20 hover:text-base-100/80",
                  ].join(" ")}
                >
                  <span>{token.symbol}</span>
                  <span className="text-base-100/30">·</span>
                  <span>{token.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* #293: surface balance + allowance so the issuer knows before submitting */}
        {isValidPt && address && (
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base-100/50">Your balance</span>
              {balanceLoading ? (
                <Spinner size={10} />
              ) : balance !== null ? (
                <span className={insufficientBalance ? "font-semibold text-red-400" : "text-base-100/80"}>
                  {formatTokenAmount(balance, PAYMENT_TOKEN_DECIMALS)}
                </span>
              ) : (
                <span className="text-base-100/30">—</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base-100/50">Dividend contract allowance</span>
              {allowanceLoading ? (
                <Spinner size={10} />
              ) : allowance !== null ? (
                <span className={needsApproval ? "font-semibold text-amber-400" : "text-base-100/80"}>
                  {formatTokenAmount(allowance, PAYMENT_TOKEN_DECIMALS)}
                </span>
              ) : (
                <span className="text-base-100/30">—</span>
              )}
            </div>
          </div>
        )}

        {insufficientBalance && (
          <p role="alert" className="text-xs text-red-400">
            Insufficient balance — your wallet holds less than the requested distribution amount.
          </p>
        )}
        {needsApproval && (
          <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            The dividend contract is not approved to spend enough of this token on your behalf.
            Creating this distribution is blocked until you submit an{" "}
            <strong className="font-semibold">approve</strong> transaction for at least{" "}
            {formatTokenAmount(requestedRaw ?? 0n, PAYMENT_TOKEN_DECIMALS)} tokens before funding
            this distribution.
          </p>
        )}

        <div>
          <label htmlFor="dist-total" className="label">Total pool amount</label>
          <div className="relative">
            <input
              id="dist-total"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.0000000"
              inputMode="decimal"
              disabled={tx.pending || !isAdmin}
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
          <button
            type="submit"
            disabled={tx.pending || !isAdmin || needsApproval}
            className="btn-primary"
            title={
              !isAdmin
                ? "Only the asset admin can create distributions"
                : needsApproval
                  ? "Approve the dividend contract before creating this distribution"
                  : ""
            }
          >
            Create distribution
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            errorType={tx.errorType}
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
