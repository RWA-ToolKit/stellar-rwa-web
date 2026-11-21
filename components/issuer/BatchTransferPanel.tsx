'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useCompliance } from '@/hooks/useCompliance';
import { useTx } from '@/hooks/useTx';

export interface BatchTransferRow {
  id: string;
  recipient: string;
  amount: string;
  amountValue: number | null;
  valid: boolean;
  reason: string | null;
}

export interface ParsedCsvResult {
  rows: BatchTransferRow[];
  errors: string[];
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Parse a raw CSV string of `recipient,amount` pairs into batch transfer rows.
 * Lines starting with `#` and blank lines are ignored. A header row containing
 * "recipient" and "amount" (case-insensitive) is skipped.
 */
export function parseCsv(raw: string): ParsedCsvResult {
  const errors: string[] = [];
  const rows: BatchTransferRow[] = [];

  if (!raw || !raw.trim()) {
    return { rows, errors: ['CSV file is empty.'] };
  }

  const lines = raw.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const cells = trimmed.split(',').map((cell) => cell.trim());

    // Skip a header row.
    if (
      index === 0 &&
      cells.length >= 2 &&
      cells[0].toLowerCase() === 'recipient' &&
      cells[1].toLowerCase() === 'amount'
    ) {
      return;
    }

    if (cells.length < 2) {
      errors.push(`Line ${index + 1}: expected "recipient,amount".`);
      return;
    }

    const [recipient, amount] = cells;
    const amountValue = Number(amount);
    const amountValid = amount !== '' && Number.isFinite(amountValue) && amountValue > 0;

    rows.push({
      id: `row-${index}-${recipient}`,
      recipient,
      amount,
      amountValue: amountValid ? amountValue : null,
      valid: false, // finalized during validation
      reason: null,
    });
  });

  return { rows, errors };
}

export interface BatchTransferPanelProps {
  /** Optional asset symbol shown in the preview header. */
  assetSymbol?: string;
  /** Optional callback invoked after a successful batch submission. */
  onSubmitted?: (count: number) => void;
}

export default function BatchTransferPanel({
  assetSymbol,
  onSubmitted,
}: BatchTransferPanelProps) {
  const { checkCompliance } = useCompliance();
  const { sendBatch } = useTx();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<BatchTransferRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);

  const validateRows = useCallback(
    async (parsed: BatchTransferRow[]): Promise<BatchTransferRow[]> => {
      const validated: BatchTransferRow[] = [];

      for (const row of parsed) {
        if (!ADDRESS_REGEX.test(row.recipient)) {
          validated.push({
            ...row,
            valid: false,
            reason: 'Invalid recipient address format.',
          });
          continue;
        }

        if (row.amountValue === null) {
          validated.push({
            ...row,
            valid: false,
            reason: 'Amount must be a positive number.',
          });
          continue;
        }

        try {
          const status = await checkCompliance(row.recipient);
          if (!status) {
            validated.push({
              ...row,
              valid: false,
              reason: 'Recipient is not KYC/compliance approved.',
            });
            continue;
          }
        } catch (err) {
          validated.push({
            ...row,
            valid: false,
            reason: 'Unable to verify compliance status.',
          });
          continue;
        }

        validated.push({ ...row, valid: true, reason: null });
      }

      return validated;
    },
    [checkCompliance],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setSubmitError(null);
      setSubmittedCount(null);

      if (!file) {
        setFileName(null);
        setRows([]);
        setParseErrors([]);
        return;
      }

      setFileName(file.name);

      try {
        const text = await file.text();
        const { rows: parsed, errors } = parseCsv(text);
        setParseErrors(errors);
        const validated = await validateRows(parsed);
        setRows(validated);
      } catch (err) {
        setParseErrors(['Failed to read CSV file.']);
        setRows([]);
      }
    },
    [validateRows],
  );

  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows]);
  const invalidCount = rows.length - validRows.length;

  const handleSubmit = useCallback(async () => {
    if (validRows.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const transfers = validRows.map((row) => ({
        to: row.recipient,
        amount: row.amountValue as number,
      }));

      await sendBatch(transfers);
      setSubmittedCount(transfers.length);
      setRows([]);
      setParseErrors([]);
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onSubmitted?.(transfers.length);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit batch transfer.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [validRows, submitting, sendBatch, onSubmitted]);

  return (
    <section className="batch-transfer-panel" aria-label="Batch transfer">
      <header className="batch-transfer-panel__header">
        <h2>Batch Transfer{assetSymbol ? ` — ${assetSymbol}` : ''}</h2>
        <p>
          Upload a CSV of <code>recipient,amount</code> pairs to distribute tokens
          to multiple KYC-approved addresses at once.
        </p>
      </header>

      <div className="batch-transfer-panel__upload">
        <label htmlFor="batch-transfer-csv">CSV file</label>
        <input
          id="batch-transfer-csv"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
        />
        {fileName && <span className="batch-transfer-panel__filename">{fileName}</span>}
      </div>

      {parseErrors.length > 0 && (
        <ul className="batch-transfer-panel__errors" role="alert">
          {parseErrors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <>
          <div className="batch-transfer-panel__summary">
            <span>{rows.length} row(s)</span>
            <span>{validRows.length} valid</span>
            <span>{invalidCount} invalid</span>
          </div>

          <table className="batch-transfer-panel__preview">
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={row.valid ? 'row--valid' : 'row--invalid'}
                  data-valid={row.valid}
                >
                  <td>{row.recipient}</td>
                  <td>{row.amount}</td>
                  <td>{row.valid ? 'Valid' : 'Invalid'}</td>
                  <td>{row.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {submitError && (
        <p className="batch-transfer-panel__submit-error" role="alert">
          {submitError}
        </p>
      )}

      {submittedCount !== null && (
        <p className="batch-transfer-panel__success" role="status">
          Successfully submitted {submittedCount} transfer(s).
        </p>
      )}

      <div className="batch-transfer-panel__actions">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={validRows.length === 0 || submitting}
        >
          {submitting
            ? 'Submitting…'
            : `Submit ${validRows.length} transfer(s)`}
        </button>
      </div>
    </section>
  );
}