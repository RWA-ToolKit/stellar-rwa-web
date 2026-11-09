"use client";

import { compliance } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { ComplianceStatus, KycRecord } from "@/types";

export interface ComplianceInfo {
  /** Passes the on-chain gate: approved, unexpired, not in a blocked jurisdiction. */
  allowed: boolean;
  status: ComplianceStatus | "None";
  record: KycRecord | null;
}

/**
 * The compliance status of `address` against a specific compliance contract.
 * Combines the authoritative `is_allowed` gate with the raw KYC record so the
 * UI can explain *why* an address is or isn't permitted.
 *
 * Empty-input behaviour (#632): when `complianceId` or `address` is `null`,
 * empty (`""`), or whitespace-only, `useAsync` is disabled (`enabled = false`).
 * The hook therefore returns `{ data: null, loading: false, error: null }`
 * without issuing any Soroban RPC requests, and clears any previously loaded
 * `data` if an input becomes empty mid-session (e.g. wallet disconnect).
 */
export function useCompliance(complianceId: string | null, address: string | null) {
  const { network } = useWallet();
  const normalizedComplianceId = complianceId?.trim() || null;
  const normalizedAddress = address?.trim() || null;
  return useAsync<ComplianceInfo>(
    async () => {
      if (!normalizedComplianceId || !normalizedAddress) {
        return { allowed: false, status: "None", record: null };
      }
      const [allowed, record] = await Promise.all([
        compliance.isAllowed(network, normalizedComplianceId, normalizedAddress),
        compliance.getRecord(network, normalizedComplianceId, normalizedAddress),
      ]);
      return {
        allowed,
        status: record?.status ?? "None",
        record,
      };
    },
    [normalizedComplianceId, normalizedAddress, network],
    Boolean(normalizedComplianceId && normalizedAddress),
  );
}

export interface JurisdictionStatus {
  /** ISO country code as recorded on the allowlist, e.g. "US". */
  code: string;
  blocked: boolean;
}

export interface ComplianceOverview {
  /** Number of addresses on the KYC allowlist. */
  allowlistSize: number;
  /** Jurisdictions represented on the allowlist, with their block status. */
  jurisdictions: JurisdictionStatus[];
}

/**
 * Public, read-only summary of a compliance contract — for anyone inspecting an
 * asset, not just its issuer.
 *
 * The contract has no method that enumerates blocked jurisdictions, so the
 * codes checked here are the distinct ones on the allowlist's own KYC records.
 * A jurisdiction blocked before any address from it was ever approved therefore
 * won't appear.
 */
export function useComplianceOverview(complianceId: string | null) {
  const { network } = useWallet();
  const normalizedComplianceId = complianceId?.trim() || null;
  return useAsync<ComplianceOverview>(
    async () => {
      if (!normalizedComplianceId) return { allowlistSize: 0, jurisdictions: [] };
      const addresses = await compliance.getAllowlist(network, normalizedComplianceId);
      const records = await Promise.all(
        addresses.map((a) => compliance.getRecord(network, normalizedComplianceId, a)),
      );
      const codes = [
        ...new Set(
          records.flatMap((r) => (r?.jurisdiction ? [r.jurisdiction] : [])),
        ),
      ].sort();
      const jurisdictions = await Promise.all(
        codes.map(async (code) => ({
          code,
          blocked: await compliance.isJurisdictionBlocked(
            network,
            normalizedComplianceId,
            code,
          ),
        })),
      );
      return {
        allowlistSize: addresses.length,
        jurisdictions,
      };
    },
    [normalizedComplianceId, network],
    Boolean(normalizedComplianceId),
  );
}

/** Full KYC allowlist (with records) for a compliance contract — issuer views. */
export function useAllowlist(complianceId: string | null) {
  const { network } = useWallet();
  const normalizedComplianceId = complianceId?.trim() || null;
  return useAsync<KycRecord[]>(
    async () => {
      if (!normalizedComplianceId) return [];
      const addresses = await compliance.getAllowlist(network, normalizedComplianceId);
      const records = await Promise.all(
        addresses.map((a) => compliance.getRecord(network, normalizedComplianceId, a)),
      );
      return records.filter((r): r is KycRecord => r !== null);
    },
    [normalizedComplianceId, network],
    Boolean(normalizedComplianceId),
  );
}
