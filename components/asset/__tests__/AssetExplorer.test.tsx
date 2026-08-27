/**
 * Tests for components/asset/AssetExplorer.tsx
 *
 * Strategy: mock useAssets so the component renders without any Soroban / Stellar
 * SDK calls, then drive it through loading, error, empty and populated states,
 * and assert that the type-filter chip correctly narrows the rendered list.
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock useAssets hook ────────────────────────────────────────────────────
jest.mock("@/hooks/useAssets", () => ({
  useAssets: jest.fn(),
}));

// AssetCard renders a link to /asset/<id> — mock Next.js Link so it renders
// as a plain <a> tag without needing the Next.js router.
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

import { useAssets } from "@/hooks/useAssets";
import { AssetExplorer } from "../AssetExplorer";

const mockUseAssets = useAssets as jest.MockedFunction<typeof useAssets>;

// ── helpers ────────────────────────────────────────────────────────────────

type UseAssetsReturn = ReturnType<typeof useAssets>;

function setupMock(state: Partial<UseAssetsReturn>) {
  mockUseAssets.mockReturnValue({
    assets: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    data: [],
    ...state,
  } as UseAssetsReturn);
}

function makeAsset(
  overrides: Partial<AssetEntry> & Pick<AssetEntry, "id" | "name">,
): AssetEntry {
  return {
    tokenContract: "CTOKEN123",
    issuer: "GISSUER123",
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 100,
    active: true,
    ...overrides,
  };
}

const REAL_ESTATE_ASSET = makeAsset({
  id: 1n,
  name: "Lagos Office Tower",
  assetType: "real_estate",
  valuation: 5_000_000_00n,
  createdAt: 200,
});

const INVOICE_ASSET = makeAsset({
  id: 2n,
  name: "Trade Invoice #42",
  assetType: "invoice",
  valuation: 250_000_00n,
  createdAt: 100,
});

const COMMODITY_ASSET = makeAsset({
  id: 3n,
  name: "Gold Reserve",
  assetType: "commodity",
  valuation: 750_000_00n,
  createdAt: 150,
});

// ── tests ──────────────────────────────────────────────────────────────────

describe("AssetExplorer", () => {
  afterEach(() => jest.clearAllMocks());

  // ── loading state ──────────────────────────────────────────────────────

  it("renders a skeleton grid while assets are loading", () => {
    setupMock({ loading: true, assets: [] });
    render(<AssetExplorer />);

    // CardSkeletonGrid renders Skeleton elements, each with aria-hidden="true".
    // We check that at least one is present to confirm the loading state is shown.
    const skeletons = document.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);

    // No real asset content or error alert should be visible during loading
    expect(screen.queryByText("Lagos Office Tower")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // ── error state ────────────────────────────────────────────────────────

  it("renders an error state with a retry button when the hook returns an error", () => {
    const mockRefetch = jest.fn();
    setupMock({ error: "RPC connection timed out", refetch: mockRefetch });

    render(<AssetExplorer />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("RPC connection timed out")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // ── empty state ────────────────────────────────────────────────────────

  it("shows an empty-state message when there are no assets at all", () => {
    setupMock({ assets: [] });
    render(<AssetExplorer />);

    expect(
      screen.getByText("No assets tokenized yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/be the first to bring a real-world asset on-chain/i),
    ).toBeInTheDocument();
  });

  it("shows a type-specific empty state when the active filter has no matches", () => {
    // Only a real_estate asset exists; filtering by 'invoice' should produce
    // the filtered-empty message.
    setupMock({ assets: [REAL_ESTATE_ASSET] });
    render(<AssetExplorer />);

    // Click the 'Invoice' filter chip
    const invoiceChip = screen.getByRole("button", { name: /invoice/i });
    fireEvent.click(invoiceChip);

    expect(screen.getByText("No assets of this type")).toBeInTheDocument();
    expect(
      screen.getByText(/try a different asset class or clear the filter/i),
    ).toBeInTheDocument();
  });

  // ── populated state ────────────────────────────────────────────────────

  it("renders all assets when no type filter is active", () => {
    setupMock({ assets: [REAL_ESTATE_ASSET, INVOICE_ASSET, COMMODITY_ASSET] });
    render(<AssetExplorer />);

    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
    expect(screen.getByText("Trade Invoice #42")).toBeInTheDocument();
    expect(screen.getByText("Gold Reserve")).toBeInTheDocument();
  });

  // ── type filtering ─────────────────────────────────────────────────────

  it("filters the list to only real-estate assets when that chip is clicked", () => {
    setupMock({ assets: [REAL_ESTATE_ASSET, INVOICE_ASSET, COMMODITY_ASSET] });
    render(<AssetExplorer />);

    const realEstateChip = screen.getByRole("button", { name: /real estate/i });
    fireEvent.click(realEstateChip);

    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
    expect(screen.queryByText("Trade Invoice #42")).not.toBeInTheDocument();
    expect(screen.queryByText("Gold Reserve")).not.toBeInTheDocument();
  });

  it("filters the list to only invoice assets when the invoice chip is clicked", () => {
    setupMock({ assets: [REAL_ESTATE_ASSET, INVOICE_ASSET, COMMODITY_ASSET] });
    render(<AssetExplorer />);

    const invoiceChip = screen.getByRole("button", { name: /invoice/i });
    fireEvent.click(invoiceChip);

    expect(screen.getByText("Trade Invoice #42")).toBeInTheDocument();
    expect(screen.queryByText("Lagos Office Tower")).not.toBeInTheDocument();
    expect(screen.queryByText("Gold Reserve")).not.toBeInTheDocument();
  });

  it("filters the list to only commodity assets when the commodity chip is clicked", () => {
    setupMock({ assets: [REAL_ESTATE_ASSET, INVOICE_ASSET, COMMODITY_ASSET] });
    render(<AssetExplorer />);

    const commodityChip = screen.getByRole("button", { name: /commodity/i });
    fireEvent.click(commodityChip);

    expect(screen.getByText("Gold Reserve")).toBeInTheDocument();
    expect(screen.queryByText("Lagos Office Tower")).not.toBeInTheDocument();
    expect(screen.queryByText("Trade Invoice #42")).not.toBeInTheDocument();
  });

  it("restores all assets when 'All Assets' chip is clicked after filtering", () => {
    setupMock({ assets: [REAL_ESTATE_ASSET, INVOICE_ASSET, COMMODITY_ASSET] });
    render(<AssetExplorer />);

    // Apply filter
    fireEvent.click(screen.getByRole("button", { name: /invoice/i }));
    expect(screen.queryByText("Lagos Office Tower")).not.toBeInTheDocument();

    // Clear filter
    fireEvent.click(screen.getByRole("button", { name: /all assets/i }));
    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
    expect(screen.getByText("Trade Invoice #42")).toBeInTheDocument();
    expect(screen.getByText("Gold Reserve")).toBeInTheDocument();
  });

  // ── pagination ─────────────────────────────────────────────────────────

  it("does not render pagination controls when there are 9 or fewer assets", () => {
    setupMock({ assets: [REAL_ESTATE_ASSET, INVOICE_ASSET, COMMODITY_ASSET] });
    render(<AssetExplorer />);

    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
  });

  it("renders pagination controls and shows page 1 of 2 when there are more than 9 assets", () => {
    const manyAssets = Array.from({ length: 11 }, (_, i) =>
      makeAsset({ id: BigInt(i + 1), name: `Asset ${i + 1}` }),
    );
    setupMock({ assets: manyAssets });
    render(<AssetExplorer />);

    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
  });

  it("advances to page 2 when the next-page button is clicked", () => {
    const manyAssets = Array.from({ length: 11 }, (_, i) =>
      makeAsset({ id: BigInt(i + 1), name: `Asset ${i + 1}` }),
    );
    setupMock({ assets: manyAssets });
    render(<AssetExplorer />);

    // Page 1: first 9 assets visible, asset 10 is not
    expect(screen.getByText("Asset 1")).toBeInTheDocument();
    expect(screen.queryByText("Asset 10")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));

    // Page 2: assets 10 and 11 visible
    expect(screen.getByText("Asset 10")).toBeInTheDocument();
    expect(screen.getByText("Asset 11")).toBeInTheDocument();
    expect(screen.queryByText("Asset 1")).not.toBeInTheDocument();
  });

  it("resets to page 1 when a filter chip is clicked while on page 2", () => {
    const manyRealEstate = Array.from({ length: 10 }, (_, i) =>
      makeAsset({
        id: BigInt(i + 1),
        name: `RE Asset ${i + 1}`,
        assetType: "real_estate",
      }),
    );
    setupMock({ assets: manyRealEstate });
    render(<AssetExplorer />);

    // Advance to page 2
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText(/page 2/i)).toBeInTheDocument();

    // Apply filter — page should reset to 1
    fireEvent.click(screen.getByRole("button", { name: /real estate/i }));
    expect(screen.getByText(/page 1/i)).toBeInTheDocument();
  });
});
