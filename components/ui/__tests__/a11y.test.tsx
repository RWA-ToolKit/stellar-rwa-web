/**
 * Automated accessibility audit for core UI components.
 * Uses jest-axe to run axe-core rules against rendered HTML and assert no violations.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { TxProgress } from '../TxProgress';
import { Spinner, LoadingPanel } from '../Spinner';
import { CopyButton } from '../CopyButton';

// TxProgress internally calls useWallet and explorerTxUrl
jest.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({ network: 'testnet' }),
}));

jest.mock('@/lib/stellar', () => ({
  explorerTxUrl: (_network: string, hash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${hash}`,
}));

// Mock navigator.clipboard so CopyButton's canUseClipboardApi() returns true
// without needing a real secure context in jsdom.
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

// ─── EmptyState ──────────────────────────────────────────────────────────────

describe('EmptyState – axe', () => {
  it('has no violations with title only', async () => {
    const { container } = render(<EmptyState title="No assets found" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with all props', async () => {
    const { container } = render(
      <EmptyState
        title="No assets found"
        description="Try adjusting your filters to see more results."
        icon={<span aria-hidden="true">📭</span>}
        action={<button type="button">Reset filters</button>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ─── ErrorState ──────────────────────────────────────────────────────────────

describe('ErrorState – axe', () => {
  it('has no violations with message only', async () => {
    const { container } = render(
      <ErrorState message="Failed to load assets." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with title, message and retry button', async () => {
    const { container } = render(
      <ErrorState
        title="Network error"
        message="Unable to reach the Soroban RPC endpoint."
        onRetry={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ─── TxProgress ──────────────────────────────────────────────────────────────

describe('TxProgress – axe', () => {
  const pendingPhases = ['building', 'signing', 'submitting', 'confirming'] as const;

  it.each(pendingPhases)(
    'has no violations in pending phase: %s',
    async (phase) => {
      const { container } = render(
        <TxProgress phase={phase} hash={null} error={null} />,
      );
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('has no violations in error phase', async () => {
    const { container } = render(
      <TxProgress
        phase="error"
        hash={null}
        error="Insufficient balance for transfer."
        onDismiss={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in success phase without hash', async () => {
    const { container } = render(
      <TxProgress
        phase="success"
        hash={null}
        error={null}
        successMessage="Transaction confirmed."
        onDismiss={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in success phase with explorer link', async () => {
    const { container } = render(
      <TxProgress
        phase="success"
        hash="abc123def456"
        error={null}
        successMessage="Transaction confirmed."
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ─── Spinner / LoadingPanel ───────────────────────────────────────────────────

describe('Spinner – axe', () => {
  it('has no violations with default props', async () => {
    const { container } = render(<Spinner />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with explicit label', async () => {
    const { container } = render(<Spinner label="Loading compliance records" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoadingPanel – axe', () => {
  it('has no violations', async () => {
    const { container } = render(<LoadingPanel label="Fetching assets…" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ─── CopyButton ───────────────────────────────────────────────────────────────

describe('CopyButton – axe', () => {
  it('has no violations in idle state (icon only)', async () => {
    const { container } = render(
      <CopyButton value="CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in idle state with label', async () => {
    const { container } = render(
      <CopyButton
        value="CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ"
        label="Copy address"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
