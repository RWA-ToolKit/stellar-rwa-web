import {
  connect as freighterConnect,
  getConnectedAddress as freighterGetConnectedAddress,
  getNetwork as freighterGetNetwork,
  signTx as freighterSignTx,
  watch as freighterWatch,
} from "../freighter";

export type WalletId = "freighter" | "xbull" | "albedo";

export interface WalletAdapter {
  id: WalletId;
  name: string;
  isInstalled: () => boolean;
  connect: () => Promise<string>;
  getConnectedAddress: () => Promise<string | null>;
  getNetwork: () => Promise<string | null>;
  signTx: (xdr: string, opts?: { network?: string }) => Promise<string>;
  watch: (cb: (address: string | null) => void) => () => void;
}

/* -------------------------------------------------------------------------- */
/*                                  Freighter                                 */
/* -------------------------------------------------------------------------- */

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  name: "Freighter",
  isInstalled: () => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { freighter?: unknown };
    return Boolean(w.freighter);
  },
  connect: () => freighterConnect(),
  getConnectedAddress: () => freighterGetConnectedAddress(),
  getNetwork: () => freighterGetNetwork(),
  signTx: (xdr: string, opts?: { network?: string }) =>
    freighterSignTx(xdr, opts),
  watch: (cb: (address: string | null) => void) => freighterWatch(cb),
};

/* -------------------------------------------------------------------------- */
/*                                    xBull                                   */
/* -------------------------------------------------------------------------- */

interface XBullSDK {
  connect: () => Promise<{ publicKey: string }>;
  getPublicKey: () => Promise<{ publicKey: string }>;
  getNetwork: () => Promise<{ network: string }>;
  sign: (params: { xdr: string; network?: string }) => Promise<{ signedXDR: string }>;
  watch?: (cb: (state: { publicKey?: string | null }) => void) => () => void;
}

function getXBullSDK(): XBullSDK | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { xBullSDK?: XBullSDK };
  return w.xBullSDK ?? null;
}

export const xbullAdapter: WalletAdapter = {
  id: "xbull",
  name: "xBull",
  isInstalled: () => getXBullSDK() !== null,
  connect: async () => {
    const sdk = getXBullSDK();
    if (!sdk) throw new Error("xBull wallet is not installed");
    const { publicKey } = await sdk.connect();
    return publicKey;
  },
  getConnectedAddress: async () => {
    const sdk = getXBullSDK();
    if (!sdk) return null;
    try {
      const { publicKey } = await sdk.getPublicKey();
      return publicKey ?? null;
    } catch {
      return null;
    }
  },
  getNetwork: async () => {
    const sdk = getXBullSDK();
    if (!sdk) return null;
    try {
      const { network } = await sdk.getNetwork();
      return network ?? null;
    } catch {
      return null;
    }
  },
  signTx: async (xdr: string, opts?: { network?: string }) => {
    const sdk = getXBullSDK();
    if (!sdk) throw new Error("xBull wallet is not installed");
    const { signedXDR } = await sdk.sign({ xdr, network: opts?.network });
    return signedXDR;
  },
  watch: (cb: (address: string | null) => void) => {
    const sdk = getXBullSDK();
    if (!sdk || typeof sdk.watch !== "function") {
      return () => {};
    }
    return sdk.watch((state) => cb(state.publicKey ?? null));
  },
};

/* -------------------------------------------------------------------------- */
/*                                   Albedo                                   */
/* -------------------------------------------------------------------------- */

interface AlbedoApi {
  publicKey: (params?: Record<string, unknown>) => Promise<{ pubkey: string }>;
  signTransaction: (params: {
    xdr: string;
    network?: string;
    pubkey?: string;
  }) => Promise<{ signed_envelope_xdr: string }>;
}

function getAlbedo(): AlbedoApi | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { albedo?: AlbedoApi };
  return w.albedo ?? null;
}

const ALBEDO_NETWORK_MAP: Record<string, string> = {
  PUBLIC: "public",
  TESTNET: "testnet",
  FUTURENET: "futurenet",
};

export const albedoAdapter: WalletAdapter = {
  id: "albedo",
  name: "Albedo",
  isInstalled: () => getAlbedo() !== null,
  connect: async () => {
    const albedo = getAlbedo();
    if (!albedo) throw new Error("Albedo wallet is not available");
    const { pubkey } = await albedo.publicKey({});
    return pubkey;
  },
  getConnectedAddress: async () => {
    const albedo = getAlbedo();
    if (!albedo) return null;
    try {
      const { pubkey } = await albedo.publicKey({});
      return pubkey ?? null;
    } catch {
      return null;
    }
  },
  getNetwork: async () => {
    // Albedo does not expose a network getter; default to the app's network.
    return null;
  },
  signTx: async (xdr: string, opts?: { network?: string }) => {
    const albedo = getAlbedo();
    if (!albedo) throw new Error("Albedo wallet is not available");
    const network = opts?.network
      ? ALBEDO_NETWORK_MAP[opts.network] ?? opts.network.toLowerCase()
      : undefined;
    const { signed_envelope_xdr } = await albedo.signTransaction({
      xdr,
      network,
    });
    return signed_envelope_xdr;
  },
  watch: () => {
    // Albedo is a popup-based signer without a persistent connection to watch.
    return () => {};
  },
};

/* -------------------------------------------------------------------------- */
/*                                   Registry                                 */
/* -------------------------------------------------------------------------- */

export const walletAdapters: WalletAdapter[] = [
  freighterAdapter,
  xbullAdapter,
  albedoAdapter,
];

export function getWalletAdapter(id: WalletId): WalletAdapter | undefined {
  return walletAdapters.find((adapter) => adapter.id === id);
}

export function getAvailableWalletAdapters(): WalletAdapter[] {
  return walletAdapters.filter((adapter) => adapter.isInstalled());
}

export default walletAdapters;