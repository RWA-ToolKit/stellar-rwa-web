/**
 * Formatting helpers. All monetary valuations are stored on-chain as USD cents
 * (i128); token amounts are integers in the token's own `decimals` base.
 */

import type { AssetType, ComplianceStatus } from "@/types";
import { ASSET_TYPE_LABELS } from "@/types";

/** Format USD cents (bigint) as a currency string, e.g. 500000000n -> "$5,000,000". */
export function formatUsdCents(cents: bigint, opts?: { compact?: boolean }): string {
  const dollars = Number(cents) / 100;
  if (opts?.compact && Math.abs(dollars) >= 1_000_000) {
    return "$" + compactNumber(dollars);
  }
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Compact large numbers: 5_000_000 -> "5M", 12_300 -> "12.3K". */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return trimZero(n / 1_000_000_000) + "B";
  if (abs >= 1_000_000) return trimZero(n / 1_000_000) + "M";
  if (abs >= 1_000) return trimZero(n / 1_000) + "K";
  return String(n);
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Convert a raw token amount (bigint, in base units) to a human string using
 * the token's decimals. 100000n @ 2 decimals -> "1,000".
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const wholeStr = whole.toLocaleString("en-US");
  if (decimals === 0 || frac === 0n) {
    return (negative ? "-" : "") + wholeStr;
  }
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return (negative ? "-" : "") + wholeStr + "." + fracStr;
}

/**
 * Parse a human-entered decimal string into raw base units for a token.
 * "1,000.5" @ 2 decimals -> 100050n. Throws on malformed input.
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === "" || cleaned === ".") {
    throw new Error("Enter a valid number");
  }
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > decimals) {
    throw new Error(`Maximum ${decimals} decimal places`);
  }
  const paddedFrac = frac.padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(paddedFrac || "0");
}

/** Parse a USD dollar string into i128 cents. "5,000,000" -> 500000000n. */
export function parseUsdToCents(input: string): bigint {
  return parseTokenAmount(input, 2);
}

/** Truncate a Stellar address for display: G/C... + last 4. */
export function truncateAddress(addr: string, lead = 4, tail = 4): string {
  if (!addr || addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type as AssetType] ?? titleCase(type);
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function complianceStatusLabel(status: ComplianceStatus): string {
  return status;
}

/** A percentage 0–100 with one decimal, clamped. */
export function percent(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0;
  const pct = Number((part * 10000n) / whole) / 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Rough wall-clock estimate for a future ledger sequence, assuming ~5s ledgers.
 * Returns null when `ledger` is 0 (used to mean "never expires").
 */
export function ledgerToApproxDate(
  targetLedger: number,
  currentLedger: number,
): Date | null {
  if (!targetLedger) return null;
  const deltaSeconds = (targetLedger - currentLedger) * 5;
  return new Date(Date.now() + deltaSeconds * 1000);
}
