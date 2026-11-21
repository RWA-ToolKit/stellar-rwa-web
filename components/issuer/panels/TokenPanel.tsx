"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { assetToken } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { parseTokenAmount, formatTokenAmount, formatRawPlain } from "@/lib/format";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface TokenPanelProps {
  asset: AssetDetail;
  onMinted?: () => void;
  onPauseToggled?: () => void;
  isAdmin?: boolean;
}

/** Mint tokens to an address, and pause / unpause the token contract. */
export function TokenPanel({ asset, onMinted, onPauseToggled, isAdmin = true }: TokenPanelProps) {
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
        {...(onMinted !== undefined ? { onMinted } : {})}
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

// ---- Batch transfer ----

interface BatchRow {
  recipient: string;
  amount: string;
}

/**
 * Parse a CSV blob of `recipient,amount` lines into batch rows.
 * Blank lines and a leading `recipient,amount` header are ignored.
 */
function parseBatchCsv(text: string): BatchRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line, i) => !(i === 0 && /^recipient\s*,\s*amount$/i.test(line)))
    .map((line) => {
      const [recipient = "", amount = ""] = line.split(",").map((p) => p.trim());
      return { recipient, amount };
    });
}

function BatchTransferCard({
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
  const [rows, setRows] = useState<BatchRow[]>([{ recipient: "", amount: "" }]);
  const [csv, setCsv] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { recipient: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function importCsv() {
    setFormError(null);
    const parsed = parseBatchCsv(csv);
    if (parsed.length === 0) {
      setFormError("No rows found in CSV. Use one `recipient,amount` pair per line.");
      return;
    }
    setRows(parsed);
    setCsv("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Compliance validation runs per recipient before submission.
    const recipients: string[] = [];
    const amounts: bigint[] = [];
    for (let i = 0; i < rows.length; i++) {
      const recipient = rows[i]!.recipient.trim();
      const amount = rows[i]!.amount.trim();
      if (!recipient && !amount) continue;
      if (!StrKey.isValidEd25519PublicKey(recipient) && !StrKey.isValidContract(recipient)) {
        setFormError(`Row ${i + 1}: enter a valid Stellar address (G… or C…).`);
        return;
      }
      let raw: bigint;
      try {
        raw = parseTokenAmount(amount, metadata.decimals);
      } catch (err) {
        setFormError(`Row ${i + 1}: ${err instanceof Error ? err.message : "Invalid amount."}`);
        return;
      }
      if (raw <= 0n) {
        setFormError(`Row ${i + 1}: amount must be greater than zero.`);
        return;
      }
      recipients.push(recipient);
      amounts.push(raw);
    }

    if (recipients.length === 0) {
      setFormError("Add at least one recipient and amount.");
      return;
    }

    const res = await tx.run((ctx) =>
      assetToken.transferBatch(ctx, tokenContract, recipients, amounts),
    );
    if (res) {
      setRows([{ recipient: "", amount: "" }]);
      onMinted?.();
    }
  }

  return (
    <ActionCard
      title="Batch transfer"
      description="Send tokens to many recipients in a single transaction."
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      }
    >
      {metadata.paused && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90"
        >
          This token is currently paused. Transfers will likely fail until the token is
          unpaused below.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                value={row.recipient}
                onChange={(e) => updateRow(i, { recipient: e.target.value })}
                placeholder="G… or C…"
                aria-label={`Recipient ${i + 1}`}
                disabled={tx.pending || !isAdmin}
                className="input flex-1 font-mono text-xs"
                spellCheck={false}
              />
              <div className="relative w-40">
                <input
                  value={row.amount}
                  onChange={(e) => updateRow(i, { amount: e.target.value })}
                  placeholder="0.00"
                  aria-label={`Amount ${i + 1}`}
                  inputMode="decimal"
                  disabled={tx.pending || !isAdmin}
                  className="input pr-16"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/55">
                  {metadata.symbol}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={tx.pending || !isAdmin || rows.length <= 1}
                className="btn-ghost px-2"
                aria-label={`Remove row ${i + 1}`}
                title="Remove row"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={tx.pending || !isAdmin}
          className="btn-ghost text-xs"
        >
          + Add recipient
        </button>

        <div>
          <label htmlFor="batch-csv" className="label">
            Or paste CSV (recipient,amount per line)
          </label>
          <textarea
            id="batch-csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"G…,100\nG…,250"}
            disabled={tx.pending || !isAdmin}
            className="input h-24 font-mono text-xs"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={importCsv}
            disabled={tx.pending || !isAdmin || csv.trim().length === 0}
            className="btn-ghost mt-2 text-xs"
          >
            Import CSV
          </button>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button
            type="submit"
            disabled={tx.pending || !isAdmin}
            className="btn-primary"
            title={!isAdmin ? "Only the asset admin can transfer tokens" : ""}
          >
            Send batch
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
            successMessage="Batch transfer submitted successfully."
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
    )

/* … truncated 2740 chars — edit only what you need near the top … */
