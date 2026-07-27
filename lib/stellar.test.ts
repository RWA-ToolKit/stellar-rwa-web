import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rpc } from "@stellar/stellar-sdk";
import { pollTransaction, ContractError } from "./stellar";

function makeServer(finalResponse: unknown) {
  const getTransaction = vi.fn().mockImplementation(async () => finalResponse);
  return { getTransaction } as unknown as rpc.Server;
}

/**
 * Advance fake time in steps matching pollTransaction's internal 2s poll
 * interval, rather than one big jump. `pollTransaction` awaits the mocked
 * (async) `getTransaction` before scheduling its next `setTimeout`, and a
 * single large (or misaligned) `advanceTimersByTimeAsync` call doesn't
 * reliably re-flush microtasks across that many hops.
 */
async function advanceInSteps(totalMs: number, stepMs = 2_000) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    await vi.advanceTimersByTimeAsync(stepMs);
  }
}

describe("pollTransaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves as soon as the status is no longer NOT_FOUND (SUCCESS)", async () => {
    const success = { status: rpc.Api.GetTransactionStatus.SUCCESS };
    const server = makeServer(success);

    const result = await pollTransaction(server, "hash123");

    expect(result).toBe(success);
    expect(server.getTransaction).toHaveBeenCalledTimes(1);
  });

  it("resolves as soon as the status is no longer NOT_FOUND (FAILED)", async () => {
    const failed = { status: rpc.Api.GetTransactionStatus.FAILED };
    const server = makeServer(failed);

    const result = await pollTransaction(server, "hash123");

    expect(result).toBe(failed);
    expect(server.getTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws a ContractError once the default timeout elapses", async () => {
    const notFound = { status: rpc.Api.GetTransactionStatus.NOT_FOUND };
    const server = makeServer(notFound);

    const promise = pollTransaction(server, "hash123");
    const assertion = expect(promise).rejects.toThrow(ContractError);
    await advanceInSteps(34_000);
    await assertion;
  });

  it("times out around the 30s default, not 60s", async () => {
    const notFound = { status: rpc.Api.GetTransactionStatus.NOT_FOUND };
    const server = makeServer(notFound);

    let settled: "resolved" | "rejected" | null = null;
    pollTransaction(server, "hash123").then(
      () => (settled = "resolved"),
      () => (settled = "rejected"),
    );

    // Comfortably short of the 30s default: still polling, no verdict yet.
    await advanceInSteps(26_000);
    expect(settled).toBeNull();

    // By 34s it must have rejected — well before a 60s timeout ever would.
    await advanceInSteps(8_000);
    expect(settled).toBe("rejected");
  });

  it("respects a custom timeoutMs override", async () => {
    const notFound = { status: rpc.Api.GetTransactionStatus.NOT_FOUND };
    const server = makeServer(notFound);

    const promise = pollTransaction(server, "hash123", 5_000);
    const assertion = expect(promise).rejects.toThrow(ContractError);
    await advanceInSteps(6_000);
    await assertion;
  });
});
