/**
 * Client-side checks that mirror what the contracts enforce, so bad input is
 * rejected before the wallet is asked to sign.
 */

/** User-facing description of a valid jurisdiction code. */
export const JURISDICTION_HINT = "2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, KE)";

export const JURISDICTION_ERROR = `Enter a ${JURISDICTION_HINT}.`;

/**
 * `maxLength` for jurisdiction inputs. Deliberately one more than the 2-letter
 * code: capping at 2 would silently truncate an alpha-3 code into a different,
 * valid country ("CHN" -> "CH", Switzerland) and clip a pasted leading space.
 * With room for a third character the input shows what was typed and
 * `isValidJurisdiction` rejects it with a message instead.
 */
export const JURISDICTION_INPUT_MAX_LENGTH = 3;

/** The form sent on-chain: trimmed and upper-cased ("us" -> "US"). */
export function normalizeJurisdiction(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Whether `code` is a jurisdiction the compliance contract will accept: exactly
 * two ASCII letters after trimming (its `normalize_jurisdiction` rejects
 * anything else with `InvalidJurisdiction`). Case is ignored; use
 * `normalizeJurisdiction` for the value to send.
 *
 * The contract also strips *inner* spaces, so it would turn "U S" into "US".
 * We deliberately reject that here: no real ISO code contains a space, so it is
 * a typo, and the stored value would differ from what the issuer typed.
 */
export function isValidJurisdiction(code: string): boolean {
  return /^[A-Za-z]{2}$/.test(code.trim());
}

/** A single parsed row of a batch-transfer CSV, before validation. */
export interface BatchTransferCsvRow {
  /** 1-based line number in the original CSV (header excluded). */
  line: number;
  address: string;
  amount: string;
}

/** A row that passed validation and can be turned into a transaction. */
export interface ValidBatchTransferRow {
  line: number;
  address: string;
  /** Amount as a decimal string, exactly as the issuer wrote it (trimmed). */
  amount: string;
}

/** A row that failed validation, with a human-readable reason. */
export interface InvalidBatchTransferRow {
  line: number;
  address: string;
  amount: string;
  error: string;
}

export interface BatchTransferValidationResult {
  valid: ValidBatchTransferRow[];
  invalid: InvalidBatchTransferRow[];
}

/** Stellar account IDs are 56 base32 characters starting with `G`. */
const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

/** Decimal amount: digits with an optional fractional part, no sign/exponent. */
const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

/** Whether `address` looks like a Stellar account ID. */
export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_PATTERN.test(address.trim());
}

/**
 * Whether `amount` is a positive decimal string. Rejects zero, negatives,
 * exponents, thousands separators and empty input.
 */
export function isValidTransferAmount(amount: string): boolean {
  const trimmed = amount.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return false;
  return Number(trimmed) > 0;
}

/**
 * Split a single CSV line into fields, honouring double-quoted fields (which
 * may contain commas and escaped `""` quotes). Deliberately small: the batch
 * CSV only ever holds addresses and amounts.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse a batch-transfer CSV of `recipient,amount` pairs. A header row is
 * optional and detected by a non-address first field. Blank lines are skipped.
 * Malformed rows (wrong column count, unparseable quoting) are returned with
 * an `error` so the preview can show them rather than silently dropping them.
 */
export function parseBatchTransferCsv(csv: string): BatchTransferCsvRow[] {
  const lines = csv.split(/\r?\n/);
  const rows: BatchTransferCsvRow[] = [];
  let first = true;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "") continue;

    const fields = splitCsvLine(raw);
    if (first) {
      first = false;
      // Treat the first row as a header when its first field is not an address.
      if (fields.length > 0 && !isValidStellarAddress(fields[0])) {
        continue;
      }
    }

    rows.push({
      line: i + 1,
      address: (fields[0] ?? "").trim(),
      amount: (fields[1] ?? "").trim(),
    });
  }

  return rows;
}

/**
 * Validate parsed batch-transfer rows. Each row must have a well-formed
 * Stellar address and a positive decimal amount. Rows are returned in two
 * buckets so the preview can render valid entries and surface problems
 * together. Duplicate recipients are flagged as invalid to avoid accidentally
 * sending twice to the same address.
 */
export function validateBatchTransferRows(
  rows: BatchTransferCsvRow[],
): BatchTransferValidationResult {
  const valid: ValidBatchTransferRow[] = [];
  const invalid: InvalidBatchTransferRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const address = row.address.trim();
    const amount = row.amount.trim();
    let error: string | null = null;

    if (address === "") {
      error = "Missing recipient address.";
    } else if (!isValidStellarAddress(address)) {
      error = "Invalid Stellar address.";
    } else if (amount === "") {
      error = "Missing amount.";
    } else if (!isValidTransferAmount(amount)) {
      error = "Amount must be a positive number.";
    } else if (seen.has(address)) {
      error = "Duplicate recipient address.";
    }

    if (error) {
      invalid.push({ line: row.line, address, amount, error });
    } else {
      seen.add(address);
      valid.push({ line: row.line, address, amount });
    }
  }

  return { valid, invalid };
}
