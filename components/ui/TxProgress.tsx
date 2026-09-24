"use client";

import { useWallet } from "@/hooks/useWallet";
import { explorerTxUrl } from "@/lib/stellar";
import { formatStroopsToXLM } from "@/lib/format";
import type { TxPhase } from "@/types";
import { Spinner } from "./Spinner";

const PHASE_LABEL: Record<Exclude<TxPhase, "idle">, string> = {
  building: "Preparing transaction…",
  signing: "Awaiting signature in Freighter…",
  submitting: "Submitting to the network…",
  confirming: "Confirming on-chain…",
  success: "Confirmed",
  timeout: "Confirmation timed out",
  error: "Transaction failed",
};

interface TxProgressProps {
  phase: TxPhase;
  hash: string | null;
  error: string | null;
  /** Estimated network fee in stroops from simulation. */
  estimatedFee?: bigint | null;
  /** Called when the user dismisses a success/error result. */
  onDismiss?: () => void;
  successMessage?: string;
}

/**
 * Renders the live status of an on-chain action driven by `useTx`: a spinner
 * with the current phase while pending, then a success (with explorer link) or
 * error result. When the phase reaches "signing", displays the estimated fee
 * so the user can review it before approving the transaction.
 */
export function TxProgress({
  phase,
  hash,
  error,
  estimatedFee,
  onDismiss,
  successMessage = "Your transaction is confirmed.",
}: TxProgressProps) {
  const { network } = useWallet();
  if (phase === "idle") return null;

  const pending =
    phase === "building" ||
    phase === "signing" ||
    phase === "submitting" ||
    phase === "confirming";

  if (pending) {
    // Show fee estimate during the signing phase
    const showFeeEstimate = phase === "signing" && estimatedFee !== undefined && estimatedFee !== null;

    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-base-100/80"
      >
        <div className="flex items-center gap-3">
          <Spinner size={18} decorative />
          <span>{PHASE_LABEL[phase]}</span>
        </div>
        {showFeeEstimate && (
          <div className="border-t border-brand-500/10 pt-2 text-xs text-base-100/60">
            <div className="flex items-center justify-between gap-2">
              <span>Estimated fee:</span>
              <code className="font-mono">{formatStroopsToXLM(estimatedFee)}</code>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm"
      >
        <div className="flex items-start gap-2.5 text-red-300">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span>{error ?? "The transaction did not complete."}</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 text-red-300/60 hover:text-red-300" aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>
    );
  }

  // timeout state - visually distinct from error, includes explorer link
  if (phase === "timeout") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start justify-between gap-3 rounded-xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3 text-sm"
      >
        <div className="flex items-start gap-2.5 text-yellow-300">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <div>
            <p>{error ?? "Confirmation timed out."}</p>
            {hash && (
              <a
                href={explorerTxUrl(network, hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-xs text-yellow-400 underline decoration-yellow-400/40 underline-offset-2 hover:decoration-yellow-400"
              >
                Check transaction on Stellar Expert ↗
              </a>
            )}
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 text-yellow-300/60 hover:text-yellow-300" aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>
    );
  }

  // success
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start justify-between gap-3 rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-2.5 text-brand-300">
        <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p>{successMessage}</p>
          {hash && (
            <a
              href={explorerTxUrl(network, hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-xs text-brand-400 underline decoration-brand-400/40 underline-offset-2 hover:decoration-brand-400"
            >
              View on Stellar Expert ↗
            </a>
          )}
        </div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-brand-300/60 hover:text-brand-300" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
