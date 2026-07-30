"use client";

import { useCallback, useState } from "react";
import type { TxPhase, TxResult, TxTelemetry } from "@/types";
import type { WriteCtx } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { ContractError } from "@/lib/stellar";

interface RunResult {
  phase: TxPhase;
  hash: string | null;
  error: string | null;
  /** True while the transaction is building/signing/submitting/confirming. */
  pending: boolean;
  /**
   * Execute a write. `action` receives a WriteCtx whose onPhase is wired to
   * this hook's phase state. Resolves with the TxResult, or null on failure.
   */
  run: (action: (ctx: WriteCtx) => Promise<TxResult>) => Promise<TxResult | null>;
  reset: () => void;
}

/**
 * Optional telemetry defaults — no-ops when not provided by the consumer.
 * Assign to `window.__rwaTxTelemetry` or pass via `useTx(telemetry)`.
 */
const noopTelemetry: TxTelemetry = {};

/**
 * Drives a single on-chain write: tracks phase (building → signing →
 * submitting → confirming → success/error) so the UI can show progress, and
 * exposes the resulting hash. Errors are captured as friendly messages.
 *
 * @param telemetry Optional lifecycle callbacks for product analytics or error
 * monitoring (e.g. Sentry). Each phase change, success and error emit to the
 * provided callbacks without blocking the transaction flow.
 */
export function useTx(telemetry?: TxTelemetry): RunResult {
  const { writeCtx } = useWallet();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = telemetry ?? noopTelemetry;

  const reset = useCallback(() => {
    setPhase("idle");
    setHash(null);
    setError(null);
  }, []);

  const run = useCallback(
    async (action: (ctx: WriteCtx) => Promise<TxResult>) => {
      setError(null);
      setHash(null);
      setPhase("building");
      t.onPhase?.("building");
      try {
        const ctx = writeCtx((p) => {
          setPhase(p);
          t.onPhase?.(p);
        });
        const result = await action(ctx);
        setHash(result.hash);
        setPhase("success");
        t.onPhase?.("success");
        t.onSuccess?.(result.hash, result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transaction failed.";
        if (e instanceof ContractError && e.detail) {
          console.error("Transaction failed:", e.detail);
        }
        setError(msg);
        setPhase("error");
        t.onPhase?.("error", msg);
        t.onError?.(msg, "error");
        return null;
      }
    },
    [writeCtx, t],
  );

  return {
    phase,
    hash,
    error,
    pending: phase === "building" || phase === "signing" || phase === "submitting" || phase === "confirming",
    run,
    reset,
  };
}
