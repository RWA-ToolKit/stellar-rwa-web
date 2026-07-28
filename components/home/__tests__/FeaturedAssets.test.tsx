/**
 * Tests for components/home/FeaturedAssets.tsx
 *
 * Strategy: mock the two hooks (useAssets, useWallet) so the component
 * renders in a pure jsdom environment without any Soroban / Stellar SDK calls.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock next/link so href is rendered as a plain <a> ─────────────────────
jest.mock("next/link", () => {
  const MockLink = ({
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
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// ── mock useAssets ─────────────────────────────────────────────────────────
jest.mock("@/hooks/useAssets", () => ({
  useAssets: jest.fn(),
}));

// ── mock AssetTypeBadge (used inside AssetCard) ────────────────────────────
jest.mock("@/components/asset/AssetTypeBadge", () => ({
  AssetTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

import { useAssets } from "@/hooks/useAssets";
import { FeaturedAssets } from "../FeaturedAssets";

const mockUseAssets = useAssets as jest.MockedFunction<typeof useAssets>;

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: 1n,
    tokenContract: "TOKEN_A",
    issuer: "GISSUER000000000000000000000000000000000000000000000000001",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: 1_000_000_00n, // $1,000,000.00 in cents
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("FeaturedAssets", () => {
  afterEach(() => jest.clearAllMocks());

  // ── loading state ──────────────────────────────────────────────────────
  it("renders skeleton cards while loading", () => {
    mockUseAssets.mockReturnValue({
      assets: [],
      loading: true,
      error: null,
      data: undefined,
    });

    const { container } = render(<FeaturedAssets />);

    // CardSkeletonGrid renders divs with aria-hidden shimmer children;
    // confirm no real asset cards are present
    expect(screen.queryByRole("link", { name: /asset #/i })).toBeNull();
    // The skeleton grid wraps everything in a grid div — at least one shimmer div exists
    const ariaHidden = container.querySelectorAll("[aria-hidden='true']");
    expect(ariaHidden.length).toBeGreaterThan(0);
  });

  // ── error state ────────────────────────────────────────────────────────
  it("renders EmptyState when the hook returns an error", () => {
    mockUseAssets.mockReturnValue({
      assets: [],
      loading: false,
      error: new Error("RPC failure"),
      data: undefined,
    });

    render(<FeaturedAssets />);

    expect(screen.getByText("No assets yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Tokenized assets will appear here/i),
    ).toBeInTheDocument();
  });

  // ── empty state ────────────────────────────────────────────────────────
  it("renders EmptyState when there are no assets", () => {
    mockUseAssets.mockReturnValue({
      assets: [],
      loading: false,
      error: null,
      data: [],
    });

    render(<FeaturedAssets />);

    expect(screen.getByText("No assets yet")).toBeInTheDocument();
    // The CTA link inside EmptyState should point to /asset/new
    const ctaLink = screen.getByRole("link", { name: /tokenize an asset/i });
    expect(ctaLink).toHaveAttribute("href", "/asset/new");
  });

  // ── success state ──────────────────────────────────────────────────────
  it("renders up to 3 asset cards in descending valuation order", () => {
    const assets = [
      makeAsset({ id: 1n, name: "Low Value",    valuation: 100_00n }),
      makeAsset({ id: 2n, name: "High Value",   valuation: 500_000_00n }),
      makeAsset({ id: 3n, name: "Medium Value", valuation: 250_000_00n }),
      makeAsset({ id: 4n, name: "Extra Asset",  valuation: 75_00n }),
    ];

    mockUseAssets.mockReturnValue({
      assets,
      loading: false,
      error: null,
      data: assets,
    });

    render(<FeaturedAssets />);

    // Should show the 3 highest-valued assets
    expect(screen.getByText("High Value")).toBeInTheDocument();
    expect(screen.getByText("Medium Value")).toBeInTheDocument();
    expect(screen.getByText("Low Value")).toBeInTheDocument();
    // The fourth asset (Extra Asset, lowest valuation) must NOT appear
    expect(screen.queryByText("Extra Asset")).toBeNull();
  });

  it("sorts assets by valuation descending and renders the top 3", () => {
    const assets = [
      makeAsset({ id: 1n, name: "Asset A", valuation: 300_000_00n }),
      makeAsset({ id: 2n, name: "Asset B", valuation: 100_000_00n }),
      makeAsset({ id: 3n, name: "Asset C", valuation: 200_000_00n }),
    ];

    mockUseAssets.mockReturnValue({
      assets,
      loading: false,
      error: null,
      data: assets,
    });

    render(<FeaturedAssets />);

    const cards = screen.getAllByRole("link").filter((el) =>
      el.textContent?.includes("Asset #"),
    );
    // First card should be Asset A (highest valuation)
    expect(cards[0]).toHaveTextContent("Asset A");
    // Second card should be Asset C
    expect(cards[1]).toHaveTextContent("Asset C");
    // Third card should be Asset B
    expect(cards[2]).toHaveTextContent("Asset B");
  });

  // ── section header ─────────────────────────────────────────────────────
  it("always renders the section heading and 'View all' link", () => {
    mockUseAssets.mockReturnValue({
      assets: [],
      loading: false,
      error: null,
      data: [],
    });

    render(<FeaturedAssets />);

    expect(
      screen.getByRole("heading", { name: /featured assets/i }),
    ).toBeInTheDocument();

    const viewAll = screen.getByRole("link", { name: /view all/i });
    expect(viewAll).toHaveAttribute("href", "/explore");
  });

  // ── asset card links ───────────────────────────────────────────────────
  it("each asset card links to the correct asset detail page", () => {
    const assets = [
      makeAsset({ id: 10n, name: "Asset Ten" }),
      makeAsset({ id: 20n, name: "Asset Twenty", valuation: 500n }),
    ];

    mockUseAssets.mockReturnValue({
      assets,
      loading: false,
      error: null,
      data: assets,
    });

    render(<FeaturedAssets />);

    const cardLinks = screen.getAllByRole("link").filter((el) =>
      el.textContent?.includes("Asset #"),
    );
    const hrefs = cardLinks.map((el) => el.getAttribute("href"));
    expect(hrefs).toContain("/asset/10");
    expect(hrefs).toContain("/asset/20");
  });

  // ── exactly 3 cap ──────────────────────────────────────────────────────
  it("never shows more than 3 assets even with a large list", () => {
    const assets = Array.from({ length: 10 }, (_, i) =>
      makeAsset({ id: BigInt(i + 1), name: `Asset ${i + 1}`, valuation: BigInt(i * 100_00) }),
    );

    mockUseAssets.mockReturnValue({
      assets,
      loading: false,
      error: null,
      data: assets,
    });

    render(<FeaturedAssets />);

    const cardLinks = screen.getAllByRole("link").filter((el) =>
      el.textContent?.includes("Asset #"),
    );
    expect(cardLinks).toHaveLength(3);
  });
});
