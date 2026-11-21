/**
 * Formatting helpers. All monetary valuations are stored on-chain as USD cents
 * (i128); token amounts are integers in the token's own `decimals` base.
 *
 * Localization: number and date formatting is driven by `Intl.*` and an
 * optional `locale` argument. When omitted, the browser locale
 * (`navigator.language`) is used, falling back to "en-US" (e.g. on the server
 * or in non-browser environments). Passing "en-US" explicitly preserves the
 * historical output exactly.
 */

import type { AssetType, ComplianceStatus } from "@/types";
import { ASSET_TYPE_LABELS } from "@/types";

/** Default locale: browser preference when available, else "en-US". */
export function defaultLocale(): string {
  if (typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}

/** Resolve an optional locale argument to a concrete locale string. */
function resolveLocale(locale?: string): string {
  return locale ?? defaultLocale();
}

/** Cache of `Intl.NumberFormat` instances keyed by locale + options. */
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

/** Cache of `Intl.DateTimeFormat` instances keyed by locale + options. */
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Group a non-negative integer bigint with locale-aware separators. Keeps the
 * value in bigint so values beyond Number.MAX_SAFE_INTEGER stay exact.
 */
function groupBigint(n: bigint, locale: string): string {
  const digits = n.toString();
  // Small values never need grouping; avoids Intl overhead on hot paths.
  if (digits.length <= 3) return digits;
  const formatter = getNumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 });
  // Intl.NumberFormat accepts bigint directly, preserving precision.
  return formatter.format(n);
}

/**
 * Format XLM (in stroops, the atomic unit: 1 XLM = 10,000,000 stroops)
 * as a currency string, e.g. 1000000n -> "0.1 XLM".
 * Used for displaying network fees estimated during transaction simulation.
 */
export function formatStroopsToXLM(stroops: bigint | number, locale?: string): string {
  const base = 10_000_000; // Stroops per XLM
  const xlm = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  const whole = xlm / BigInt(base);
  const remainder = xlm % BigInt(base);
  const loc = resolveLocale(locale);

  if (remainder === 0n) {
    return `${groupBigint(whole, loc)} XLM`;
  }

  // Format fractional part with trailing zeros removed
  const fracStr = remainder.toString().padStart(7, "0").replace(/0+$/, "");
  return `${groupBigint(whole, loc)}.${fracStr} XLM`;
}

/**
 * Format USD cents (bigint) as a currency string, e.g. 500000000n -> "$5,000,000".
 * Stays in bigint until the final string conversion so valuations above
 * Number.MAX_SAFE_INTEGER (2^53-1 cents) keep full precision — mirror of how
 * formatTokenAmount already scales raw token amounts.
 */
export function formatUsdCents(
  cents: bigint,
  opts?: { compact?: boolean; locale?: string },
): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const dollars = abs / 100n;
  const remainder = abs % 100n;
  const sign = negative ? "-" : "";
  const loc = resolveLocale(opts?.locale);

  if (opts?.compact && dollars >= 1_000_000n) {
    return `${sign}$${compactBigint(dollars, loc)}`;
  }

  const wholeStr = groupBigint(dollars, loc);
  if (remainder === 0n) {
    return `${sign}$${wholeStr}`;
  }
  const fracStr = remainder.toString().padStart(2, "0");
  return `${sign}$${wholeStr}.${fracStr}`;
}

/** Compact large numbers: 5_000_000 -> "5M", 12_300 -> "12.3K". */
export function compactNumber(n: number, locale?: string): string {
  const abs = Math.abs(n);
  const loc = resolveLocale(locale);
  if (abs >= 1_000_000_000) return trimZero(n / 1_000_000_000, loc) + "B";
  if (abs >= 1_000_000) return trimZero(n / 1_000_000, loc) + "M";
  if (abs >= 1_000) return trimZero(n / 1_000, loc) + "K";
  return getNumberFormat(loc, { maximumFractionDigits: 20 }).format(n);
}

function trimZero(n: number, locale: string): string {
  // One decimal place, locale-aware decimal separator, trailing ".0" removed.
  const formatted = getNumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(n);
  const decimal = getNumberFormat(locale, { useGrouping: false })
    .formatToParts(1.5)
    .find((part) => part.type === "decimal")?.value ?? ".";
  return formatted.endsWith(`${decimal}0`)
    ? formatted.slice(0, -`${decimal}0`.length)
    : formatted;
}

/**
 * Compact a whole-dollar bigint for the `compact` display path. The magnitude is
 * divided in bigint (so it never rounds away precision the way `Number()` on a
 * large cents value would), then the small quotient is formatted.
 */
function compactBigint(n: bigint, locale: string): string {
  const units = [
    { threshold: 1_000_000_000n, divisor: 1_000_000_000n, suffix: "B" },
    { threshold: 1_000_000n, divisor: 1_000_000n, suffix: "M" },
    { threshold: 1_000n, divisor: 1_000n, suffix: "K" },
  ];
  let unitIndex = units.findIndex(({ threshold }) => n >= threshold);
  if (unitIndex < 0) return n.toString();

  let { divisor, suffix } = units[unitIndex]!;
  let tenths = (n * 10n + divisor / 2n) / divisor;
  while (tenths >= 10_000n && unitIndex > 0) {
    ({ divisor, suffix } = units[--unitIndex]!);
    tenths = (n * 10n + divisor / 2n) / divisor;
  }
  const whole = groupBigint(tenths / 10n, locale);
  const fraction = tenths % 10n;
  const decimal = getNumberFormat(locale, { useGrouping: false })
    .formatToParts(1.5)
    .find((part) => part.type === "decimal")?.value ?? ".";
  return `${whole}${fraction === 0n ? "" : `${decimal}${fraction}`}${suffix}`;
}

/**
 * Convert a raw token amount (bigint, in base units) to a human string using
 * the token's decimals. 100000n @ 2 decimals -> "1,000".
 */
export function formatTokenAmount(raw: bigint, decimals: number, locale?: string): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const loc = resolveLocale(locale);
  const wholeStr = groupBigint(whole, loc);
  if (decimals === 0 || frac === 0n) {
    return (negative ? "-" : "") + wholeStr;
  }
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const decimal = getNumberFormat(loc, { useGrouping: false })
    .formatToParts(1.5)
    .find((part) => part.type === "decimal")?.value ?? ".";
  return (negative ? "-" : "") + wholeStr + decimal + fracStr;
}

/**
 * Convert a raw token amount to a plain (un-grouped) decimal string, suitable
 * for pre-filling an editable input. Unlike `formatTokenAmount`, this never
 * inserts thousands separators, so it round-trips through `parseTokenAmount`
 * exactly instead of needing a format → strip-commas → re-parse dance.
 * 100050n @ 2 decimals -> "1000.5".
 */
export function formatRawPlain(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const sign = negative ? "-" : "";
  if (decimals === 0 || frac === 0n) {
    return sign + whole.toString();
  }
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return sign + whole.toString() + "." + fracStr;
}

/**
 * Parse a human-entered decimal string into raw base units for a token.
 * "1,000.5" @ 2 decimals -> 100050n. Throws on malformed input.
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const cleaned = input.replace(/,/g, "").trim();
  // Requires at least one digit on one side of an optional single dot:
  // "5", "5.5", ".5" are valid; "", ".", "5.", "-5", "1e5" are not.
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) {
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

/**
 * Build the detail-page href for an asset id. Asset ids are `bigint`
 * on-chain; interpolating a bigint directly into a template string or URL
 * works today but is easy to get wrong (e.g. mixing bigint and string keys
 * across components). Route all id -> string conversions through here so
 * links and React keys stay consistent.
 */
export function assetHref(id: bigint): string {
  return `/asset/${id.toString()}`;
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

/**
 * A percentage 0–100 with one decimal, clamped.
 * `part` is clamped to `[0, whole]` before the bigint math so the
 * intermediate `* 10000n` product — and the resulting quotient passed to
 * `Number()` — stays bounded regardless of how large the raw operands are.
 * `part > whole` (or negative `part`) is treated as 100% / 0% respectively.
 */
export function percent(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0;
  const clamped = part < 0n ? 0n : part > whole ? whole : part;
  const pct = Number((clamped * 10000n) / whole) / 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Allocate percentage shares across holder rows using largest remainders.
 * The decimal precision grows as needed so every positive balance remains
 * visible, while displayed shares add up to the represented share of supply.
 */
export function holderSharePercentages(balances: bigint[], supply: bigint): string[] {
  if (supply <= 0n) return balances.map(() => "0.00");

  const positive = balances
    .map((balance, index) => ({ balance, index }))
    .filter(({ balance }) => balance > 0n);
  if (positive.length === 0) return balances.map(() => "0.00");

  const totalBalance = positive.reduce((sum, holder) => sum + holder.balance, 0n);
  let decimals = 2;
  let scale = 100n * 10n ** BigInt(decimals);
  let totalUnits = (totalBalance * scale + supply / 2n) / supply;
  while (totalUnits < BigInt(positive.length)) {
    decimals += 1;
    scale *= 10n;
    totalUnits = (totalBalance * scale + supply / 2n) / supply;
  }

  const remainingUnits = totalUnits - BigInt(positive.length);
  const allocations = positive.map(({ balance, index }) => {
    const weighted = remainingUnits * balance;
    return {
      index,
      units: 1n + weighted / totalBalance,
      remainder: weighted % totalBalance,
    };
  });
  let undistributed = totalUnits - allocations.reduce((sum, item) => sum + item.units, 0n);
  const remainderOrder = [...allocations].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (let i = 0; undistributed > 0n; i += 1) {
    const item = remainderOrder[i];
    if (!item) break;
    item.units += 1n;
    undistributed -= 1n;
  }

  const shares = balances.map(() => "0.00");
  const fractionScale = 10n ** BigInt(decimals);
  for (const allocation of allocations) {
    const whole = allocation.units / fractionScale;
    const fraction = (allocation.units % fractionScale).toString().padStart(decimals, "0");
    shares[allocation.index] =
      `${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
  }
  return shares;
}

/** Average Stellar ledger close time. The network's actual close time drifts
 * (historically ~5-6s), so this is a best-effort constant, not a guarantee. */
const AVG_LEDGER_CLOSE_SECONDS = 5.5;

/**
 * Rough wall-clock estimate for a ledger sequence. Error compounds with the
 * distance from `currentLedger`, so the result's precision is clamped to
 * roughly match how much it can be trusted: exact-ish under an hour out,
 * rounded to the hour under a month out, and to the day beyond that. Callers
 * should still label the result as approximate in the UI.
 * Returns null when `ledger` is 0 (used to mean "never expires").
 */
export function ledgerToApproxDate(
  targetLedger: number,
  currentLedger: number,
): Date | null {
  if (!targetLedger) return null;
  const deltaSeconds = (targetLedger - currentLedger) * AVG_LEDGER_CLOSE_SECONDS;
  const estimateMs = Date.now() + deltaSeconds * 1000;
  return new Date(clampPrecision(estimateMs, Math.abs(deltaSeconds)));
}

/** Round `epochMs` so its displayed precision doesn't overstate the estimate's accuracy. */
function clampPrecision(epochMs: number, horizonSeconds: number): number {
  if (horizonSeconds < 3600) return epochMs;
  const roundToMs = horizonSeconds < 30 * 86400 ? 3_600_000 : 86_400_000;
  return Math.round(epochMs / roundToMs) * roundToMs;
}

/**
 * Format a date (or epoch ms) using the locale's conventions. Defaults to a
 * medium date + short time; pass `options` to override.
 */
export function formatDate(
  date: Date | number,
  opts?: { locale?: string; options?: Intl.DateTimeFormatOptions },
): string {
  const loc = resolveLocale(opts?.locale);
  const value = typeof date === "number" ? new Date(date) : date;
  return getDateFormat(loc, opts?.options ?? { dateStyle: "medium", timeStyle: "short" }).format(value);
}

/** Format a date as a locale-aware date only (no time). */
export function formatDateOnly(date: Date | number, locale?: string): string {
  return formatDate(date, { locale, options: { dateStyle: "medium" } });
}

/**
 * Format a date as a locale-aware relative time, e.g. "in 3 days" / "vor 3 Tagen".
 * `now` is injectable for deterministic tests.
 */
export function formatRelativeDate(
  date: Date | number,
  opts?: { locale?: string; now?: Date | number },
): string {
  const loc = resolveLocale(opts?.locale);
  const target = typeof date === "number" ? date : date.getTime();
  const nowMs = opts?.now === undefined
    ? Date.now()
    : typeof opts.now === "number" ? opts.now : opts.now.getTime();
  const diffSeconds = Math.round((target - nowMs) / 1000);
  const formatter = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(0, "second");
}
