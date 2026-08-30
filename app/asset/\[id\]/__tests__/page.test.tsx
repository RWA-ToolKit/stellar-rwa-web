/**
 * Route-level tests for app/asset/[id]/page.tsx
 *
 * Strategy: The route component parses the id param and either shows an invalid
 * ID error or renders AssetDetailView. Mock useAsset and useWallet to control
 * the asset detail fetch, and verify:
 *   1. Invalid id param shows "Invalid asset id" error message
 *   2. Valid id with found asset renders the detail view
 *   3. Valid id with asset not found shows "Asset not found" error state
 *
 * Assertions use role-based queries to verify real rendered UI.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";

// ── mock useAsset hook ─────────────────────────────────────────────────────
jest.mock("@/hooks/useAsset", () => ({
  useAsset: jest.fn(),
  useBalance: jest.fn(),
}));

// ── mock useWallet hook ────────────────────────────────────────────────────
jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

// ── mock other asset-detail hooks ──────────────────────────────────────────
jest.mock("@/hooks/useCompliance", () => ({
  useComplianceOverview: jest.fn(),
}));

jest.mock("@/hooks/useHolders", () => ({
  useHolders: jest.fn(),
}));

jest.mock("@/hooks/useDividends", () => ({
  useDividends: jest.fn(),
}));

jest.mock("@/hooks/useAsync", () => ({
  useAsync: jest.fn(),
}));

// ── mock Stellar lib functions ─────────────────────────────────────────────
jest.mock("@/lib/stellar", () => ({
  getLatestLedger: jest.fn(),
  explorerContractUrl: (_network: string, contractId: string) =>
    `https://stellar.expert/contract/${contractId}`,
}));

// ── mock Next.js Link ──────────────────────────────────────────────────────
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

// ── mock asset detail sub-components ───────────────────────────────────────
jest.mock("@/components/asset/AssetHeader", () => ({
  AssetHeader: ({ asset }: { asset: AssetDetail }) => (
    <h1>Asset: {asset.name}</h1>
  ),
}));

jest.mock("@/components/asset/AssetStats", () => ({
  AssetStats: () => <p>Asset stats</p>,
}));

jest.mock("@/components/asset/TransferPanel", () => ({
  TransferPanel: () => <p>Transfer panel</p>,
}));

jest.mock("@/components/dividend/DistributionCard", () => ({
  DistributionCard: () => <p>Distribution card</p>,
}));

jest.mock("@/components/asset/HolderList", () => ({
  HolderList: () => <p>Holder list</p>,
}));

jest.mock("@/components/asset/CompliancePanel", () => ({
  CompliancePanel: () => <p>Compliance panel</p>,
}));

jest.mock("@/components/ui/Spinner", () => ({
  LoadingPanel: ({ label }: { label: string }) => (
    <div data-testid="loading-panel">{label}</div>
  ),
}));

jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({
    title,
    message,
    onRetry,
  }: {
    title?: string;
    message: string;
    onRetry?: () => void;
  }) => (
    <div role="alert">
      {title && <h2>{title}</h2>}
      <p>{message}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));

// ── imports after mocks ────────────────────────────────────────────────────
import { useAsset } from "@/hooks/useAsset";
import { useWallet } from "@/hooks/useWallet";
import AssetPage from "../page";

const mockUseAsset = useAsset as jest.MockedFunction<typeof useAsset>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// ── helpers ────────────────────────────────────────────────────────────────

const MOCK_ASSET: AssetDetail = {
  id: 1n,
  tokenContract: "CTOKEN1",
  issuer: "GISSUER",
  name: "Lagos Office Tower",
  assetType: "real_estate",
  valuation: 5_000_000_00n,
  createdAt: 100,
  active: true,
  metadata: {
    name: "Lagos Office Tower",
    symbol: "LOT",
    assetType: "real_estate",
    totalSupply: 1_000_000n,
    decimals: 2,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "A commercial tower.",
    valuation: 5_000_000_00n,
    paused: false,
  },
};

function setupWallet() {
  mockUseWallet.mockReturnValue({
    network: "testnet",
    address: "GUSER",
  } as ReturnType<typeof useWallet>);
}

type UseAssetReturn = ReturnType<typeof useAsset>;

function setupAsset(overrides: Partial<UseAssetReturn>) {
  mockUseAsset.mockReturnValue({
    data: MOCK_ASSET,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  } as UseAssetReturn);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("/asset/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupWallet();
  });

  describe("invalid asset id param", () => {
    it("shows 'Invalid asset id' when id is not a valid number", () => {
      render(<AssetPage params={{ id: "not-a-number" }} />);
      expect(screen.getByRole("heading", { name: /invalid asset id/i })).toBeInTheDocument();
    });

    it("shows the invalid id string in the error message", () => {
      render(<AssetPage params={{ id: "xyz123" }} />);
      expect(screen.getByText(/"xyz123" is not a valid asset id/i)).toBeInTheDocument();
    });

    it("renders a back link to /explore for invalid ids", () => {
      render(<AssetPage params={{ id: "bad-id" }} />);
      const backLink = screen.getByRole("link", { name: /back to explore/i });
      expect(backLink).toHaveAttribute("href", "/explore");
    });

    it("rejects negative numbers as invalid", () => {
      render(<AssetPage params={{ id: "-1" }} />);
      expect(screen.getByRole("heading", { name: /invalid asset id/i })).toBeInTheDocument();
    });
  });

  describe("valid asset id — asset found", () => {
    it("renders the asset detail view when id is valid and asset exists", () => {
      setupAsset({
        data: MOCK_ASSET,
        loading: false,
        error: null,
      });
      render(<AssetPage params={{ id: "1" }} />);

      // AssetHeader renders with asset name in the h1
      expect(screen.getByRole("heading", { name: /Lagos Office Tower/i })).toBeInTheDocument();
    });

    it("shows compliance notice for all assets", () => {
      setupAsset({ data: MOCK_ASSET });
      render(<AssetPage params={{ id: "1" }} />);

      expect(screen.getByText(/compliance-gated asset/i)).toBeInTheDocument();
    });

    it("renders a back link to /explore in the detail view", () => {
      setupAsset({ data: MOCK_ASSET });
      render(<AssetPage params={{ id: "1" }} />);

      const backLink = screen.getByRole("link", { name: /explore/i });
      expect(backLink).toHaveAttribute("href", "/explore");
    });
  });

  describe("valid asset id — asset not found", () => {
    it("renders 'Asset not found' error when useAsset returns no data", () => {
      setupAsset({
        data: null,
        error: null,
        loading: false,
      });
      render(<AssetPage params={{ id: "999" }} />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/no registered asset with id 999/i)).toBeInTheDocument();
    });

    it("renders error state when useAsset returns an error", () => {
      setupAsset({
        error: "Failed to fetch asset from contract",
        loading: false,
      });
      render(<AssetPage params={{ id: "1" }} />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch asset from contract/i)).toBeInTheDocument();
    });

    it("renders a back link to /explore in the not-found error state", () => {
      setupAsset({ data: null });
      render(<AssetPage params={{ id: "999" }} />);

      const backLink = screen.getByRole("link", { name: /back to explore/i });
      expect(backLink).toHaveAttribute("href", "/explore");
    });

    it("renders a retry button in the error state", () => {
      const mockRefetch = jest.fn();
      setupAsset({
        error: "Network error",
        refetch: mockRefetch,
      });
      render(<AssetPage params={{ id: "1" }} />);

      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("renders loading panel while asset is being fetched", () => {
      setupAsset({
        loading: true,
        data: null,
      });
      render(<AssetPage params={{ id: "1" }} />);

      expect(screen.getByTestId("loading-panel")).toBeInTheDocument();
      expect(screen.getByText(/loading asset/i)).toBeInTheDocument();
    });
  });

  describe("large asset id values", () => {
    it("handles large bigint id values correctly", () => {
      const largeId = "18446744073709551615"; // max u64
      setupAsset({ data: MOCK_ASSET });
      render(<AssetPage params={{ id: largeId }} />);

      // Should render the detail view successfully
      expect(screen.getByRole("heading", { name: /Lagos Office Tower/i })).toBeInTheDocument();
    });
  });
});
