import type { AssetEntry, AssetMetadata, Network, KycRecord, Distribution } from "@/types";

const BASE = typeof process !== "undefined"
  ? process.env.NEXT_PUBLIC_API_URL
  : undefined;

function apiUrl(path: string): string {
  if (!BASE) return "";
  return `${BASE.replace(/\/+$/, "")}${path}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export interface ApiAssetEntry {
  id: string;
  tokenContract: string;
  issuer: string;
  name: string;
  assetType: string;
  valuation: string;
  createdAt: number;
  active: boolean;
}

export interface ApiPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiStatsResult {
  totalAssets: number;
  tvl: string;
  totalHolders: number;
}

export interface ApiHolderResult {
  address: string;
  balance: string;
}

function toAssetEntry(a: ApiAssetEntry): AssetEntry {
  return {
    id: BigInt(a.id),
    tokenContract: a.tokenContract,
    issuer: a.issuer,
    name: a.name,
    assetType: a.assetType,
    valuation: BigInt(a.valuation),
    createdAt: a.createdAt,
    active: a.active,
  };
}

export const api = {
  getAssets(page = 1, pageSize = 20, type?: string, sort?: string): Promise<ApiPaginatedResult<ApiAssetEntry> | null> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (type) params.set("type", type);
    if (sort) params.set("sort", sort);
    return fetchJson<ApiPaginatedResult<ApiAssetEntry>>(apiUrl(`/assets?${params}`));
  },

  async getAllAssets(): Promise<AssetEntry[] | null> {
    const raw = await fetchJson<ApiPaginatedResult<ApiAssetEntry>>(apiUrl("/assets?pageSize=500"));
    if (!raw) return null;
    return raw.data.map(toAssetEntry);
  },

  async getAsset(id: bigint): Promise<AssetEntry | null> {
    const raw = await fetchJson<ApiAssetEntry>(apiUrl(`/assets/${id}`));
    return raw ? toAssetEntry(raw) : null;
  },

  async getAssetsByIssuer(issuer: string): Promise<AssetEntry[] | null> {
    const raw = await fetchJson<ApiPaginatedResult<ApiAssetEntry>>(apiUrl(`/assets?issuer=${encodeURIComponent(issuer)}&pageSize=500`));
    if (!raw) return null;
    return raw.data.map(toAssetEntry);
  },

  getStats(): Promise<ApiStatsResult | null> {
    return fetchJson<ApiStatsResult>(apiUrl("/stats"));
  },

  async getHolders(tokenContract: string): Promise<{ address: string; balance: bigint }[] | null> {
    const raw = await fetchJson<ApiHolderResult[]>(apiUrl(`/assets/${encodeURIComponent(tokenContract)}/holders`));
    if (!raw) return null;
    return raw.map((h) => ({ address: h.address, balance: BigInt(h.balance) }));
  },
};
