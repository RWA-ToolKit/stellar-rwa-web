import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { WriteCtx } from "@/lib/contracts";
import type { TxResult } from "@/types";

const writeCtx = vi.fn();

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ writeCtx }),
}));

import { useTx } from "@/hooks/useTx";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("initial state", () => {
  it("starts idle, not pending, with no hash or error", () => {
    const { result } = renderHook(() => useTx());
    expect(result.current.phase).toBe("idle");
    expect(result.current.pending).toBe(false);
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe("run", () => {
  it("progresses building -> signing -> submitting -> confirming -> success, deriving pending along the way, and stores the hash", async () => {
    writeCtx.mockImplementation((onPhase: WriteCtx["onPhase"]) => ({
      network: "testnet",
      source: "GSOURCE",
      sign: vi.fn(),
      onPhase,
    }));
    const { result } = renderHook(() => useTx());

    let resolveAction!: (v: TxResult) => void;
    const action = vi.fn(
      (ctx: WriteCtx) =>
        new Promise<TxResult>((resolve) => {
          resolveAction = resolve;
          // Simulate the phase callbacks a real contract write would fire
          // synchronously before handing back control.
          ctx.onPhase?.("signing");
          ctx.onPhase?.("submitting");
          ctx.onPhase?.("confirming");
        }),
    );

    let runPromise!: Promise<TxResult | null>;
    act(() => {
      runPromise = result.current.run(action);
    });

    // By the time the synchronous portion of run() has executed, the action
    // has already driven the phase through to "confirming".
    expect(result.current.phase).toBe("confirming");
    expect(result.current.pending).toBe(true);
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveAction({ hash: "TXHASH", returnValue: 42 });
      await runPromise;
    });

    expect(result.current.phase).toBe("success");
    expect(result.current.pending).toBe(false);
    expect(result.current.hash).toBe("TXHASH");
    expect(result.current.error).toBeNull();
    await expect(runPromise).resolves.toEqual({ hash: "TXHASH", returnValue: 42 });
  });

  it("sets phase to error, captures the message, and resolves null on failure", async () => {
    writeCtx.mockImplementation((onPhase: WriteCtx["onPhase"]) => ({
      network: "testnet",
      source: "GSOURCE",
      sign: vi.fn(),
      onPhase,
    }));
    const { result } = renderHook(() => useTx());

    const action = vi.fn().mockRejectedValue(new Error("The network rejected the transaction."));

    let runPromise!: Promise<TxResult | null>;
    await act(async () => {
      runPromise = result.current.run(action);
      await runPromise;
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.pending).toBe(false);
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBe("The network rejected the transaction.");
    await expect(runPromise).resolves.toBeNull();
  });

  it("falls back to a generic message when the thrown value isn't an Error", async () => {
    writeCtx.mockReturnValue({
      network: "testnet",
      source: "GSOURCE",
      sign: vi.fn(),
    });
    const { result } = renderHook(() => useTx());

    const action = vi.fn().mockRejectedValue("some string failure");

    await act(async () => {
      await result.current.run(action);
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("Transaction failed.");
  });

  it("clears a prior error and hash when a new run starts", async () => {
    writeCtx.mockReturnValue({
      network: "testnet",
      source: "GSOURCE",
      sign: vi.fn(),
    });
    const { result } = renderHook(() => useTx());

    await act(async () => {
      await result.current.run(vi.fn().mockRejectedValue(new Error("first failure")));
    });
    expect(result.current.error).toBe("first failure");

    let resolveSecond!: (v: TxResult) => void;
    const second = vi.fn(
      () => new Promise<TxResult>((resolve) => { resolveSecond = resolve; }),
    );

    act(() => {
      void result.current.run(second);
    });

    // The new run clears the previous error/hash immediately.
    expect(result.current.error).toBeNull();
    expect(result.current.hash).toBeNull();
    expect(result.current.phase).toBe("building");

    await act(async () => {
      resolveSecond({ hash: "H2" });
      await Promise.resolve();
    });
  });
});

describe("reset", () => {
  it("returns phase/hash/error to their initial values", async () => {
    writeCtx.mockReturnValue({
      network: "testnet",
      source: "GSOURCE",
      sign: vi.fn(),
    });
    const { result } = renderHook(() => useTx());

    await act(async () => {
      await result.current.run(vi.fn().mockResolvedValue({ hash: "TXHASH" }));
    });
    expect(result.current.phase).toBe("success");
    expect(result.current.hash).toBe("TXHASH");

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe("idle");
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });
});
