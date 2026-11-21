export interface HolderCsvRow {
  address: string;
  balance: string | number;
  [key: string]: unknown;
}

export interface HolderCsvMetadata {
  assetName?: string;
  assetSymbol?: string;
  issuer?: string;
  [key: string]: unknown;
}

export interface DistributionCsvRow {
  [key: string]: unknown;
}

/**
 * Escapes a single CSV field according to RFC 4180.
 * Fields containing commas, quotes, or newlines are wrapped in double quotes,
 * and any embedded double quotes are doubled.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes a header row and data rows into an RFC 4180 CSV string.
 * Rows are terminated with CRLF.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];

  lines.push(headers.map(escapeCsvField).join(','));

  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Serializes a holder list into a CSV string.
 * Includes optional metadata columns (asset name, symbol, issuer) when provided.
 */
export function holdersToCsv(
  holders: HolderCsvRow[],
  metadata?: HolderCsvMetadata,
): string {
  const headers: string[] = ['Address', 'Balance'];
  const metaColumns: Array<{ key: keyof HolderCsvMetadata; label: string }> = [];

  if (metadata) {
    if (metadata.assetName !== undefined) {
      metaColumns.push({ key: 'assetName', label: 'Asset Name' });
    }
    if (metadata.assetSymbol !== undefined) {
      metaColumns.push({ key: 'assetSymbol', label: 'Asset Symbol' });
    }
    if (metadata.issuer !== undefined) {
      metaColumns.push({ key: 'issuer', label: 'Issuer' });
    }
  }

  for (const col of metaColumns) {
    headers.push(col.label);
  }

  const rows = (holders ?? []).map((holder) => {
    const row: unknown[] = [holder.address, holder.balance];
    for (const col of metaColumns) {
      row.push(metadata ? metadata[col.key] : '');
    }
    return row;
  });

  return toCsv(headers, rows);
}

/**
 * Serializes a distribution history into a CSV string.
 * Column order is derived from the union of keys across all rows, with
 * commonly used fields placed first when present.
 */
export function distributionsToCsv(distributions: DistributionCsvRow[]): string {
  const preferredOrder = [
    'id',
    'date',
    'timestamp',
    'assetName',
    'assetSymbol',
    'amount',
    'totalAmount',
    'currency',
    'recipientCount',
    'status',
    'txHash',
  ];

  const keySet = new Set<string>();
  for (const dist of distributions ?? []) {
    for (const key of Object.keys(dist)) {
      keySet.add(key);
    }
  }

  const orderedKeys: string[] = [];
  for (const key of preferredOrder) {
    if (keySet.has(key)) {
      orderedKeys.push(key);
      keySet.delete(key);
    }
  }
  for (const key of keySet) {
    orderedKeys.push(key);
  }

  const headers = orderedKeys.map((key) => formatHeader(key));

  const rows = (distributions ?? []).map((dist) =>
    orderedKeys.map((key) => dist[key]),
  );

  return toCsv(headers, rows);
}

function formatHeader(key: string): string {
  // Convert camelCase / snake_case keys into human-readable headers.
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  return spaced
    .split(/\s+/)
    .map((word) =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ');
}

/**
 * Builds a CSV Blob and triggers a client-side download via an object URL.
 * Safe to call in non-browser environments (no-op when unavailable).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the object URL on the next tick to allow the download to start.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}