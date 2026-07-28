import { render, screen } from '@testing-library/react';
import { AssetHeader } from '../AssetHeader';
import type { AssetDetail, Network } from '@/types';

// Mock stellar imports before importing the component
jest.mock('@/lib/stellar', () => ({
  getLatestLedger: jest.fn(),
  explorerContractUrl: jest.fn((network: string, contract: string) => `https://explorer.${network}/${contract}`),
}));

describe('AssetHeader', () => {
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

  const network: Network = 'testnet';

  it('renders the component', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.getByText('Test Real Estate Token')).toBeInTheDocument();
  });

  it('displays asset name as heading', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Test Real Estate Token');
  });

  it('displays asset symbol chip', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.getByText('TRE')).toBeInTheDocument();
  });

  it('displays valuation', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.getByText('$500,000')).toBeInTheDocument();
  });

  it('displays asset ID', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('displays truncated token contract address', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    // Should be truncated to 6 chars from start and 6 from end with … separator
    const tokenLink = screen.getByRole('link', { name: /CBMCWL/ });
    expect(tokenLink).toBeInTheDocument();
  });

  it('displays truncated issuer address', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    // Should be truncated to 6 chars from start and 6 from end with … separator
    expect(screen.getByText(/GCAQNP.*6N3J/)).toBeInTheDocument();
  });

  it('does not show paused badge when asset is not paused', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it('shows paused badge when asset is paused', () => {
    const pausedAsset = {
      ...mockAsset,
      metadata: {
        ...mockAsset.metadata,
        paused: true,
      },
    };
    render(<AssetHeader asset={pausedAsset} network={network} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('does not show delisted badge when asset is active', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.queryByText('Delisted')).not.toBeInTheDocument();
  });

  it('shows delisted badge when asset is not active', () => {
    const delistedAsset = {
      ...mockAsset,
      active: false,
    };
    render(<AssetHeader asset={delistedAsset} network={network} />);
    expect(screen.getByText('Delisted')).toBeInTheDocument();
  });

  it('shows both paused and delisted badges when applicable', () => {
    const pausedDelistedAsset = {
      ...mockAsset,
      active: false,
      metadata: {
        ...mockAsset.metadata,
        paused: true,
      },
    };
    render(<AssetHeader asset={pausedDelistedAsset} network={network} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Delisted')).toBeInTheDocument();
  });

  it('renders with different asset types', () => {
    const invoiceAsset = {
      ...mockAsset,
      assetType: 'invoice',
      metadata: {
        ...mockAsset.metadata,
        assetType: 'invoice',
      },
    };
    render(<AssetHeader asset={invoiceAsset} network={network} />);
    expect(screen.getByText('TRE')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    const { container } = render(<AssetHeader asset={mockAsset} network={network} />);
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
  });

  it('renders token contract explorer link', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    const links = screen.getAllByRole('link');
    // Should have at least one link (token contract link)
    expect(links.length).toBeGreaterThan(0);
  });

  it('displays "Valuation" and "Asset ID" labels', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    expect(screen.getByText(/Valuation/i)).toBeInTheDocument();
    expect(screen.getByText(/Asset ID/i)).toBeInTheDocument();
  });

  it('displays token and issuer section labels', () => {
    render(<AssetHeader asset={mockAsset} network={network} />);
    const labels = screen.getAllByText(/Token|Issuer/i);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });
});
