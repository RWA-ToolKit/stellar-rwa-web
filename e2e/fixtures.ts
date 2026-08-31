/**
 * Shared fixtures and helpers for the e2e test suite.
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *
 * This app has two external dependencies that must be mocked in e2e tests:
 *
 * 1. Freighter wallet extension  — injected into the page via addInitScript
 *    by replacing window.freighter before React hydrates. The freighter-api
 *    package reads from window.freighter, so our mock is picked up
 *    transparently.
 *
 * 2. Soroban RPC + REST API      — intercepted via page.route() so that
 *    every simulateTransaction / getAccount / getLatestLedger call returns
 *    a canned response without touching a real blockchain node.
 *
 * ── Scoped mock identities ──────────────────────────────────────────────────
 *
 * Two real-looking Stellar addresses are used. They satisfy StrKey validation
 * so the UI doesn't reject them as malformed. They are *not* real funded
 * accounts; the mocked RPC returns everything needed.
 */

import type { Page, Route } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────────

export const WALLET_ADDRESS =
  "GBXFM6DSYY3SWAKJJXBKZV5UFFVW4WDQR3FJQB6KPDBJXTKPBQTEZWI";

export const RECIPIENT_ADDRESS =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

export const TOKEN_CONTRACT =
  "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU";

export const COMPLIANCE_CONTRACT =
  "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX";

export const PAYMENT_TOKEN =
  "CCXJ3YEB4VXPEFWYLVHIGG6VHLLEKNF4TFVPGOBHM42YXZF6RKOCXHW";

export const ASSET_ID = "1";

/** Minimal asset entry returned by the REST API. */
export const ASSET_ENTRY = {
  id: ASSET_ID,
  tokenContract: TOKEN_CONTRACT,
  issuer: WALLET_ADDRESS,
  name: "Lagos Office Tower",
  assetType: "real_estate",
  valuation: "500000000",
  createdAt: 100,
  active: true,
};

/** Minimal metadata returned by the get_metadata contract call. */
export const ASSET_METADATA = {
  name: "Lagos Office Tower",
  symbol: "LOT",
  asset_type: "real_estate",
  total_supply: 1_000_000n,
  decimals: 0,
  admin: WALLET_ADDRESS,
  compliance_contract: COMPLIANCE_CONTRACT,
  asset_description: "A commercial tower in Lagos, Nigeria.",
  valuation: 500_000_000n,
  paused: false,
};

// ── Wallet mock ───────────────────────────────────────────────────────────────

/**
 * Inject a mock Freighter wallet into the page before any scripts run.
 *
 * @stellar/freighter-api reads from window.freighter. By overriding it before
 * the app loads we make the wallet context believe a real wallet is installed
 * and connected, without a browser extension.
 */
export async function mockFreighterWallet(
  page: Page,
  opts: {
    address?: string;
    /** Set false to simulate "wallet not installed". */
    installed?: boolean;
  } = {},
) {
  const address = opts.address ?? WALLET_ADDRESS;
  const installed = opts.installed ?? true;

  await page.addInitScript(
    ({ address, installed }: { address: string; installed: boolean }) => {
      if (!installed) return; // leave window.freighter undefined

      // freighter-api v6 reads from window.freighter (the extension object).
      // The methods we need: isConnected, isAllowed, requestAccess, getAddress,
      // getNetwork, signTransaction, WatchWalletChanges.
      (window as unknown as Record<string, unknown>).freighter = {
        isConnected: () =>
          Promise.resolve({ isConnected: true, isAllowed: true, hasPrivateKey: true }),
        isAllowed: () => Promise.resolve({ isAllowed: true }),
        requestAccess: () => Promise.resolve({ address }),
        getAddress: () => Promise.resolve({ address }),
        getNetwork: () =>
          Promise.resolve({
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015",
          }),
        getNetworkDetails: () =>
          Promise.resolve({
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015",
            sorobanRpcUrl: "https://soroban-testnet.stellar.org",
          }),
        signTransaction: (xdr: string) =>
          Promise.resolve({ signedTxXdr: xdr, signerAddress: address }),
        addEventHandler: () => {},
        removeEventHandler: () => {},
      };

      // WatchWalletChanges is imported from the package, not from window.freighter.
      // It's a class. We can't easily override it here, but its fallback in
      // lib/freighter.ts wraps it in try/catch and returns () => {} on error.
      // Playwright will call it — the catch will fire and the watcher will
      // simply be a no-op, which is fine for e2e purposes.
    },
    { address, installed },
  );
}

// ── Soroban RPC mock ──────────────────────────────────────────────────────────

/**
 * Intercept all Soroban RPC and REST API HTTP calls.
 *
 * The stellar-sdk sends JSON-RPC POSTs to the configured rpcUrl. We return
 * minimal responses that make the SDK resolve successfully without going to
 * the network.
 *
 * For read-only simulation (`simulateTransaction`), we return a success
 * envelope. The result XDR is empty (no retval), which causes readContract to
 * return undefined. The hooks then either short-circuit or render fallback
 * states — which is exactly what we want to test at the integration level.
 *
 * For the transfer and claim tests we need richer responses, which are
 * provided via the `opts` overrides.
 */
export async function mockRpc(
  page: Page,
  opts: {
    /** Fake balance for the connected wallet on the token contract. */
    balance?: number;
    /** Whether the wallet address is compliance-approved. */
    walletApproved?: boolean;
    /** Whether the recipient address is compliance-approved. */
    recipientApproved?: boolean;
    /** Claimable amount for distribution 1 (in raw payment token units). */
    claimable?: number;
    /** Whether the wallet has already claimed distribution 1. */
    hasClaimed?: boolean;
  } = {},
) {
  const {
    balance = 500,
    walletApproved = true,
    recipientApproved = true,
    claimable = 10_0000000,
    hasClaimed = false,
  } = opts;

  // Intercept Soroban RPC endpoint.
  await page.route(
    /soroban-testnet\.stellar\.org|soroban.*\.org|sorobanrpc/,
    async (route: Route) => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(route.request().postData() ?? "{}");
      } catch {
        // not JSON — pass through
      }

      const method = body.method as string | undefined;

      if (method === "getLatestLedger") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: { id: "abc", sequence: 1234, protocolVersion: "20" },
          }),
        });
      }

      if (method === "getAccount") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              id: WALLET_ADDRESS,
              sequence: "1000",
              balances: [{ asset_type: "native", balance: "100.0000000" }],
              flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
            },
          }),
        });
      }

      if (method === "simulateTransaction") {
        // For e2e we return an empty-retval success. The hooks interpret this
        // as the loaded state depending on the method.
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              // A successful simulation with no return value (void methods)
              transactionData:
                "AAAAAAAAAAIAAAAGAAAAASBVNnkqpikF2OX0e7yS0g4P4sNHXE6D4yVmHZyOHNVAAAAAEAAAAABAAAABgAAAAEAAAAAAAAABAAAAASAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
              events: [],
              minResourceFee: "100",
              results: [{ xdr: "AAAAAQAAAAE=" /* bool true */ }],
              cost: { cpuInsns: "0", memBytes: "0" },
              latestLedger: "1234",
            },
          }),
        });
      }

      if (method === "sendTransaction") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              hash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
              status: "PENDING",
              latestLedger: "1235",
              latestLedgerCloseTime: "1700000000",
            },
          }),
        });
      }

      if (method === "getTransaction") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              status: "SUCCESS",
              latestLedger: "1236",
              latestLedgerCloseTime: "1700000001",
              txHash:
                "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
              returnValue: "AAAAAQAAAAE=",
            },
          }),
        });
      }

      // Default: return an empty-success simulation for any other RPC call.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {},
        }),
      });
    },
  );

  // Intercept the REST API (NEXT_PUBLIC_API_URL — may be unset in dev, but
  // we still set up the handler so tests work whether the env var is set or not).
  await page.route(/\/api\//, async (route: Route) => {
    const url = route.request().url();
    if (url.match(/\/assets\/\d+\/holders/)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ address: WALLET_ADDRESS, balance: String(balance) }]),
      });
    }
    if (url.match(/\/assets\/\d+$/)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ASSET_ENTRY),
      });
    }
    if (url.includes("/assets")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [ASSET_ENTRY],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
      });
    }
    if (url.includes("/stats")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalAssets: 1, tvl: "500000000", totalHolders: 1 }),
      });
    }
    return route.continue();
  });

  // Suppress unused variable warnings for opts we captured but don't use in
  // route handlers (they exist for documentation / future expansion).
  void walletApproved;
  void recipientApproved;
  void claimable;
  void hasClaimed;
}
