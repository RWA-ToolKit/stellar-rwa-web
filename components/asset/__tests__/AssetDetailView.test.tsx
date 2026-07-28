import React from 'react';
import { render, screen } from '@testing-library/react';
import { AssetDetailView } from '../AssetDetailView';
import * as useAssetModule from '@/hooks/useAsset';
import * as useDividendsModule from '@/hooks/useDividends';
import * as useWalletModule from '@/hooks/useWallet';
import * as useAsyncModule from '@/hooks/useAsync';
import type { AssetDetail } from '@/types';

// Mock stellar imports before importing the hooks
jest.mock('@/lib/stellar', () => ({
  getLatestLedger: jest.fn(),
  explorerContractUrl: jest.fn((network: string, contract: string) => `https://explorer.${network}/${contract}`),
}));

// Mock the hooks
jest.mock('@/hooks/useAsset');
jest.mock('@/hooks/useDividends');
jest.mock('@/hooks/useWallet');
jest.mock('@/hooks/useAsync');

// Mock child components to simplify testing
jest.mock('../AssetHeader', () => ({
  AssetHeader: ({ asset }: any) => <div data-testid="asset-header">{asset.name}</div>,
}));
jest.mock('../AssetStats', () => ({
  AssetStats: () => <div data-testid="asset-stats">Stats</div>,
}));
jest.mock('../TransferPanel', () => ({
  TransferPanel: () => <div data-testid="transfer-panel">Transfer</div>,
}));
jest.mock('../HolderList', () => ({
  HolderList: ({ onCount }: any) => {
    // Call onCount in an effect to avoid setState during render warning
    React.useEffect(() => {
      onCount?.(10);
    }, [onCount]);
    return <div data-testid="holder-list">Holders</div>;
  },
}));
jest.mock('@/components/dividend/DistributionCard', () => ({
  DistributionCard: () => <div data-testid="distribution-card">Distribution</div>,
}));
jest.mock('@/components/ui/Spinner', () => ({
  LoadingPanel: ({ label }: any) => <div data-testid="loading">{label}</div>,
}));
jest.mock('@/components/ui/ErrorState', () => ({
  ErrorState: ({ title, message, onRetry }: any) => (
    <div data-testid="error-state">
      {title}: {message}
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

describe('AssetDetailView', () => {
  const mockAsset: AssetDetail = {
    id: 1n,
    tokenContract: 'CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ',
    issuer: 'GCAQNP4VNDXVP5JXV6PMPNQAKNWX3XVZUDGDZIXLSIGSL3YMWKJK6N3J',
    name: 'Test Real Estate Token',
    assetType: 'real_estate',
    valuation: 50000000n,
    createdAt: 1234567890,
    active: true,
    metadata: {
      name: 'Test Real Estate Token',
      symbol: 'TRE',
      assetType: 'real_estate',
      totalSupply: 1000000n,
      decimals: 6,
      admin: 'GCAQNP4VNDXVP5JXV6PMPNQAKNWX3XVZUDGDZIXLSIGSL3YMWKJK6N3J',
      complianceContract: 'CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU',
      assetDescription: 'A test real estate asset',
      valuation: 50000000n,
      paused: false,
    },
  };

  const mockUseAsset = useAssetModule.useAsset as jest.MockedFunction<
    typeof useAssetModule.useAsset
  >;
  const mockUseDividends = useDividendsModule.useDividends as jest.MockedFunction<
    typeof useDividendsModule.useDividends
  >;
  const mockUseWallet = useWalletModule.useWallet as jest.MockedFunction<
    typeof useWalletModule.useWallet
  >;
  const mockUseAsync = useAsyncModule.useAsync as jest.MockedFunction<
    typeof useAsyncModule.useAsync
  >;
  const mockUseBalance = useAssetModule.useBalance as jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      address: 'GCUSER123456789ABCDEFGHIJKLMNOPQR',
      network: 'testnet',
      walletNetwork: 'testnet',
      installed: true,
      connecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      setNetwork: jest.fn(),
      sign: jest.fn(),
      writeCtx: jest.fn(),
    });

    mockUseBalance.mockReturnValue({
      data: 100n,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseDividends.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseAsync.mockReturnValue({
      data: 12345,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('displays loading state', () => {
    mockUseAsset.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByText('Loading asset…')).toBeInTheDocument();
  });

  it('displays error state when asset not found', () => {
    mockUseAsset.mockReturnValue({
      data: null,
      loading: false,
      error: 'Asset not found',
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText(/Asset not found/)).toBeInTheDocument();
  });

  it('displays error state with default message when data is null', () => {
    mockUseAsset.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText(/No registered asset/)).toBeInTheDocument();
  });

  it('renders asset detail when loaded successfully', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByTestId('asset-header')).toBeInTheDocument();
    expect(screen.getByTestId('asset-stats')).toBeInTheDocument();
    expect(screen.getByTestId('holder-list')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-panel')).toBeInTheDocument();
  });

  it('displays compliance notice', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByText(/compliance-gated asset/)).toBeInTheDocument();
  });

  it('renders asset description section', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByText('About this asset')).toBeInTheDocument();
    expect(screen.getByText('A test real estate asset')).toBeInTheDocument();
  });

  it('displays "Description not provided" when asset has no description', () => {
    const assetNoDesc = {
      ...mockAsset,
      metadata: {
        ...mockAsset.metadata,
        assetDescription: '',
      },
    };

    mockUseAsset.mockReturnValue({
      data: assetNoDesc,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(
      screen.getByText(/The issuer hasn't provided a description/)
    ).toBeInTheDocument();
  });

  it('displays dividend history section', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByText('Dividend history')).toBeInTheDocument();
  });

  it('displays loading state for dividends', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseDividends.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByText('Loading distributions…')).toBeInTheDocument();
  });

  it('displays error state for dividends', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseDividends.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load dividends',
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    // ErrorState mock renders as "Something went wrong: Failed to load dividends"
    expect(screen.getByText(/Failed to load dividends/)).toBeInTheDocument();
  });

  it('displays empty state for dividends when none exist', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseDividends.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByText('No distributions yet')).toBeInTheDocument();
  });

  it('displays distribution cards when dividends exist', () => {
    const mockDistributions = [
      {
        id: 1n,
        assetToken: 'CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ',
        paymentToken: 'CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX',
        totalAmount: 1000000n,
        distributed: 500000n,
        snapshotLedger: 1000,
        createdAt: 1234567890,
        completed: false,
        claimable: 100000n,
        claimed: false,
      },
    ];

    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseDividends.mockReturnValue({
      data: mockDistributions,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByTestId('distribution-card')).toBeInTheDocument();
    expect(screen.getByText('1 distribution')).toBeInTheDocument();
  });

  it('displays plural "distributions" label when multiple', () => {
    const mockDistributions = [
      {
        id: 1n,
        assetToken: 'CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ',
        paymentToken: 'CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX',
        totalAmount: 1000000n,
        distributed: 500000n,
        snapshotLedger: 1000,
        createdAt: 1234567890,
        completed: false,
        claimable: 100000n,
        claimed: false,
      },
      {
        id: 2n,
        assetToken: 'CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ',
        paymentToken: 'CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX',
        totalAmount: 1000000n,
        distributed: 500000n,
        snapshotLedger: 1001,
        createdAt: 1234567891,
        completed: false,
        claimable: 100000n,
        claimed: false,
      },
    ];

    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseDividends.mockReturnValue({
      data: mockDistributions,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByText('2 distributions')).toBeInTheDocument();
  });

  it('displays holders section', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    expect(screen.getByTestId('holder-list')).toBeInTheDocument();
  });

  it('has back to explore link in error state', () => {
    mockUseAsset.mockReturnValue({
      data: null,
      loading: false,
      error: 'Asset not found',
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    const links = screen.getAllByRole('link');
    expect(links.some(link => link.textContent?.includes('Back to Explore'))).toBe(true);
  });

  it('renders main structure correctly', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = render(<AssetDetailView id={1n} />);
    const mainContainer = container.querySelector('div.mx-auto');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer?.classList.contains('max-w-6xl')).toBe(true);
  });

  it('passes asset data to child components', () => {
    mockUseAsset.mockReturnValue({
      data: mockAsset,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);
    // Check if asset header displays the asset name (since it's mocked to show asset.name)
    expect(screen.getByText('Test Real Estate Token')).toBeInTheDocument();
  });
});
