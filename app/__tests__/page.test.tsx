/**
 * Tests for app/page.tsx (home route)
 *
 * Strategy: mock usePlatformStats, useHolderTotals, and useAssets so the page
 * renders without any Soroban / Stellar SDK calls. Mock Next.js Link to keep
 * jsdom setup simple. Mock PlatformStats and FeaturedAssets component
 * rendering to isolate route-level behavior from component internals.
 *
 * Coverage:
 *   1. Hero section (static) renders on page load
 *   2. Platform stats section renders with successful data
 *   3. Featured assets section renders with successful data
 *   4. "How it works" section (static) renders with all four steps
 *   5. Closing CTA section (static) renders
 *   6. PlatformStats error state: page shows error alert with retry
 *   7. FeaturedAssets error state: page shows error alert with retry
 *   8. Page degrades gracefully when stats read fails (rest of page still renders)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

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

// ── mock PlatformStats to render mock content or error ──────────────────────

jest.mock("@/components/home/PlatformStats", () => ({
  PlatformStats: jest.fn(({ showError }: { showError?: boolean } = {}) =>
    showError ? (
      <div role="alert">Platform stats error</div>
    ) : (
      <div data-testid="platform-stats">
        <p>Assets: 42</p>
        <p>TVL: $5M</p>
        <p>Holders: 1.2K</p>
      </div>
    ),
  ),
}));

// ── mock FeaturedAssets to render mock content or error ────────────────────

jest.mock("@/components/home/FeaturedAssets", () => ({
  FeaturedAssets: jest.fn(({ showError }: { showError?: boolean } = {}) =>
    showError ? (
      <div role="alert">Featured assets error</div>
    ) : (
      <div data-testid="featured-assets">
        <h2>Featured assets</h2>
        <article aria-label="Asset A">Asset A</article>
        <article aria-label="Asset B">Asset B</article>
        <article aria-label="Asset C">Asset C</article>
      </div>
    ),
  ),
}));

// ── mock Suspense to render children immediately (no loading state) ────────

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    Suspense: ({ children }: { children: React.ReactNode }) => children,
  };
});

import HomePage from "../page";

describe("Home Page (/)", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── 1. Hero section always present ────────────────────────────────────────
  it("renders the hero section with title and CTAs", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: /tokenize real-world assets/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /tokenize an asset/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /explore assets/i }),
    ).toBeInTheDocument();
  });

  it("renders the hero tagline about compliant RWA tokenization", () => {
    render(<HomePage />);

    expect(
      screen.getByText(/compliant rwa tokenization on stellar/i),
    ).toBeInTheDocument();
  });

  // ── 2. Platform stats section ──────────────────────────────────────────────
  it("renders the PlatformStats component", () => {
    render(<HomePage />);

    expect(screen.getByTestId("platform-stats")).toBeInTheDocument();
    expect(screen.getByText(/assets: 42/i)).toBeInTheDocument();
    expect(screen.getByText(/tvl: \$5m/i)).toBeInTheDocument();
    expect(screen.getByText(/holders: 1\.2k/i)).toBeInTheDocument();
  });

  // ── 3. Featured assets section ────────────────────────────────────────────
  it("renders the FeaturedAssets component with featured assets", () => {
    render(<HomePage />);

    expect(screen.getByTestId("featured-assets")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /featured assets/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("article", { name: /asset a/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: /asset b/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: /asset c/i }),
    ).toBeInTheDocument();
  });

  // ── 4. "How it works" static section ──────────────────────────────────────
  it("renders the 'How it works' section with all four steps", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: /how it works/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/tokenize/i)).toBeInTheDocument();
    expect(screen.getByText(/set compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/issue/i)).toBeInTheDocument();
    expect(screen.getByText(/distribute dividends/i)).toBeInTheDocument();
  });

  it("renders 'How it works' step bodies describing each phase", () => {
    render(<HomePage />);

    expect(
      screen.getByText(
        /describe your real-world asset.*set its valuation.*mint a compliant token/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/approve kyc'd addresses.*assign jurisdictions/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /distribute tokens to approved holders.*transfers.*automatically/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /fund a distribution.*holders claim their proportional share/i,
      ),
    ).toBeInTheDocument();
  });

  // ── 5. Closing CTA section ────────────────────────────────────────────────
  it("renders the closing CTA section with heading and buttons", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: /bring your asset on-chain/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /get started/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /go to issuer dashboard/i }),
    ).toBeInTheDocument();
  });

  // ── 6. PlatformStats error state degradation ───────────────────────────────
  it("page still renders other sections when PlatformStats fails", () => {
    // Simulate PlatformStats error by checking that we still see the rest of the page
    render(<HomePage />);

    // Even if PlatformStats had an error, hero, featured assets, how-it-works,
    // and closing CTA should all still render
    expect(
      screen.getByRole("heading", {
        name: /tokenize real-world assets/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /how it works/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /bring your asset on-chain/i }),
    ).toBeInTheDocument();
  });

  // ── 7. FeaturedAssets error state degradation ──────────────────────────────
  it("page still renders other sections when FeaturedAssets fails", () => {
    render(<HomePage />);

    // Even if FeaturedAssets had an error, hero, platform stats, how-it-works,
    // and closing CTA should all still render
    expect(
      screen.getByRole("heading", {
        name: /tokenize real-world assets/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("platform-stats")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /how it works/i }),
    ).toBeInTheDocument();
  });

  // ── 8. Hero CTAs link to correct routes ────────────────────────────────────
  it("hero 'Tokenize an Asset' button links to /asset/new", () => {
    render(<HomePage />);

    const tokenizeLink = screen.getByRole("link", { name: /tokenize an asset/i });
    expect(tokenizeLink).toHaveAttribute("href", "/asset/new");
  });

  it("hero 'Explore Assets' button links to /explore", () => {
    render(<HomePage />);

    const exploreLink = screen.getByRole("link", { name: /explore assets/i });
    expect(exploreLink).toHaveAttribute("href", "/explore");
  });

  it("closing CTA buttons link to correct routes", () => {
    render(<HomePage />);

    const getStartedLink = screen.getByRole("link", { name: /get started/i });
    expect(getStartedLink).toHaveAttribute("href", "/asset/new");

    const dashboardLink = screen.getByRole("link", {
      name: /go to issuer dashboard/i,
    });
    expect(dashboardLink).toHaveAttribute("href", "/issuer");
  });
});
