/**
 * Thin REST client for the stellar-rwa-api read endpoints.
 *
 * The Stellar SDK (`@stellar/stellar-sdk`, see `lib/stellar.ts`) is heavy and
 * only strictly required for write flows (building, signing and submitting
 * transactions) and as a last-resort fallback for reads. Pages that only
 * need to *display* on-chain data should go through this module instead of
 * `lib/contracts.ts` so the SDK isn't pulled into their bundle.
 *
 * Every export here is a plain `fetch` against `NEXT_PUBLIC_API_URL`. If the
 * API isn't configured or a request fails, callers should fall back to a
 * direct on-chain read via a dynamic `import("@/lib/contracts")` — see
 * `withFallback` below and its usages in `hooks/useAssets.ts`,
 * `hooks/useAsset.ts`, `hooks/useHolders.ts` and `hooks/useHolderTotals.ts`.
 */

import type { AssetDetail, AssetEntry, Network } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/** Whether a REST API base URL is configured for this deployment. */
export function apiEnabled(): boolean {
  return Boolean(API_BASE);
}

async function apiGet<T>(path: string): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Try the REST API first; fall back (e.g. to a direct on-chain read) if the
 * API isn't configured or the request fails for any reason.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  if (!apiEnabled()) return fallback();
  try {
    return await primary();
  } catch {
    return fallback();
  }
}

// ---- raw API shapes (mirrors the API's snake_case JSON) ----

interface RawAssetEntry {
  id: string;
  token_contract: string;
  issuer: string;
  name: string;
  asset_type: string;
  valuation: string;
  created_at: number;
  active: boolean;
}

function toAssetEntry(r: RawAssetEntry): AssetEntry {
  return {
    id: BigInt(r.id),
    tokenContract: r.token_contract,
    issuer: r.issuer,
    name: r.name,
    assetType: r.asset_type,
    valuation: BigInt(r.valuation),
    createdAt: Number(r.created_at),
    active: r.active,
  };
}

interface RawAssetMetadata {
  name: string;
  symbol: string;
  asset_type: string;
  total_supply: string;
  decimals: number;
  admin: string;
  compliance_contract: string;
  asset_description: string;
  valuation: string;
  paused: boolean;
}

interface RawAssetDetail extends RawAssetEntry {
  metadata: RawAssetMetadata;
}

function toAssetDetail(r: RawAssetDetail): AssetDetail {
  return {
    ...toAssetEntry(r),
    metadata: {
      name: r.metadata.name,
      symbol: r.metadata.symbol,
      assetType: r.metadata.asset_type,
      totalSupply: BigInt(r.metadata.total_supply),
      decimals: Number(r.metadata.decimals),
      admin: r.metadata.admin,
      complianceContract: r.metadata.compliance_contract,
      assetDescription: r.metadata.asset_description,
      valuation: BigInt(r.metadata.valuation),
      paused: r.metadata.paused,
    },
  };
}

/** All registered assets for `network`, read via the REST API. */
export async function getAllAssets(network: Network): Promise<AssetEntry[]> {
  const raw = await apiGet<RawAssetEntry[]>(`/assets?network=${network}`);
  return raw.map(toAssetEntry);
}

/** A single asset joined with its token metadata, read via the REST API. */
export async function getAssetDetail(network: Network, id: bigint): Promise<AssetDetail> {
  const raw = await apiGet<RawAssetDetail>(`/assets/${id.toString()}?network=${network}`);
  return toAssetDetail(raw);
}

interface RawPlatformStats {
  total_assets: number;
  total_value_locked: string;
  total_holders: number;
}

export interface PlatformStats {
  totalAssets: number;
  totalValueLocked: bigint;
  totalHolders: number;
}

/** Platform-wide headline numbers, including the authoritative holder count. */
export async function getStats(network: Network): Promise<PlatformStats> {
  const raw = await apiGet<RawPlatformStats>(`/stats?network=${network}`);
  return {
    totalAssets: raw.total_assets,
    totalValueLocked: BigInt(raw.total_value_locked),
    totalHolders: raw.total_holders,
  };
}

interface RawHolder {
  address: string;
  balance: string;
}

export interface ApiHolder {
  address: string;
  balance: bigint;
}

/**
 * Holders for a given asset token, as derived by the API's
 * `index_compliance_and_holders` job (allowlist ∩ positive balance, sorted
 * by balance descending). This is the single source of truth for "who holds
 * this asset" — see `hooks/useHolders.ts`.
 */
export async function getHolders(network: Network, tokenContract: string): Promise<ApiHolder[]> {
  const raw = await apiGet<RawHolder[]>(`/assets/${tokenContract}/holders?network=${network}`);
  return raw.map((h) => ({ address: h.address, balance: BigInt(h.balance) }));
}
