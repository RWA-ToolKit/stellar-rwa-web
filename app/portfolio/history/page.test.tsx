import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import HistoryPage from './page';

jest.mock('@/hooks/useWallet', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/hooks/usePortfolio', () => ({
  usePortfolio: jest.fn(),
}));

jest.mock('@/hooks/useActivity', () => ({
  useActivity: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useWallet } = require('@/hooks/useWallet');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usePortfolio } = require('@/hooks/usePortfolio');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useActivity } = require('@/hooks/useActivity');

type Activity = {
  id: string;
  type: string;
  assetCode: string;
  amount: string;
  timestamp: string;
};

const makeActivity = (
  id: string,
  assetCode: string,
  timestamp: string,
  type = 'transfer',
): Activity => ({
  id,
  type,
  assetCode,
  amount: '10',
  timestamp,
});

const setupWallet = (connected: boolean, address = 'GABC123') => {
  useWallet.mockReturnValue({
    connected,
    address: connected ? address : null,
    isConnected: connected,
  });
};

const setupPortfolio = (assets: Array<{ code: string; issuer?: string }>) => {
  usePortfolio.mockReturnValue({
    assets,
    holdings: assets,
    isLoading: false,
    error: null,
  });
};

const setupActivity = (byAsset: Record<string, Activity[]>) => {
  useActivity.mockImplementation((assetCode?: string) => ({
    activities: assetCode ? byAsset[assetCode] ?? [] : [],
    isLoading: false,
    error: null,
  }));
};

describe('Portfolio History Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the disconnected-wallet prompt when no wallet is connected', () => {
    setupWallet(false);
    setupPortfolio([]);
    setupActivity({});

    render(<HistoryPage />);

    expect(
      screen.getByText(/connect your wallet/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders the empty state when the wallet holds nothing', () => {
    setupWallet(true);
    setupPortfolio([]);
    setupActivity({});

    render(<HistoryPage />);

    expect(
      screen.getByText(/no transaction history/i),
    ).toBeInTheDocument();
  });

  it('renders the empty state when held assets have no activity', () => {
    setupWallet(true);
    setupPortfolio([{ code: 'USDC' }, { code: 'XLM' }]);
    setupActivity({ USDC: [], XLM: [] });

    render(<HistoryPage />);

    expect(
      screen.getByText(/no transaction history/i),
    ).toBeInTheDocument();
  });

  it('renders a merged chronological list across multiple assets', () => {
    setupWallet(true);
    setupPortfolio([{ code: 'USDC' }, { code: 'XLM' }]);
    setupActivity({
      USDC: [
        makeActivity('u1', 'USDC', '2024-01-01T10:00:00.000Z'),
        makeActivity('u2', 'USDC', '2024-01-03T10:00:00.000Z'),
      ],
      XLM: [
        makeActivity('x1', 'XLM', '2024-01-02T10:00:00.000Z'),
        makeActivity('x2', 'XLM', '2024-01-04T10:00:00.000Z'),
      ],
    });

    render(<HistoryPage />);

    const rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(4);

    const assetCodes = rows.map(
      (row) => within(row).getByTestId('history-asset').textContent,
    );
    expect(assetCodes).toEqual(['USDC', 'XLM', 'USDC', 'XLM']);
  });

  it('sorts merged activity by timestamp in the correct order', () => {
    setupWallet(true);
    setupPortfolio([{ code: 'USDC' }, { code: 'XLM' }]);
    setupActivity({
      USDC: [
        makeActivity('u1', 'USDC', '2024-02-01T00:00:00.000Z'),
        makeActivity('u2', 'USDC', '2024-02-03T00:00:00.000Z'),
      ],
      XLM: [
        makeActivity('x1', 'XLM', '2024-02-02T00:00:00.000Z'),
        makeActivity('x2', 'XLM', '2024-02-04T00:00:00.000Z'),
      ],
    });

    render(<HistoryPage />);

    const rows = screen.getAllByTestId('history-row');
    const ids = rows.map((row) => row.getAttribute('data-activity-id'));
    expect(ids).toEqual(['u1', 'x1', 'u2', 'x2']);
  });

  it('advances and retreats pages using pagination controls', () => {
    setupWallet(true);
    setupPortfolio([{ code: 'USDC' }]);

    const activities: Activity[] = Array.from({ length: 25 }, (_, i) =>
      makeActivity(
        `a${i}`,
        'USDC',
        new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
      ),
    );
    setupActivity({ USDC: activities });

    render(<HistoryPage />);

    // First page shows the first page of rows (default page size 10).
    let rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(10);
    expect(rows[0].getAttribute('data-activity-id')).toBe('a0');

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(10);
    expect(rows[0].getAttribute('data-activity-id')).toBe('a10');

    fireEvent.click(nextButton);

    rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(5);
    expect(rows[0].getAttribute('data-activity-id')).toBe('a20');

    const prevButton = screen.getByRole('button', { name: /previous/i });
    fireEvent.click(prevButton);

    rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(10);
    expect(rows[0].getAttribute('data-activity-id')).toBe('a10');

    fireEvent.click(prevButton);

    rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(10);
    expect(rows[0].getAttribute('data-activity-id')).toBe('a0');
  });

  it('disables pagination controls at the boundaries', () => {
    setupWallet(true);
    setupPortfolio([{ code: 'USDC' }]);
    setupActivity({
      USDC: Array.from({ length: 15 }, (_, i) =>
        makeActivity(
          `a${i}`,
          'USDC',
          new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
        ),
      ),
    });

    render(<HistoryPage />);

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });
});