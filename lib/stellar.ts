/**
 * Low-level Stellar / Soroban RPC engine.
 *
 * Two responsibilities:
 *   1. Read contract state via `simulateTransaction` (no wallet, no fees).
 *   2. Submit signed transactions built by callers and confirm them.
 *
 * Higher-level, per-contract bindings live in `lib/contracts.ts`.
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import type { Network, TxResult } from "@/types";

interface NetworkConfig {
  rpcUrl: string;
  passphrase: string;
  explorerBase: string;
}

const NETWORKS: Record<Network, NetworkConfig> = {
  testnet: {
    rpcUrl:
      process.env.NEXT_PUBLIC_TESTNET_RPC_URL ??
      "https://soroban-testnet.stellar.org",
    passphrase: Networks.TESTNET,
    explorerBase: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    rpcUrl:
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ??
      "https://mainnet.sorobanrpc.com",
    passphrase: Networks.PUBLIC,
    explorerBase: "https://stellar.expert/explorer/public",
  },
};

export const DEFAULT_NETWORK: Network =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as Network) === "mainnet"
    ? "mainnet"
    : "testnet";

/**
 * A valid, funded account used solely as the source for read simulations.
 * Simulations don't spend anything; the source only needs to be a real account.
 * This is the contracts repo admin/issuer account.
 */
const READ_SOURCE = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";

const serverCache = new Map<Network, rpc.Server>();

export function getServer(network: Network): rpc.Server {
  let server = serverCache.get(network);
  if (!server) {
    const cfg = NETWORKS[network];
    server = new rpc.Server(cfg.rpcUrl, {
      allowHttp: cfg.rpcUrl.startsWith("http://"),
    });
    serverCache.set(network, server);
  }
  return server;
}

export function networkPassphrase(network: Network): string {
  return NETWORKS[network].passphrase;
}

export function explorerBase(network: Network): string {
  return NETWORKS[network].explorerBase;
}

export function explorerContractUrl(network: Network, contractId: string): string {
  return `${explorerBase(network)}/contract/${contractId}`;
}

export function explorerTxUrl(network: Network, hash: string): string {
  return `${explorerBase(network)}/tx/${hash}`;
}

export function explorerAccountUrl(network: Network, account: string): string {
  return `${explorerBase(network)}/account/${account}`;
}

// ---- scVal argument builders (typed to match the contract signatures) ----

export const arg = {
  address: (v: string): xdr.ScVal => new Address(v).toScVal(),
  string: (v: string): xdr.ScVal => nativeToScVal(v, { type: "string" }),
  symbol: (v: string): xdr.ScVal => nativeToScVal(v, { type: "symbol" }),
  bool: (v: boolean): xdr.ScVal => nativeToScVal(v, { type: "bool" }),
  u32: (v: number): xdr.ScVal => nativeToScVal(v, { type: "u32" }),
  u64: (v: bigint | number): xdr.ScVal => nativeToScVal(BigInt(v), { type: "u64" }),
  i128: (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "i128" }),
};

/**
 * Read a contract method by simulating an invocation. Returns the decoded
 * native value (bigint for i128/u64, number for u32, string for Address, etc.).
 */
export async function readContract<T = unknown>(
  network: Network,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const server = getServer(network);
  const contract = new Contract(contractId);
  const source = new Account(READ_SOURCE, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(network),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractError(parseContractError(sim.error), sim.error);
  }
  const retval = sim.result?.retval;
  if (!retval) return undefined as T;
  return scValToNative(retval) as T;
}

/** Function that signs a transaction XDR and returns the signed XDR. */
export type Signer = (xdrBase64: string) => Promise<string>;

/**
 * Build, prepare, sign and submit a contract invocation, then poll to
 * confirmation. Progress is surfaced via the optional `onPhase` callback.
 */
export async function invokeContract(
  network: Network,
  source: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sign: Signer,
  onPhase?: (phase: "building" | "signing" | "submitting" | "confirming") => void,
): Promise<TxResult> {
  const server = getServer(network);
  const passphrase = networkPassphrase(network);
  const contract = new Contract(contractId);

  onPhase?.("building");
  const account = await server.getAccount(source);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // Simulate first so we can surface a clean contract error before asking the
  // user to sign, and so the transaction carries the right footprint + fees.
  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractError(parseContractError(sim.error), sim.error);
  }
  const prepared = rpc.assembleTransaction(built, sim).build();

  onPhase?.("signing");
  const signedXdr = await sign(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, passphrase);

  onPhase?.("submitting");
  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new ContractError(
      "The network rejected the transaction.",
      JSON.stringify(sent.errorResult ?? sent),
    );
  }

  onPhase?.("confirming");
  const final = await pollTransaction(server, sent.hash);
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new ContractError(
      "The transaction failed on-chain.",
      JSON.stringify(final),
    );
  }

  let returnValue: unknown;
  try {
    if (final.returnValue) returnValue = scValToNative(final.returnValue);
  } catch {
    // A missing/undecodable return value is non-fatal for void methods.
  }
  return { hash: sent.hash, returnValue };
}

async function pollTransaction(
  server: rpc.Server,
  hash: string,
  timeoutMs = 30000,
): Promise<rpc.Api.GetTransactionResponse> {
  const start = Date.now();
  // Poll roughly every ledger (~2s) until the RPC knows the transaction.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await server.getTransaction(hash);
    if (res.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) return res;
    if (Date.now() - start > timeoutMs) {
      throw new ContractError(
        "Timed out waiting for confirmation. The transaction may still land — check the explorer.",
        hash,
      );
    }
    await sleep(2000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Error carrying a user-facing message plus the raw diagnostic detail. */
export class ContractError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "ContractError";
    this.detail = detail;
  }
}

/**
 * Map a raw Soroban error string to a friendlier message. Contract errors
 * surface as `Error(Contract, #N)`; we translate the codes we know about.
 */
function parseContractError(raw: string): string {
  const codeMatch = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (codeMatch) {
    const code = Number(codeMatch[1]);
    return KNOWN_CONTRACT_ERRORS[code] ?? `Contract rejected the call (code ${code}).`;
  }
  if (/trustline|insufficient/i.test(raw)) {
    return "Insufficient balance or a missing trustline for the payment token.";
  }
  return "The contract call could not be completed.";
}

/**
 * Union of the error enums across the four contracts. Codes overlap between
 * contracts, so messages are written to read sensibly regardless of source.
 */
const KNOWN_CONTRACT_ERRORS: Record<number, string> = {
  1: "Already initialized.",
  2: "Contract is not initialized.",
  3: "You are not authorized to perform this action.",
  4: "The requested record was not found.",
  5: "Invalid amount or valuation.",
  6: "This asset is currently paused.",
  7: "The sender is not KYC-approved for this asset.",
  8: "The recipient is not KYC-approved for this asset.",
  9: "Amount overflow.",
};
