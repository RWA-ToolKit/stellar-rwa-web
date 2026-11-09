"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { assetToken, compliance } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { parseTokenAmount, formatTokenAmount, formatRawPlain } from "@/lib/format";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface TokenPanelProps {
  asset: AssetDetail;
  onMinted?: () => void;
  onTransferred?: () => void;
  onPauseToggled?: () => void;
  isAdmin?: boolean;
}

/** Mint tokens to an address, distribute batch transfers, and pause / unpause the token contract. */
export function TokenPanel({
  asset,
  onMinted,
  onTransferred,
  onPauseToggled,
  isAdmin = true,
}: TokenPanelProps) {
  const { metadata, tokenContract } = asset;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-base-100/50">
        <strong>Required role:</strong> asset-token <code className="font-mono text-base-100/60">admin</code>
      </div>
      <MintCard
        tokenContract={tokenContract}
        metadata={metadata}
        {...(onMinted !== undefined ? { onMinted } : {})}
        isAdmin={isAdmin}
      />
      <BatchTransferCard
        tokenContract={tokenContract}
        metadata={metadata}
        {...(onTransferred !== undefined
          ? { onTransferred }
          : onMinted !== undefined
            ? { onTransferred: onMinted }
            : {})}
        isAdmin={isAdmin}
      />
      <PauseCard
        tokenContract={tokenContract}
        paused={metadata.paused}
        {...(onPauseToggled !== undefined ? { onToggled: onPauseToggled } : {})}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// ---- Mint ----

/**
 * Threshold for requiring confirmation on large mint amounts.
 * Mints that would increase supply by more than 50% of current supply require
 * an extra confirmation step to prevent accidental supply inflation.
 */
const LARGE_MINT_THRESHOLD_PERCENT = 50;

function MintCard({
  tokenContract,
  metadata,
  onMinted,
  isAdmin = true,
}: {
  tokenContract: string;
  metadata: AssetDetail["metadata"];
  onMinted?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMint, setPendingMint] = useState<{ recipient: string; raw: bigint } | null>(null);

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

    // Check if this is a large mint that requires confirmation
    if (
      raw * 100n >
      metadata.totalSupply * BigInt(LARGE_MINT_THRESHOLD_PERCENT)
    ) {
      setPendingMint({ recipient, raw });
      setConfirmOpen(true);
      return;
    }

    // Otherwise, mint directly
    await executeMint(recipient, raw);
  }

  async function executeMint(recipient: string, raw: bigint) {
    const res = await tx.run((ctx) =>
      assetToken.mint(ctx, tokenContract, recipient, raw),
    );
    if (res) {
      setTo("");
      setAmount("");
      setPendingMint(null);
      onMinted?.();
    }
  }

  function handleConfirmLargeMint() {
    setConfirmOpen(false);
    if (pendingMint) {
      void executeMint(pendingMint.recipient, pendingMint.raw);
    }
  }

  function handleCancelMint() {
    setConfirmOpen(false);
    setPendingMint(null);
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen && !!pendingMint}
        title="Confirm large mint?"
        description={
          pendingMint
            ? `You're minting ${formatTokenAmount(pendingMint.raw, metadata.decimals)} ${
                metadata.symbol
              } (${formatRawPlain(pendingMint.raw, metadata.decimals)} raw). This will increase total supply from ${formatTokenAmount(
                metadata.totalSupply,
                metadata.decimals,
              )} by more than ${LARGE_MINT_THRESHOLD_PERCENT}%. Are you sure this is correct?`
            : ""
        }
        confirmLabel="Yes, mint these tokens"
        onConfirm={handleConfirmLargeMint}
        onCancel={handleCancelMint}
      />

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
      {/* #294: warn the issuer when the token is paused so mint attempts don't silently fail */}
      {metadata.paused && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90"
        >
          This token is currently paused. Minting will likely fail until the token is
          unpaused below.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="mint-to" className="label">Recipient address</label>
          <input
            id="mint-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G… or C…"
            disabled={tx.pending || !isAdmin}
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
              disabled={tx.pending || !isAdmin}
              className="input pr-20"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/55">
              {metadata.symbol}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-base-100/55">
            Current supply: {formatTokenAmount(metadata.totalSupply, metadata.decimals)} {metadata.symbol}
          </p>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button
            type="submit"
            disabled={tx.pending || !isAdmin}
            className="btn-primary"
            title={!isAdmin ? "Only the asset admin can mint tokens" : ""}
          >
            Mint
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            errorType={tx.errorType}
            onDismiss={tx.reset}
            onRetry={tx.retry}
            retryable={tx.retryable}
            successMessage="Tokens minted successfully."
          />
        )}
      </form>
      </ActionCard>
    </>
  );
}

// ---- Batch Transfer (#580) ----

interface BatchRow {
  to: string;
  quantity: string;
}

function parseCsvRows(csv: string): BatchRow[] {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [to = "", quantity = ""] = line.split(/[,\t;]+/).map((part) => part.trim());
      return { to, quantity };
    });
}

function BatchTransferCard({
  tokenContract,
  metadata,
  onTransferred,
  isAdmin = true,
}: {
  tokenContract: string;
  metadata: AssetDetail["metadata"];
  onTransferred?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const [rows, setRows] = useState<BatchRow[]>([
    { to: "", quantity: "" },
    { to: "", quantity: "" },
  ]);
  const [csvText, setCsvText] = useState("");
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<BatchRow>) {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { to: "", quantity: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (metadata.paused) {
      setFormError("Transfers are paused by the issuer for this asset.");
      return;
    }

    const activeRows =
      csvText.trim().length > 0
        ? parseCsvRows(csvText)
        : rows.filter((r) => r.to.trim() !== "" || r.quantity.trim() !== "");

    if (activeRows.length === 0) {
      setFormError("Enter at least one destination wallet and token quantity.");
      return;
    }

    const parsed: [string, bigint][] = [];
    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i]!;
      const dest = row.to.trim();
      if (!StrKey.isValidEd25519PublicKey(dest) && !StrKey.isValidContract(dest)) {
        setFormError(`Row ${i + 1}: Enter a valid Stellar address (G… or C…).`);
        return;
      }
      let raw: bigint;
      try {
        raw = parseTokenAmount(row.quantity.trim(), metadata.decimals);
      } catch (err) {
        setFormError(
          `Row ${i + 1}: ${err instanceof Error ? err.message : "Invalid quantity."}`,
        );
        return;
      }
      if (raw <= 0n) {
        setFormError(`Row ${i + 1}: Quantity must be greater than zero.`);
        return;
      }
      parsed.push([dest, raw]);
    }

    // Validate compliance per recipient before submitting the batch transaction (#580)
    if (compliance?.isAllowed) {
      setCheckingCompliance(true);
      try {
        const results = await Promise.all(
          parsed.map(([dest]) =>
            compliance.isAllowed("testnet", metadata.complianceContract, dest),
          ),
        );
        const failedIdx = results.findIndex((allowed) => !allowed);
        if (failedIdx !== -1) {
          const failedAddr = parsed[failedIdx]![0];
          setFormError(
            `Row ${failedIdx + 1} (${failedAddr}): Recipient isn't KYC-approved for this asset and can't receive a transfer.`,
          );
          return;
        }
      } catch (err) {
        setFormError(
          err instanceof Error
            ? `Failed to verify recipient compliance: ${err.message}`
            : "Failed to verify recipient compliance.",
        );
        return;
      } finally {
        setCheckingCompliance(false);
      }
    }

    const res = await tx.run((ctx) =>
      assetToken.transferBatch(ctx, tokenContract, parsed),
    );
    if (res) {
      setRows([
        { to: "", quantity: "" },
        { to: "", quantity: "" },
      ]);
      setCsvText("");
      onTransferred?.();
    }
  }

  return (
    <ActionCard
      title="Batch transfer"
      description="Distribute tokens to multiple KYC-approved recipients in a single transaction."
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 8l4 4-4 4M3 12h18M7 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                aria-label={`Destination wallet ${index + 1}`}
                value={row.to}
                onChange={(e) => updateRow(index, { to: e.target.value })}
                placeholder="G… or C…"
                disabled={tx.pending || checkingCompliance || !isAdmin}
                className="input flex-1 font-mono text-xs"
                spellCheck={false}
              />
              <input
                aria-label={`Token quantity ${index + 1}`}
                value={row.quantity}
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
                placeholder="0.00"
                inputMode="decimal"
                disabled={tx.pending || checkingCompliance || !isAdmin}
                className="input w-32 text-xs"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={tx.pending || checkingCompliance || !isAdmin}
                  aria-label={`Remove row ${index + 1}`}
                  className="btn-secondary px-2 py-1 text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            disabled={tx.pending || checkingCompliance || !isAdmin}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            + Add row
          </button>
        </div>

        <div>
          <label htmlFor="batch-transfer-csv" className="label">
            Or paste CSV lines (address,quantity)
          </label>
          <textarea
            id="batch-transfer-csv"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"GALICE...,100\nGBOB...,250"}
            rows={2}
            disabled={tx.pending || checkingCompliance || !isAdmin}
            className="input font-mono text-xs"
            spellCheck={false}
          />
        </div>

        {formError && (
          <p role="alert" className="text-xs text-red-400">
            {formError}
          </p>
        )}

        {tx.phase === "idle" ? (
          <button
            type="submit"
            disabled={tx.pending || checkingCompliance || !isAdmin}
            className="btn-primary"
          >
            {checkingCompliance ? "Checking compliance…" : "Submit batch transfer"}
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            errorType={tx.errorType}
            onDismiss={tx.reset}
            onRetry={tx.retry}
            retryable={tx.retryable}
            successMessage="Batch transfer completed."
          />
        )}
      </form>
    </ActionCard>
  );
}

// ---- Pause / Unpause ----

interface AssetMetadata {
  name?: string;
}

function PauseCard({
  tokenContract,
  paused,
  onToggled,
  isAdmin = true,
}: {
  tokenContract: string;
  paused: boolean;
  onToggled?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestToggle() {
    setConfirmOpen(true);
  }

  async function doToggle() {
    setConfirmOpen(false);
    const res = await tx.run((ctx) =>
      paused
        ? assetToken.unpause(ctx, tokenContract)
        : assetToken.pause(ctx, tokenContract),
    );
    if (res) onToggled?.();
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title={paused ? "Unpause transfers?" : "Pause all transfers?"}
        description={
          paused
            ? "This will re-enable all token transfers. Existing holders will be able to send or receive this asset again. Are you sure?"
            : "This will immediately stop all token transfers. Existing holders won't be able to send or receive this asset until you unpause it. Are you sure you want to continue?"
        }
        confirmLabel={paused ? "Yes, unpause transfers" : "Yes, pause transfers"}
        onConfirm={doToggle}
        onCancel={() => setConfirmOpen(false)}
      />

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
            onClick={requestToggle}
            disabled={tx.pending || !isAdmin}
            className={paused ? "btn-primary" : "btn-secondary"}
            title={!isAdmin ? "Only the asset admin can control pausing" : ""}
          >
            {paused ? "Unpause transfers" : "Pause transfers"}
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            errorType={tx.errorType}
            onDismiss={tx.reset}
            onRetry={tx.retry}
            retryable={tx.retryable}
            successMessage={paused ? "Token unpaused." : "Token paused."}
          />
        )}
      </ActionCard>
    </>
  );
}
