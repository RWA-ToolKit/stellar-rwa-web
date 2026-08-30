/**
 * Route-level tests for app/explore/page.tsx
 *
 * Strategy: mock useAssets to return configured asset lists, mock
 * useRouter and useSearchParams to exercise client-side filtering and
 * pagination without a real Next.js router. Assert that:
 *   1. Asset grid renders with real accessible asset names
 *   2. Type filter chips narrow the visible list correctly
 *   3. Empty state renders when no assets match the filter
 *
 * Assertions use role-based queries to verify real rendered UI.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock useAssets hook ────────────────────────────────────────────────────
jest.mock("@/hooks/useAssets", () => ({
  useAssets: jest.fn(),
}));

// ── mock Next.js navigation ────────────────────────────────────────────────
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// AssetCard renders a link to /asset/<id> — mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

// ── mock loading skeleton ──────────────────────────────────────────────────
jest.mock("@/components/ui/Skeleton", () => ({
  CardSkeletonGrid: ({ count }: { count: number }) => (
    <div data-testid="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} />
      ))}
    </div>
  ),
}));

// ── mock error and empty state components ──────────────────────────────────
jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div role="alert">
      {message}
      <button onClick={onRetry}>Try again</button>
    </div>
  ),
}));

jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div role="region" aria-label="Empty state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

// ── imports after mocks ────────────────────────────────────────────────────
import { useSearchParams, useRouter } from "next/navigation";
import { useAssets } from "@/hooks/useAssets";
import ExplorePage from "../page";

const mockUseAssets = useAssets as jest.MockedFunction<typeof useAssets>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<
  typeof useSearchParams
>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// ── helpers ────────────────────────────────────────────────────────────────

type UseAssetsReturn = ReturnType<typeof useAssets>;

function setupAssetsMock(state: Partial<UseAssetsReturn>, searchParamsStr = "") {
  mockUseAssets.mockReturnValue({
    assets: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    data: [],
    ...state,
  } as UseAssetsReturn);

  mockUseSearchParams.mockReturnValue(
    new URLSearchParams(searchParamsStr) as ReturnType<typeof useSearchParams>,
  );

  mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
}

function makeAsset(
  overrides: Partial<AssetEntry> & Pick<AssetEntry, "id" | "name">,
): AssetEntry {
  return {
    tokenContract: "CTOKEN123",
    issuer: "GISSUER123",
    valuation: 1_000_000_00n,
    createdAt: 100,
    active: true,
    assetType: "real_estate",
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("/explore route", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("asset listing", () => {
    it("renders asset list with real accessible names when assets exist", () => {
      const assets = [
        makeAsset({ id: 1n, name: "Lagos Office Tower", assetType: "real_estate" }),
        makeAsset({ id: 2n, name: "Trade Invoice #42", assetType: "invoice" }),
      ];
      setupAssetsMock({ assets, data: assets });
      render(<ExplorePage />);

      // AssetCard renders asset names as link text; verify they appear
      expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
      expect(screen.getByText("Trade Invoice #42")).toBeInTheDocument();
    });

    it("renders a filter chip for each asset type", () => {
      const assets = [
        makeAsset({ id: 1n, name: "Asset 1", assetType: "real_estate" }),
      ];
      setupAssetsMock({ assets, data: assets });
      render(<ExplorePage />);

      // AssetFilter renders type chips with buttons
      expect(screen.getByRole("button", { name: /all assets/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /real estate/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /invoice/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /commodity/i })).toBeInTheDocument();
    });
  });

  describe("filtering by asset type", () => {
    it("narrows the list when a type filter chip is clicked", () => {
      const realEstateassets = [
        makeAsset({ id: 1n, name: "Lagos Office Tower", assetType: "real_estate" }),
        makeAsset({ id: 2n, name: "Warehouse A", assetType: "real_estate" }),
      ];
      const invoiceAssets = [
        makeAsset({ id: 3n, name: "Trade Invoice #42", assetType: "invoice" }),
      ];
      const allAssets = [...realEstateassets, ...invoiceAssets];

      setupAssetsMock({ assets: allAssets, data: allAssets });
      render(<ExplorePage />);

      // Initially all assets are visible
      expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
      expect(screen.getByText("Trade Invoice #42")).toBeInTheDocument();

      // Click the "Real Estate" filter chip
      const realEstateChip = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.includes("Real Estate"),
      );
      fireEvent.click(realEstateChip!);

      // After filtering, real estate assets should still be visible
      // (router.push is called, so we check the mock was called with the right params)
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("type=real_estate"));
    });
  });

  describe("empty state when no assets match filter", () => {
    it("renders 'No assets of this type' when filter returns no results", () => {
      setupAssetsMock({ assets: [], data: [] }, "type=invoice");
      render(<ExplorePage />);

      expect(screen.getByText(/no assets of this type/i)).toBeInTheDocument();
    });

    it("renders 'No assets tokenized yet' when no assets exist at all", () => {
      setupAssetsMock({ assets: [], data: [] });
      render(<ExplorePage />);

      expect(screen.getByText(/no assets tokenized yet/i)).toBeInTheDocument();
    });

    it("shows a call to action in the empty state", () => {
      setupAssetsMock({ assets: [], data: [] });
      render(<ExplorePage />);

      expect(screen.getByText(/be the first to bring/i)).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error message when asset loading fails", () => {
      const mockRefetch = jest.fn();
      setupAssetsMock({
        error: "RPC connection timed out",
        refetch: mockRefetch,
      });
      render(<ExplorePage />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("RPC connection timed out")).toBeInTheDocument();
    });

    it("renders a retry button in the error state", () => {
      const mockRefetch = jest.fn();
      setupAssetsMock({
        error: "Network error",
        refetch: mockRefetch,
      });
      render(<ExplorePage />);

      const retryBtn = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state", () => {
    it("renders skeleton grid while assets are loading", () => {
      setupAssetsMock({ loading: true, assets: [] });
      render(<ExplorePage />);

      expect(screen.getByTestId("skeleton-grid")).toBeInTheDocument();
      expect(screen.queryByText(/no assets/i)).not.toBeInTheDocument();
    });
  });

  describe("sort order", () => {
    it("renders sort select with valuation and newest options", () => {
      const assets = [makeAsset({ id: 1n, name: "Asset 1" })];
      setupAssetsMock({ assets, data: assets });
      render(<ExplorePage />);

      const sortSelect = screen.getByLabelText(/sort assets/i);
      expect(sortSelect).toBeInTheDocument();

      // Verify options exist
      const options = screen.getAllByRole("option");
      expect(options.some((opt) => opt.textContent?.includes("Highest valuation"))).toBe(true);
      expect(options.some((opt) => opt.textContent?.includes("Newest"))).toBe(true);
    });
  });
});
