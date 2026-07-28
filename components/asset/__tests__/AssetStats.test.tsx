import { render, screen } from '@testing-library/react';
import { AssetStats } from '../AssetStats';
import type { AssetDetail } from '@/types';

describe('AssetStats', () => {
  const mockAsset: AssetDetail = {
    id: 1n,
    tokenContract: 'CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ',
    issuer: 'GCAQNP4VNDXVP5JXV6PMPNQAKNWX3XVZUDGDZIXLSIGSL3YMWKJK6N3J',
    name: 'Test Real Estate Token',
    assetType: 'real_estate',
    valuation: 50000000n, // 50M USD cents = $500k
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

  it('renders the component', () => {
    render(<AssetStats asset={mockAsset} />);
    expect(screen.getByText('Total supply')).toBeInTheDocument();
    expect(screen.getByText('Decimals')).toBeInTheDocument();
    expect(screen.getByText('Valuation')).toBeInTheDocument();
  });

  it('displays total supply correctly', () => {
    render(<AssetStats asset={mockAsset} />);
    expect(screen.getByText(/1 TRE/)).toBeInTheDocument();
  });

  it('displays decimals correctly', () => {
    render(<AssetStats asset={mockAsset} />);
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('displays valuation correctly formatted', () => {
    render(<AssetStats asset={mockAsset} />);
    expect(screen.getByText('$500,000')).toBeInTheDocument();
  });

  it('does not display holders when undefined', () => {
    render(<AssetStats asset={mockAsset} />);
    const holderElements = screen.queryAllByText(/Holders/);
    expect(holderElements).toHaveLength(0);
  });

  it('displays holders when provided', () => {
    render(<AssetStats asset={mockAsset} holders={42} />);
    expect(screen.getByText('Holders')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('formats holder count with thousands separator', () => {
    render(<AssetStats asset={mockAsset} holders={1000} />);
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('renders all rows in a definition list', () => {
    const { container } = render(<AssetStats asset={mockAsset} holders={100} />);
    const dl = container.querySelector('dl');
    expect(dl).toBeInTheDocument();
    const rows = container.querySelectorAll('div.py-2\\.5');
    expect(rows.length).toBe(4); // Total supply, decimals, valuation, holders
  });

  it('displays correct row structure', () => {
    const { container } = render(<AssetStats asset={mockAsset} />);
    const dts = container.querySelectorAll('dt');
    const dds = container.querySelectorAll('dd');
    expect(dts).toHaveLength(3);
    expect(dds).toHaveLength(3);
  });

  it('handles different asset types', () => {
    const invoiceAsset = {
      ...mockAsset,
      assetType: 'invoice',
      metadata: {
        ...mockAsset.metadata,
        assetType: 'invoice',
        symbol: 'INV',
      },
    };
    render(<AssetStats asset={invoiceAsset} />);
    expect(screen.getByText(/INV/)).toBeInTheDocument();
  });

  it('handles zero valuation', () => {
    const zeroValueAsset = {
      ...mockAsset,
      valuation: 0n,
      metadata: {
        ...mockAsset.metadata,
        valuation: 0n,
      },
    };
    render(<AssetStats asset={zeroValueAsset} />);
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('handles large valuations', () => {
    const largeValueAsset = {
      ...mockAsset,
      valuation: 1000000000000n, // 10 billion USD cents
      metadata: {
        ...mockAsset.metadata,
        valuation: 1000000000000n,
      },
    };
    render(<AssetStats asset={largeValueAsset} />);
    expect(screen.getByText('$10,000,000,000')).toBeInTheDocument();
  });

  it('handles large supply with different decimals', () => {
    const largeSupplyAsset = {
      ...mockAsset,
      metadata: {
        ...mockAsset.metadata,
        totalSupply: 9999999999999n,
        decimals: 18,
      },
    };
    render(<AssetStats asset={largeSupplyAsset} />);
    // With 18 decimals, 9999999999999 becomes 9.999999999999
    expect(screen.getByText(/TRE/)).toBeInTheDocument();
  });
});
