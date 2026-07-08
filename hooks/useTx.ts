"use client";

import { useCallback, useState } from "react";
import type { TxPhase, TxResult } from "@/types";
import type { WriteCtx } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";

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
 * Drives a single on-chain write: tracks phase (building → signing →
 * submitting → confirming → success/error) so the UI can show progress, and
 * exposes the resulting hash. Errors are captured as friendly messages.
 */
export function useTx(): RunResult {
  const { writeCtx } = useWallet();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      try {
        const ctx = writeCtx((p) => setPhase(p));
        const result = await action(ctx);
        setHash(result.hash);
        setPhase("success");
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transaction failed.");
        setPhase("error");
        return null;
      }
    },
    [writeCtx],
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
