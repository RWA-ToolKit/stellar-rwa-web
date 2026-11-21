"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import type { Network } from "@/types";
import { assetToken, contractIds, dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useAsync } from "@/hooks/useAsync";
import { useWallet } from "@/hooks/useWallet";
import { getLatestLedger } from "@/lib/stellar";
import { useDividends } from "@/hooks/useDividends";
import { fetchOnChainHolders, useHolders, type Holder } from "@/hooks/useHolders";
import { parseTokenAmount, formatTokenAmount, truncateAddress } from "@/lib/format";
import { arg } from "@/lib/stellar";
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

// Leave room for the rest of the transaction envelope and its auth data.
const MAX_SNAPSHOT_XDR_BYTES = 48 * 1024;

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
        complianceContract={asset.metadata.complianceContract}
        assetDecimals={asset.metadata.decimals}
        assetSymbol={asset.metadata.symbol}
        {...(onCreated !== undefined ? { onCreated } : {})}
        isAdmin={isAdmin}
      />
      <ExistingDistributionsCard tokenContract={asset.tokenContract} isAdmin={isAdmin} />
    </div>
  );
}

// ---- Create distribution ----

function sameHolderSnapshot(left: Holder[], right: Holder[]): boolean {
  if (left.length !== right.length) return false;
  const balancesByAddress = new Map(left.map(({ address, balance }) => [address, balance]));
  return right.every(
    ({ address, balance }) => balancesByAddress.get(address) === balance,
  );
}

function CreateDistributionCard({
  tokenContract,
  complianceContract,
  assetDecimals,
  assetSymbol,
  onCreated,
  isAdmin = true,
}: {
  tokenContract: string;
  complianceContract: string;
  assetDecimals: number;
  assetSymbol: string;
  onCreated?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const { address, network } = useWallet();
  const [paymentToken, setPaymentToken] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [claimDeadline, setClaimDeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [refreshedSnapshot, setRefreshedSnapshot] = useState<{
    key: string;
    holders: Holder[];
  } | null>(null);
  const holderState = useHolders(complianceContract, tokenContract);
  const snapshotKey = `${complianceContract}:${tokenContract}`;
  const holderSnapshot =
    refreshedSnapshot?.key === snapshotKey
      ? refreshedSnapshot.holders
      : holderState.data;
  const snapshotTotal = (holderSnapshot ?? []).reduce(
    (total, holder) => total + holder.balance,
    0n,
  );

  // Only fetch when the input looks like a valid contract address.
  const isValidPt =
    paymentToken.trim().length > 0 &&
    (StrKey.isValidContract(paymentToken.trim()) ||
      StrKey.isValidEd25519PublicKey(paymentToken.trim()));

  // #293: Show the issuer's balance in the payment token before they submit.
  const { data: balanceData, loading: balanceLoading } = useAsync(
    async () => ({
      token: paymentToken.trim(),
      amount: await assetToken.balance(network, paymentToken.trim(), address!),
    }),
    [network, paymentToken, address],
    isValidPt && !!address,
  );
  const balance = balanceData?.token === paymentToken.trim() ? balanceData.amount : null;

  // #293: Show how much the dividend contract is already approved to pull.
  // Issuers need to approve at least totalAmount before the distribution can be funded.
  const dividendContractId = contractIds(network).dividend;
  const { data: allowanceData, loading: allowanceLoading } = useAsync(
    async () => ({
      token: paymentToken.trim(),
      amount: await assetToken.allowance(network, paymentToken.trim(), address!, dividendContractId),
    }),
    [network, paymentToken, address, dividendContractId],
    isValidPt && !!address,
  );
  const allowance = allowanceData?.token === paymentToken.trim() ? allowanceData.amount : null;

  const { data: decimalsData, loading: decimalsLoading, error: decimalsError } = useAsync(
    async () => ({
      token: paymentToken.trim(),
      decimals: await assetToken.decimals(network, paymentToken.trim()),
    }),
    [network, paymentToken],
    isValidPt,
  );
  const paymentTokenDecimals =
    decimalsData?.token === paymentToken.trim() ? decimalsData.decimals : null;

  // Parse the requested amount for comparison (best-effort; errors handled on submit).
  let requestedRaw: bigint | null = null;
  try {
    if (totalAmount.trim() && paymentTokenDecimals !== null) {
      requestedRaw = parseTokenAmount(totalAmount, paymentTokenDecimals);
    }
  } catch {
    // handled at submit time
  }

  const insufficientBalance = balance !== null && requestedRaw !== null && requestedRaw > balance;
  const needsApproval = allowance !== null && requestedRaw !== null && requestedRaw > allowance;

  // Submit-time errors are attributed to the field they concern.
  const tokenInvalid = !!formError && /payment token/i.test(formError);
  const totalFormInvalid = !!formError && !tokenInvalid;
  const totalInvalid = insufficientBalance || totalFormInvalid;
  const totalErrorIds =
    [
      totalFormInvalid && "dist-form-error",
      (insufficientBalance || needsApproval) && "dist-total-error",
    ]
      .filter(Boolean)
      .join(" ") || undefined;

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
      const decimals = await assetToken.decimals(network, pt);
      raw = parseTokenAmount(totalAmount, decimals);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }

    if (raw <= 0n) {
      setFormError("Total amount must be greater than zero.");
      return;
    }

    const deadline = Math.floor(new Date(claimDeadline).getTime() / 1000);
    if (!claimDeadline || Number.isNaN(deadline) || deadline <= Math.floor(Date.now() / 1000)) {
      setFormError("Claim deadline must be in the future.");
      return;
    }

    const holders = holderSnapshot ?? [];
    if (holders.length === 0) {
      setFormError("No eligible holders found for this asset.");
      return;
    }

    const snapshotXdr = JSON.stringify(
      holders.map(({ address: holderAddress, balance: holderBalance }) => ({
        address: holderAddress,
        balance: holderBalance.toString(),
      })),
    );
    if (snapshotXdr.length > MAX_SNAPSHOT_XDR_BYTES) {
      setFormError("Holder snapshot is too large to submit in a single transaction.");
      return;
    }

    const ok = await tx.run(() =>
      dividend.createDistribution(network, {
        token: tokenContract,
        paymentToken: pt,
        totalAmount: raw,
        claimDeadline: deadline,
        holders: holders.map(({ address: holderAddress, balance: holderBalance }) => ({
          address: holderAddress,
          balance: holderBalance,
        })),
      }),
    );
    if (ok) {
      setPaymentToken("");
      setTotalAmount("");
      setClaimDeadline("");
      onCreated?.();
    }
  }

  async function refreshSnapshot() {
    setSnapshotRefreshing(true);
    try {
      const holders = await fetchOnChainHolders(network, complianceContract, tokenContract);
      setRefreshedSnapshot({ key: snapshotKey, holders });
    } finally {
      setSnapshotRefreshing(false);
    }
  }

  const knownTokens = KNOWN_TOKENS[network] ?? [];

  return (
    <ActionCard
      title="Create distribution"
      description="Snapshot eligible holders and fund a new dividend distribution."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="dist-payment-token" className="mb-1 block text-sm font-medium text-base-100/80">
            Payment token
          </label>
          <input
            id="dist-payment-token"
            value={paymentToken}
            onChange={(e) => setPaymentToken(e.target.value)}
            placeholder="C…"
            aria-invalid={tokenInvalid}
            aria-describedby={tokenInvalid ? "dist-form-error" : undefined}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-base-100 placeholder:text-base-100/30 focus:border-brand-400 focus:outline-none"
          />
          {knownTokens.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {knownTokens.map((token) => (
                <button
                  key={token.contractId}
                  type="button"
                  onClick={() => setPaymentToken(token.contractId)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-base-100/70 hover:border-brand-400 hover:text-base-100"
                >
                  {token.label}
                </button>
              ))}
            </div>
          )}
          {isValidPt && (
            <p className="mt-1 text-xs text-base-100/50">
              {balanceLoading || allowanceLoading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  Balance: {balance !== null ? formatTokenAmount(balance, paymentTokenDecimals ?? 7) : "—"}
                  {" · "}
                  Approved: {allowance !== null ? formatTokenAmount(allowance, paymentTokenDecimals ?? 7) : "—"}
                </>
              )}
            </p>
          )}
          {decimalsError && (
            <p className="mt-1 text-xs text-red-400">Could not read token decimals.</p>
          )}
        </div>

        <div>
          <label htmlFor="dist-total" className="mb-1 block text-sm font-medium text-base-100/80">
            Total amount ({assetSymbol})
          </label>
          <input
            id="dist-total"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            aria-invalid={totalInvalid}
            aria-describedby={totalErrorIds}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-base-100 placeholder:text-base-100/30 focus:border-brand-400 focus:outline-none"
          />
          {insufficientBalance && (
            <p id="dist-total-error" className="mt-1 text-xs text-red-400">
              Amount exceeds your payment-token balance.
            </p>
          )}
          {needsApproval && !insufficientBalance && (
            <p id="dist-total-error" className="mt-1 text-xs text-amber-400">
              You must approve at least this amount before funding.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="dist-deadline" className="mb-1 block text-sm font-medium text-base-100/80">
            Claim deadline
          </label>
          <input
            id="dist-deadline"
            type="datetime-local"
            value={claimDeadline}
            onChange={(e) => setClaimDeadline(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-base-100 focus:border-brand-400 focus:outline-none"
          />
        </div>

        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-base-100/50">
          {holderState.loading || snapshotRefreshing ? (
            <Spinner size="sm" />
          ) : (
            <>
              {holderSnapshot?.length ?? 0} eligible holders · total balance{" "}
              {formatTokenAmount(snapshotTotal, assetDecimals)} {assetSymbol}
            </>
          )}
          <button
            type="button"
            onClick={refreshSnapshot}
            disabled={snapshotRefreshing}
            className="ml-2 underline hover:text-base-100 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {formError && (
          <p id="dist-form-error" className="text-xs text-red-400">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={tx.status === "pending" || !isAdmin}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50"
        >
          {tx.status === "pending" ? "Creating…" : "Create distribution"}
        </button>
        <TxProgress status={tx.status} error={tx.error} hash={tx.hash} />
      </form>
    </ActionCard>
  );
}

// ---- Existing distributions ----

function ExistingDistributionsCard({
  tokenContract,
  isAdmin = true,
}: {
  tokenContract: string;
  isAdmin?: boolean;
}) {
  const { address, network } = useWallet();
  const { data: distributions, loading, error, refetch } = useDividends(tokenContract);
  const { data: latestLedger } = useAsync(
    () => getLatestLedger(network),
    [network],
  );

  if (loading) {
    return (
      <ActionCard title="Distributions" description="Existing dividend distributions for this asset.">
        <Spinner />
      </ActionCard>
    );
  }

  if (error) {
    return (
      <ActionCard title="Distributions" description="Existing dividend distributions for this asset.">
        <ErrorState message={error} onRetry={refetch} />
      </ActionCard>
    );
  }

  if (!distributions || distributions.length === 0) {
    return (
      <ActionCard title="Distributions" description="Existing dividend distributions for this asset.">
        <EmptyState title="No distributions yet" description="Create one above to get started." />
      </ActionCard>
    );
  }

  return (
    <ActionCard title="Distributions" description="Existing dividend distributions for this asset.">
      <ul className="space-y-3">
        {distributions.map((distribution) => (
          <DistributionRow
            key={distribution.id}
            distribution={distribution}
            latestLedger={latestLedger ?? null}
            isAdmin={isAdmin}
            walletAddress={address ?? null}
            onChanged={refetch}
          />
        ))}
      </ul>
    </ActionCard>
  );
}

function DistributionRow({
  distribution,
  latestLedger,
  isAdmin,
  walletAddress,
  onChanged,
}: {
  distribution: {
    id: string;
    totalAmount: bigint;
    claimedAmount: bigint;
    claimDeadline: number;
    issuer?: string;
  };
  latestLedger: number | null;
  isAdmin: boolean;
  walletAddress: string | null;
  onChanged: () => void;
}) {
  const tx = useTx();
  const { network } = useWallet();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const deadlinePassed = distribution.claimDeadline > 0 && nowSeconds >= distribution.claimDeadline;
  const unclaimed = distribution.totalAmount - distribution.claimedAmount;
  const isIssuer =
    !!walletAddress &&
    !!distribution.issuer &&
    walletAddress === distribution.issuer;
  const canReclaim = isAdmin && isIssuer && deadlinePassed && unclaimed > 0n;

  async function onReclaim() {
    const ok = await tx.run(() =>
      dividend.reclaimUnclaimed(network, distribution.id),
    );
    if (ok) onChanged();
  }

  return (
    <li className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-base-100/80">
          <span className="font-mono text-xs text-base-100/50">{truncateAddress(distribution.id)}</span>
          {" · "}
          {formatTokenAmount(distribution.claimedAmount, 7)} / {formatTokenAmount(distribution.totalAmount, 7)} claimed
        </div>
        <span className="text-xs text-base-100/50">
          {deadlinePassed ? "Deadline passed" : "Open"}
        </span>
      </div>
      {canReclaim && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onReclaim}
            disabled={tx.status === "pending"}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-base-100/80 hover:border-brand-400 hover:text-base-100 disabled:opacity-50"
          >
            {tx.status === "pending" ? "Reclaiming…" : "Reclaim unclaimed funds"}
          </button>
          <TxProgress status={tx.status} error={tx.error} hash={tx.hash} />
        </div>
      )}
    </li>
  );
}
