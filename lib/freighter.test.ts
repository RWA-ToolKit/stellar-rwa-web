import { describe, it, expect, vi, beforeEach } from "vitest";
import { Networks } from "@stellar/stellar-sdk";

const fIsConnected = vi.fn();
const fIsAllowed = vi.fn();
const fRequestAccess = vi.fn();
const fGetAddress = vi.fn();
const fGetNetwork = vi.fn();
const fSignTransaction = vi.fn();
const watchCtor = vi.fn();
const watchInstance = { watch: vi.fn(), stop: vi.fn() };

vi.mock("@stellar/freighter-api", () => ({
  isConnected: (...args: unknown[]) => fIsConnected(...args),
  isAllowed: (...args: unknown[]) => fIsAllowed(...args),
  requestAccess: (...args: unknown[]) => fRequestAccess(...args),
  getAddress: (...args: unknown[]) => fGetAddress(...args),
  getNetwork: (...args: unknown[]) => fGetNetwork(...args),
  signTransaction: (...args: unknown[]) => fSignTransaction(...args),
  WatchWalletChanges: vi.fn().mockImplementation(function (
    ...args: unknown[]
  ) {
    watchCtor(...args);
    return watchInstance;
  }),
}));

import {
  isFreighterInstalled,
  isAppAllowed,
  connect,
  getConnectedAddress,
  getWalletNetwork,
  signTx,
  watchWallet,
  WalletError,
} from "@/lib/freighter";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFreighterInstalled", () => {
  it("returns true when Freighter reports connected", async () => {
    fIsConnected.mockResolvedValue({ isConnected: true });
    await expect(isFreighterInstalled()).resolves.toBe(true);
  });

  it("returns false when the API call throws", async () => {
    fIsConnected.mockRejectedValue(new Error("no extension"));
    await expect(isFreighterInstalled()).resolves.toBe(false);
  });
});

describe("isAppAllowed", () => {
  it("returns false when the API call throws", async () => {
    fIsAllowed.mockRejectedValue(new Error("boom"));
    await expect(isAppAllowed()).resolves.toBe(false);
  });
});

describe("connect", () => {
  it("throws a WalletError when Freighter is not installed", async () => {
    fIsConnected.mockResolvedValue({ isConnected: false });
    await expect(connect()).rejects.toThrow(WalletError);
    await expect(connect()).rejects.toThrow(/not detected/i);
  });

  it("normalises a Freighter { error } response into a thrown WalletError", async () => {
    fIsConnected.mockResolvedValue({ isConnected: true });
    fRequestAccess.mockResolvedValue({ error: "User declined access" });
    await expect(connect()).rejects.toThrow(WalletError);
    await expect(connect()).rejects.toThrow("User declined access");
  });

  it("throws when no address is returned", async () => {
    fIsConnected.mockResolvedValue({ isConnected: true });
    fRequestAccess.mockResolvedValue({});
    await expect(connect()).rejects.toThrow(/no account returned/i);
  });

  it("resolves with the address on success", async () => {
    fIsConnected.mockResolvedValue({ isConnected: true });
    fRequestAccess.mockResolvedValue({ address: "GADDRESS" });
    await expect(connect()).resolves.toBe("GADDRESS");
  });
});

describe("getConnectedAddress", () => {
  it("returns null when the app isn't allowed", async () => {
    fIsAllowed.mockResolvedValue({ isAllowed: false });
    await expect(getConnectedAddress()).resolves.toBeNull();
  });

  it("returns null when Freighter responds with an error", async () => {
    fIsAllowed.mockResolvedValue({ isAllowed: true });
    fGetAddress.mockResolvedValue({ error: "denied" });
    await expect(getConnectedAddress()).resolves.toBeNull();
  });

  it("returns null when the call throws", async () => {
    fIsAllowed.mockResolvedValue({ isAllowed: true });
    fGetAddress.mockRejectedValue(new Error("boom"));
    await expect(getConnectedAddress()).resolves.toBeNull();
  });

  it("returns the address when allowed", async () => {
    fIsAllowed.mockResolvedValue({ isAllowed: true });
    fGetAddress.mockResolvedValue({ address: "GADDRESS" });
    await expect(getConnectedAddress()).resolves.toBe("GADDRESS");
  });
});

describe("getWalletNetwork", () => {
  it("returns null on a Freighter error response", async () => {
    fGetNetwork.mockResolvedValue({ error: "unavailable" });
    await expect(getWalletNetwork()).resolves.toBeNull();
  });

  it("returns null when the call throws", async () => {
    fGetNetwork.mockRejectedValue(new Error("boom"));
    await expect(getWalletNetwork()).resolves.toBeNull();
  });

  it("maps the public passphrase to mainnet", async () => {
    fGetNetwork.mockResolvedValue({ networkPassphrase: Networks.PUBLIC });
    await expect(getWalletNetwork()).resolves.toBe("mainnet");
  });

  it("maps the testnet passphrase to testnet", async () => {
    fGetNetwork.mockResolvedValue({ networkPassphrase: Networks.TESTNET });
    await expect(getWalletNetwork()).resolves.toBe("testnet");
  });

  it("falls back to the coarse PUBLIC label when the passphrase is unfamiliar", async () => {
    fGetNetwork.mockResolvedValue({
      networkPassphrase: "Some unfamiliar passphrase",
      network: "public",
    });
    await expect(getWalletNetwork()).resolves.toBe("mainnet");
  });

  it("falls back to testnet for any other unfamiliar network label", async () => {
    fGetNetwork.mockResolvedValue({
      networkPassphrase: "Some unfamiliar passphrase",
      network: "futurenet",
    });
    await expect(getWalletNetwork()).resolves.toBe("testnet");
  });
});

describe("signTx", () => {
  it("normalises a Freighter { error } response into a thrown WalletError", async () => {
    fSignTransaction.mockResolvedValue({ error: "User rejected" });
    await expect(signTx("XDR", Networks.TESTNET, "GADDRESS")).rejects.toThrow(
      WalletError,
    );
    await expect(signTx("XDR", Networks.TESTNET, "GADDRESS")).rejects.toThrow(
      "User rejected",
    );
  });

  it("throws when no signed XDR is returned", async () => {
    fSignTransaction.mockResolvedValue({});
    await expect(signTx("XDR", Networks.TESTNET, "GADDRESS")).rejects.toThrow(
      /no signature/i,
    );
  });

  it("resolves with the signed XDR on success", async () => {
    fSignTransaction.mockResolvedValue({ signedTxXdr: "SIGNED" });
    await expect(
      signTx("XDR", Networks.TESTNET, "GADDRESS"),
    ).resolves.toBe("SIGNED");
    expect(fSignTransaction).toHaveBeenCalledWith("XDR", {
      networkPassphrase: Networks.TESTNET,
      address: "GADDRESS",
    });
  });
});

describe("watchWallet", () => {
  it("subscribes via WatchWalletChanges and returns an unsubscribe fn", () => {
    const onChange = vi.fn();
    const stop = watchWallet(onChange);
    expect(watchCtor).toHaveBeenCalledWith(2000);
    expect(watchInstance.watch).toHaveBeenCalledWith(onChange);
    stop();
    expect(watchInstance.stop).toHaveBeenCalled();
  });

  it("returns a no-op unsubscribe fn if constructing the watcher throws", async () => {
    const { WatchWalletChanges } = await import("@stellar/freighter-api");
    (WatchWalletChanges as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => {
        throw new Error("boom");
      },
    );
    const stop = watchWallet(vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
