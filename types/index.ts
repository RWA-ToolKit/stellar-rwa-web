/**
 * Shared domain types. These mirror the Soroban contract data structures
 * (see stellar-rwa-contracts), translated into JS-friendly shapes:
 *   - i128 amounts / valuations  -> bigint
 *   - u64 ids                    -> bigint
 *   - u32 ledger sequences       -> number
 */

export type Network = "testnet" | "mainnet";

/** The three asset classes the platform supports. */
export type AssetType = "real_estate" | "invoice" | "commodity";

export const ASSET_TYPES: AssetType[] = ["real_estate", "invoice", "commodity"];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  real_estate: "Real Estate",
  invoice: "Invoice",
  commodity: "Commodity",
};

/** A registered asset, as returned by the registry contract's `AssetEntry`. */
export interface AssetEntry {
  id: bigint;
  tokenContract: string;
  issuer: string;
  name: string;
  assetType: string;
  /** Valuation in USD cents. */
  valuation: bigint;
  /** Ledger sequence at registration. */
  createdAt: number;
  active: boolean;
}

/** On-chain metadata from the asset-token contract's `AssetMetadata`. */
export interface AssetMetadata {
  name: string;
  symbol: string;
  assetType: string;
  totalSupply: bigint;
  decimals: number;
  admin: string;
  complianceContract: string;
  assetDescription: string;
  /** Valuation in USD cents. */
  valuation: bigint;
  paused: boolean;
}

/** Registry entry joined with its token metadata for detail views. */
export interface AssetDetail extends AssetEntry {
  metadata: AssetMetadata;
}

export type ComplianceStatus =
  | "Approved"
  | "Pending"
  | "Rejected"
  | "Suspended";

/** A KYC record from the compliance contract. */
export interface KycRecord {
  address: string;
  status: ComplianceStatus;
  /** ISO country code, e.g. "US", "KE", "DE". */
  jurisdiction: string;
  /** Ledger sequence at which the record was verified. */
  verifiedAt: number;
  /** Ledger sequence at which approval expires; 0 = never. */
  expiresAt: number;
}

/** A dividend distribution from the dividend contract. */
export interface Distribution {
  id: bigint;
  assetToken: string;
  paymentToken: string;
  totalAmount: bigint;
  distributed: bigint;
  snapshotLedger: number;
  createdAt: number;
  completed: boolean;
}

/** Result of submitting an on-chain transaction. */
export interface TxResult {
  hash: string;
  /** scValToNative-decoded return value, when the method returns one. */
  returnValue?: unknown;
}

/** Phases surfaced to the user while a transaction is in flight. */
export type TxPhase =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error";
