import { describe, it, expect, vi, beforeEach } from "vitest";

const mockServer = {
  getAccount: vi.fn(),
  simulateTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
  getLatestLedger: vi.fn(),
};

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...actual,
    Contract: vi.fn().mockImplementation(function (this: unknown, id: string) {
      return { call: vi.fn((method: string, ...args: unknown[]) => ({ contractId: id, method, args })) };
    }),
    TransactionBuilder: Object.assign(
      vi.fn().mockImplementation(function (this: unknown) {
        const builder = {
          addOperation: vi.fn(() => builder),
          setTimeout: vi.fn(() => builder),
          build: vi.fn(() => ({ toXDR: () => "BUILT_XDR" })),
        };
        return builder;
      }),
      {
        fromXDR: vi.fn((xdrStr: string, passphrase: string) => ({
          toXDR: () => xdrStr,
          passphrase,
        })),
      },
    ),
    Account: vi.fn().mockImplementation(function (this: unknown, id: string, seq: string) {
      return { accountId: () => id, sequence: seq };
    }),
    scValToNative: vi.fn((v: unknown) => v),
    rpc: {
      ...actual.rpc,
      Server: vi.fn().mockImplementation(function (this: unknown) {
        return mockServer;
      }),
      assembleTransaction: vi.fn(() => ({
        build: () => ({ toXDR: () => "PREPARED_XDR" }),
      })),
      Api: {
        ...actual.rpc.Api,
        isSimulationError: vi.fn(() => false),
      },
    },
  };
});

import { rpc } from "@stellar/stellar-sdk";
import { invokeContract, ContractError } from "@/lib/stellar";

const isSimulationError = rpc.Api.isSimulationError as unknown as ReturnType<typeof vi.fn>;

function resetHappyPath() {
  mockServer.getAccount.mockResolvedValue({ accountId: () => "GSOURCE", sequence: "1" });
  mockServer.simulateTransaction.mockResolvedValue({ result: {} });
  mockServer.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "TXHASH" });
  mockServer.getTransaction.mockResolvedValue({
    status: rpc.Api.GetTransactionStatus.SUCCESS,
    returnValue: "DECODED",
  });
  isSimulationError.mockReturnValue(false);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetHappyPath();
});

const sign = vi.fn(async (xdr: string) => `SIGNED(${xdr})`);

describe("invokeContract", () => {
  it("drives onPhase through building -> signing -> submitting -> confirming and returns the TxResult", async () => {
    const onPhase = vi.fn();
    const result = await invokeContract(
      "testnet",
      "GSOURCE",
      "CCONTRACT",
      "transfer",
      [],
      sign,
      onPhase,
    );

    expect(onPhase.mock.calls.map((c) => c[0])).toEqual([
      "building",
      "signing",
      "submitting",
      "confirming",
    ]);
    expect(result).toEqual({ hash: "TXHASH", returnValue: "DECODED" });
    expect(sign).toHaveBeenCalledWith("PREPARED_XDR");
  });

  it("throws a ContractError when simulation fails, before signing", async () => {
    isSimulationError.mockReturnValue(true);
    mockServer.simulateTransaction.mockResolvedValue({
      error: "Error(Contract, #7)",
    });
    const onPhase = vi.fn();

    const err = await invokeContract(
      "testnet",
      "GSOURCE",
      "CCONTRACT",
      "transfer",
      [],
      sign,
      onPhase,
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ContractError);
    expect(err.message).toMatch(/not KYC-approved/i);
    expect(onPhase.mock.calls.map((c) => c[0])).toEqual(["building"]);
    expect(sign).not.toHaveBeenCalled();
  });

  it("throws a ContractError when the network rejects the transaction", async () => {
    mockServer.sendTransaction.mockResolvedValue({ status: "ERROR", errorResult: "boom" });
    const onPhase = vi.fn();

    await expect(
      invokeContract("testnet", "GSOURCE", "CCONTRACT", "transfer", [], sign, onPhase),
    ).rejects.toThrow(ContractError);

    expect(onPhase.mock.calls.map((c) => c[0])).toEqual([
      "building",
      "signing",
      "submitting",
    ]);
    expect(mockServer.getTransaction).not.toHaveBeenCalled();
  });

  it("throws a ContractError when the transaction fails on-chain", async () => {
    mockServer.getTransaction.mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.FAILED,
    });
    const onPhase = vi.fn();

    const err = await invokeContract(
      "testnet",
      "GSOURCE",
      "CCONTRACT",
      "transfer",
      [],
      sign,
      onPhase,
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ContractError);
    expect(err.message).toMatch(/failed on-chain/i);
    expect(onPhase.mock.calls.map((c) => c[0])).toEqual([
      "building",
      "signing",
      "submitting",
      "confirming",
    ]);
  });
});
