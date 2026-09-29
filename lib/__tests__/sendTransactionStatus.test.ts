/**
 * Tests for issue #518 — TRY_AGAIN_LATER and DUPLICATE status handling in
 * invokeContract's sendTransaction step.
 *
 * invokeContract is the only public entry point for writes; we test its
 * behaviour by mocking the Soroban RPC server at the module level.
 */

import { ContractError } from "@/lib/stellar";

// ---------------------------------------------------------------------------
// Lightweight helpers that mirror the subset of @stellar/stellar-sdk used
// inside invokeContract so we don't have to fully build real XDR.
// ---------------------------------------------------------------------------

const FAKE_HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FAKE_PASSPHRASE = "Test SDF Network ; September 2015";

// We mock the entire @stellar/stellar-sdk module so we can control what the
// RPC server returns from sendTransaction / getTransaction without a live node.
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");

  class FakeAccount {
    accountId() { return "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA"; }
    sequenceNumber() { return "0"; }
    incrementSequenceNumber() {}
  }

  class FakeContract {
    call(_method: string, ..._args: unknown[]) { return { type: "call" }; }
  }

  class FakeTransactionBuilder {
    addOperation() { return this; }
    setTimeout() { return this; }
    build() {
      return {
        toXDR: () => "fakexdr",
        toEnvelope: () => ({}),
      };
    }
    static fromXDR(_xdr: string, _passphrase: string) {
      return { toXDR: () => "fakexdr" };
    }
  }

  const rpc = {
    Server: jest.fn(),
    Api: {
      ...actual.rpc.Api,
      isSimulationError: jest.fn().mockReturnValue(false),
      GetTransactionStatus: actual.rpc.Api.GetTransactionStatus,
    },
    assembleTransaction: jest.fn().mockReturnValue({ build: () => ({ toXDR: () => "preparedxdr" }) }),
  };

  return {
    ...actual,
    Account: FakeAccount,
    Contract: FakeContract,
    TransactionBuilder: FakeTransactionBuilder,
    rpc,
  };
});

import { rpc } from "@stellar/stellar-sdk";
import { invokeContract, getServer } from "@/lib/stellar";

// Build a mock server that returns the given sendTransaction result.
function makeMockServer(sendStatus: string) {
  const mockServer = {
    getAccount: jest.fn().mockResolvedValue({}),
    simulateTransaction: jest.fn().mockResolvedValue({
      result: { retval: undefined },
      minResourceFee: "100",
    }),
    sendTransaction: jest.fn().mockResolvedValue({
      status: sendStatus,
      hash: FAKE_HASH,
    }),
    getTransaction: jest.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      returnValue: undefined,
    }),
  };
  (rpc.Server as jest.Mock).mockReturnValue(mockServer);
  return mockServer;
}

const fakeSigner = async (xdr: string) => xdr;

describe("invokeContract — sendTransaction status handling (#518)", () => {
  beforeEach(() => {
    // Clear the server cache between tests so each test gets its own mock.
    jest.resetModules();
  });

  it("throws a clear ContractError for TRY_AGAIN_LATER without polling", async () => {
    const mockServer = makeMockServer("TRY_AGAIN_LATER");
    // Override getServer to return our mock.
    jest.spyOn(require("@/lib/stellar"), "getServer").mockReturnValue(mockServer);

    await expect(
      invokeContract(
        "testnet",
        "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
        "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
        "transfer",
        [],
        fakeSigner,
      ),
    ).rejects.toMatchObject({
      name: "ContractError",
      message: expect.stringContaining("congested"),
    });

    // Must NOT poll after TRY_AGAIN_LATER — the hash was never accepted.
    expect(mockServer.getTransaction).not.toHaveBeenCalled();
  });

  it("TRY_AGAIN_LATER error detail includes the hash", async () => {
    const mockServer = makeMockServer("TRY_AGAIN_LATER");
    jest.spyOn(require("@/lib/stellar"), "getServer").mockReturnValue(mockServer);

    let caught: ContractError | undefined;
    try {
      await invokeContract(
        "testnet",
        "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
        "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
        "transfer",
        [],
        fakeSigner,
      );
    } catch (e) {
      caught = e as ContractError;
    }
    expect(caught).toBeDefined();
    expect(caught?.detail).toContain(FAKE_HASH);
  });

  it("DUPLICATE falls through to poll and returns success", async () => {
    const mockServer = makeMockServer("DUPLICATE");
    jest.spyOn(require("@/lib/stellar"), "getServer").mockReturnValue(mockServer);

    await expect(
      invokeContract(
        "testnet",
        "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
        "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
        "transfer",
        [],
        fakeSigner,
      ),
    ).resolves.toMatchObject({ hash: FAKE_HASH });

    // Polling should have been called for DUPLICATE.
    expect(mockServer.getTransaction).toHaveBeenCalledWith(FAKE_HASH);
  });

  it("PENDING falls through to poll as before", async () => {
    const mockServer = makeMockServer("PENDING");
    jest.spyOn(require("@/lib/stellar"), "getServer").mockReturnValue(mockServer);

    await expect(
      invokeContract(
        "testnet",
        "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
        "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
        "transfer",
        [],
        fakeSigner,
      ),
    ).resolves.toMatchObject({ hash: FAKE_HASH });

    expect(mockServer.getTransaction).toHaveBeenCalledWith(FAKE_HASH);
  });

  it("throws ContractError for ERROR status with network-rejected message", async () => {
    const mockServer = makeMockServer("ERROR");
    (mockServer.sendTransaction as jest.Mock).mockResolvedValue({
      status: "ERROR",
      hash: FAKE_HASH,
      errorResult: { message: "bad tx" },
    });
    jest.spyOn(require("@/lib/stellar"), "getServer").mockReturnValue(mockServer);

    await expect(
      invokeContract(
        "testnet",
        "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
        "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
        "transfer",
        [],
        fakeSigner,
      ),
    ).rejects.toMatchObject({
      name: "ContractError",
      message: expect.stringContaining("rejected"),
    });

    expect(mockServer.getTransaction).not.toHaveBeenCalled();
  });

  it("throws ContractError for unknown status codes", async () => {
    const mockServer = makeMockServer("UNKNOWN_FUTURE_STATUS");
    jest.spyOn(require("@/lib/stellar"), "getServer").mockReturnValue(mockServer);

    await expect(
      invokeContract(
        "testnet",
        "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA",
        "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
        "transfer",
        [],
        fakeSigner,
      ),
    ).rejects.toMatchObject({
      name: "ContractError",
      message: expect.stringContaining("UNKNOWN_FUTURE_STATUS"),
    });
  });
});
