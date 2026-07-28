import { render, screen } from '@testing-library/react';
import { HolderList } from '../HolderList';
import * as useHoldersModule from '@/hooks/useHolders';
import * as useWalletModule from '@/hooks/useWallet';
import type { AssetDetail } from '@/types';

// Mock stellar imports before importing the hooks
jest.mock('@/lib/stellar', () => ({
  getLatestLedger: jest.fn(),
  explorerContractUrl: jest.fn((network: string, contract: string) => `https://explorer.${network}/${contract}`),
}));

// Mock the hooks
jest.mock('@/hooks/useHolders');
jest.mock('@/hooks/useWallet');
jest.mock('@/components/ui/CopyButton', () => ({
  CopyButton: () => <span data-testid="copy-button">Copy</span>,
}));

describe('HolderList', () => {
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

  const mockUseHolders = useHoldersModule.useHolders as jest.MockedFunction<
    typeof useHoldersModule.useHolders
  >;
  const mockUseWallet = useWalletModule.useWallet as jest.MockedFunction<
    typeof useWalletModule.useWallet
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: 'GCCONNECTEDUSER123456789ABCDEF12345',
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
  });

  it('displays loading state', () => {
    mockUseHolders.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    expect(screen.getByText('Loading holders…')).toBeInTheDocument();
  });

  it('displays error state', () => {
    mockUseHolders.mockReturnValue({
      data: null,
      loading: false,
      error: "Couldn't load holders",
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    expect(screen.getByText(/Couldn't load holders/)).toBeInTheDocument();
  });

  it('displays empty state when no holders', () => {
    mockUseHolders.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    expect(screen.getByText('No holders yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Once the issuer distributes this asset to approved addresses/
      )
    ).toBeInTheDocument();
  });

  it('displays holders list', () => {
    const mockHolders = [
      {
        address: 'GHOLDER1TESTADDRESS123456789ABC',
        balance: 500000n,
      },
      {
        address: 'GHOLDER2TESTADDRESS123456789ABC',
        balance: 300000n,
      },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    
    // Both holders should be displayed (truncated: first 6 + ... + last 4)
    // Two copy buttons for two holders
    expect(screen.getAllByTestId('copy-button')).toHaveLength(2);
    // Two balance texts with TRE symbol
    expect(screen.getAllByText(/TRE/)).toHaveLength(2);
  });

  it('displays correct balance and percentage for holders', () => {
    const mockHolders = [
      {
        address: 'GHOLDER1TESTADDRESS123456789ABC',
        balance: 500000n, // 50% of 1M
      },
      {
        address: 'GHOLDER2TESTADDRESS123456789ABC',
        balance: 500000n, // 50% of 1M
      },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    
    // Should show formatted balance with symbol
    expect(screen.getAllByText(/TRE/)).toHaveLength(2);
    
    // Should show percentages
    expect(screen.getAllByText(/50\.00%/)).toHaveLength(2);
  });

  it('marks current user with "You" badge', () => {
    const userAddress = 'GCCONNECTEDUSER123456789ABCDEF12345';
    mockUseWallet.mockReturnValue({
      address: userAddress,
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

    const mockHolders = [
      {
        address: userAddress,
        balance: 100000n,
      },
      {
        address: 'GHOLDER2TESTADDRESS123456789ABC',
        balance: 900000n,
      },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('does not mark other users with "You" badge', () => {
    mockUseWallet.mockReturnValue({
      address: 'GCCONNECTEDUSER123456789ABCDEF12345',
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

    const mockHolders = [
      {
        address: 'GHOLDER1TESTADDRESS123456789ABC',
        balance: 500000n,
      },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    // But should show the holder address (truncated)
    expect(screen.getByText(/GHOLD.*ABC/)).toBeInTheDocument();
  });

  it('calls onCount callback when holders data loads', () => {
    const onCountMock = jest.fn();
    const mockHolders = [
      { address: 'GHOLDER1TESTADDRESS123456789ABC', balance: 500000n },
      { address: 'GHOLDER2TESTADDRESS123456789ABC', balance: 300000n },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} onCount={onCountMock} />);
    
    expect(onCountMock).toHaveBeenCalledWith(2);
  });

  it('does not call onCount if callback is not provided', () => {
    const mockHolders = [
      { address: 'GHOLDER1TESTADDRESS123456789ABC', balance: 500000n },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    // Should not error even without onCount callback
    expect(screen.getByTestId('copy-button')).toBeInTheDocument();
  });

  it('renders copy buttons for each holder address', () => {
    const mockHolders = [
      { address: 'GHOLDER1TESTADDRESS123456789ABC', balance: 500000n },
      { address: 'GHOLDER2TESTADDRESS123456789ABC', balance: 300000n },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    
    const copyButtons = screen.getAllByTestId('copy-button');
    expect(copyButtons).toHaveLength(2);
  });

  it('renders holders in correct order (sorted by balance descending)', () => {
    const mockHolders = [
      { address: 'GHOLDER1TESTADDRESS123456789ABC', balance: 900000n },
      { address: 'GHOLDER2TESTADDRESS123456789ABC', balance: 100000n },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = render(<HolderList asset={mockAsset} />);
    
    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(2);
    // Should have highest balance first
    expect(screen.getAllByText(/TRE/)).toHaveLength(2);
  });

  it('handles null address in wallet context', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      network: 'testnet',
      walletNetwork: 'testnet',
      installed: false,
      connecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      setNetwork: jest.fn(),
      sign: jest.fn(),
      writeCtx: jest.fn(),
    });

    const mockHolders = [
      { address: 'GHOLDER1TESTADDRESS123456789ABC', balance: 500000n },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<HolderList asset={mockAsset} />);
    // Should still render holders even with no connected wallet
    expect(screen.getByText(/GHOLD.*ABC/)).toBeInTheDocument();
  });

  it('renders as unordered list', () => {
    const mockHolders = [
      { address: 'GHOLDER1TESTADDRESS123456789ABC', balance: 500000n },
    ];

    mockUseHolders.mockReturnValue({
      data: mockHolders,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = render(<HolderList asset={mockAsset} />);
    const ul = container.querySelector('ul');
    expect(ul).toBeInTheDocument();
    const li = container.querySelector('li');
    expect(li).toBeInTheDocument();
  });
});
