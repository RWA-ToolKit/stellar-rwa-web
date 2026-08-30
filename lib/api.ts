import type { AssetEntry, AssetMetadata, Network, KycRecord, Distribution } from "@/types";

const BASE = typeof process !== "undefined"
  ? process.env.NEXT_PUBLIC_API_URL
  : undefined;

function apiUrl(path: string): string {
  if (!BASE) return "";
  return `${BASE.replace(/\/+$/, "")}${path}`;
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new ApiError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status,
      );
    }
    return res.json();
  } catch (err) {
    const error = err instanceof ApiError ? err : new ApiError(
      err instanceof Error ? err.message : String(err),
      undefined,
      err instanceof Error ? err : undefined,
    );
    console.error("API fetch failed:", error.message, { url, error });
    throw error;
  }
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

  async getAllAssets(network?: Network): Promise<AssetEntry[] | null> {
    const all: AssetEntry[] = [];
    let page = 1;
    const pageSize = 500;
    
    while (true) {
      const params = new URLSearchParams({ 
        page: String(page), 
        pageSize: String(pageSize) 
      });
      if (network) params.set("network", network);
      
      const raw = await fetchJson<ApiPaginatedResult<ApiAssetEntry>>(apiUrl(`/assets?${params}`));
      if (!raw) return null;
      
      all.push(...raw.data.map(toAssetEntry));
      
      if (page >= raw.totalPages) break;
      page++;
    }
    
    return all;
  },

  async getAsset(id: bigint): Promise<AssetEntry | null> {
    const raw = await fetchJson<ApiAssetEntry>(apiUrl(`/assets/${id}`));
    return raw ? toAssetEntry(raw) : null;
  },

  async getAssetsByIssuer(issuer: string, network?: Network): Promise<AssetEntry[] | null> {
    const all: AssetEntry[] = [];
    let page = 1;
    const pageSize = 500;
    
    while (true) {
      const params = new URLSearchParams({ 
        issuer: issuer,
        page: String(page), 
        pageSize: String(pageSize) 
      });
      if (network) params.set("network", network);
      
      const raw = await fetchJson<ApiPaginatedResult<ApiAssetEntry>>(apiUrl(`/assets?${params}`));
      if (!raw) return null;
      
      all.push(...raw.data.map(toAssetEntry));
      
      if (page >= raw.totalPages) break;
      page++;
    }
    
    return all;
  },

  getStats(network?: Network): Promise<ApiStatsResult | null> {
    const params = new URLSearchParams();
    if (network) params.set("network", network);
    const qs = params.toString();
    return fetchJson<ApiStatsResult>(apiUrl(`/stats${qs ? "?" + qs : ""}`));
  },

  async getHolders(tokenContract: string): Promise<{ address: string; balance: bigint }[] | null> {
    const raw = await fetchJson<ApiHolderResult[]>(apiUrl(`/assets/${encodeURIComponent(tokenContract)}/holders`));
    if (!raw) return null;
    return raw.map((h) => ({ address: h.address, balance: BigInt(h.balance) }));
  },
};
