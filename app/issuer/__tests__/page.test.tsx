/**
 * Route-level tests for app/issuer/page.tsx
 *
 * Strategy: mock useWallet to control connection state, mock useIssuerAssets
 * to return configured asset lists, and assert that the IssuerDashboard
 * renders correctly for disconnected and connected scenarios.
 *
 * Assertions use role-based queries (getByRole, queryByRole) to verify
 * real rendered UI elements rather than implementation details.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock useWallet hook ───────────────────────────────────────────────────
jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

// ── mock useIssuerAssets hook ─────────────────────────────────────────────
jest.mock("@/hooks/useAssets", () => ({
  useIssuerAssets: jest.fn(),
}));

// ── mock useAsset hook (for the selected asset's detail) ──────────────────
jest.mock("@/hooks/useAsset", () => ({
  useAsset: jest.fn(),
}));

// ── mock heavy sub-components ──────────────────────────────────────────────
jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

jest.mock("@/components/asset/AssetTypeBadge", () => ({
  AssetTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

jest.mock("@/components/ui/Skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} aria-hidden="true" />
  ),
}));

jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("@/components/ui/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

jest.mock("@/components/issuer/panels/TokenPanel", () => ({
  TokenPanel: () => <div data-testid="token-panel" />,
}));

jest.mock("@/components/issuer/panels/CompliancePanel", () => ({
  CompliancePanel: () => <div data-testid="compliance-panel" />,
}));

jest.mock("@/components/issuer/panels/DistributionPanel", () => ({
  DistributionPanel: () => <div data-testid="distribution-panel" />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ── imports after mocks ────────────────────────────────────────────────────
import { useWallet } from "@/hooks/useWallet";
import { useIssuerAssets } from "@/hooks/useAssets";
import { useAsset } from "@/hooks/useAsset";
import IssuerPage from "../page";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseIssuerAssets = useIssuerAssets as jest.MockedFunction<
  typeof useIssuerAssets
>;
const mockUseAsset = useAsset as jest.MockedFunction<typeof useAsset>;

// ── helpers ────────────────────────────────────────────────────────────────

const BASE_WALLET: ReturnType<typeof useWallet> = {
  address: null,
  network: "testnet",
  walletNetwork: null,
  networkUnknown: false,
  installed: true,
  connecting: false,
  error: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  setNetwork: jest.fn(),
  sign: jest.fn(),
  writeCtx: jest.fn(),
};

const MOCK_ASSET_DETAIL = {
  id: 1n,
  tokenContract: "CTOKEN1",
  issuer: "GISSUER",
  name: "Warehouse A",
  assetType: "real_estate",
  valuation: 1_000_000_00n,
  createdAt: 50000,
  active: true,
  metadata: {
    name: "Warehouse A",
    symbol: "WHA",
    assetType: "real_estate",
    totalSupply: 1000000n,
    decimals: 7,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "A warehouse",
    valuation: 1_000_000_00n,
    paused: false,
  },
};

function setupWallet(address: string | null) {
  mockUseWallet.mockReturnValue({ ...BASE_WALLET, address });
}

type IssuerAssetsReturn = ReturnType<typeof useIssuerAssets>;

function setupIssuerAssets(overrides: Partial<IssuerAssetsReturn>) {
  mockUseIssuerAssets.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  } as IssuerAssetsReturn);
}

function makeAsset(id: number, name: string): AssetEntry {
  return {
    id: BigInt(id),
    tokenContract: `CTOKEN${id}`,
    issuer: "GISSUER",
    name,
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 50000,
    active: true,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("/issuer route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAsset.mockReturnValue({
      data: MOCK_ASSET_DETAIL,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe("when no wallet is connected", () => {
    it("renders the wallet-gate heading", () => {
      setupWallet(null);
      setupIssuerAssets({ data: [] });
      render(<IssuerPage />);
      expect(
        screen.getByRole("heading", { name: /connect your wallet/i }),
      ).toBeInTheDocument();
    });

    it("renders a ConnectButton", () => {
      setupWallet(null);
      setupIssuerAssets({ data: [] });
      render(<IssuerPage />);
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument();
    });

    it("does not render the asset selector sidebar", () => {
      setupWallet(null);
      setupIssuerAssets({ data: [] });
      render(<IssuerPage />);
      expect(screen.queryByRole("heading", { name: /your assets/i })).not.toBeInTheDocument();
    });
  });

  describe("when wallet is connected and issuer has assets", () => {
    it("renders the 'Your assets' sidebar label", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [makeAsset(1, "Warehouse A")] });
      render(<IssuerPage />);
      expect(screen.getByText(/your assets/i)).toBeInTheDocument();
    });

    it("renders asset list items with real accessible names", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({
        data: [
          makeAsset(1, "Warehouse A"),
          makeAsset(2, "Office Block B"),
        ],
      });
      render(<IssuerPage />);

      // Assert asset names appear as button labels (roles from IssuerAssetSelector)
      expect(
        screen.getByRole("button", { name: /warehouse a/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /office block b/i }),
      ).toBeInTheDocument();
    });

    it("shows the 'select an asset' placeholder before any selection", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [makeAsset(1, "Warehouse A")] });
      render(<IssuerPage />);
      expect(screen.getByText(/select an asset to manage/i)).toBeInTheDocument();
    });
  });

  describe("when wallet is connected but issuer has no assets", () => {
    it("renders empty state message", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [] });
      render(<IssuerPage />);
      expect(screen.getByText(/no assets registered/i)).toBeInTheDocument();
    });

    it("renders link to tokenize a new asset", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [] });
      render(<IssuerPage />);
      expect(
        screen.getByRole("link", { name: /tokenize an asset/i }),
      ).toHaveAttribute("href", "/asset/new");
    });
  });

  describe("issuer assets loading state", () => {
    it("renders spinner while assets are loading", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: null, loading: true });
      render(<IssuerPage />);
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });
  });
});
