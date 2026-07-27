import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetExplorer } from "../AssetExplorer";
import type { AssetEntry } from "@/types";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Stub next/link so it renders as a plain <a> without needing a router
jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// Uses hooks/__mocks__/useAssets.ts — the real module (which imports
// @stellar/stellar-sdk, an ESM-only package) is never loaded by Jest.
jest.mock("@/hooks/useAssets");
import { useAssets } from "@/hooks/useAssets";
const mockUseAssets = useAssets as jest.MockedFunction<typeof useAssets>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeAsset = (
  id: number,
  name: string,
  assetType: string = "real_estate",
  valuation: bigint = BigInt(1_000_000_00),
  createdAt: number = 1_000_000,
): AssetEntry => ({
  id: BigInt(id),
  tokenContract: `CONTRACT_${id}`,
  issuer: "GABC1234DEFG5678ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  name,
  assetType,
  valuation,
  createdAt,
  active: true,
});

// 10 assets: alternating real_estate / invoice; enough to exceed the 9-per-page limit
const TEN_ASSETS: AssetEntry[] = Array.from({ length: 10 }, (_, i) =>
  makeAsset(i + 1, `Asset ${i + 1}`, i % 2 === 0 ? "real_estate" : "invoice"),
);

const THREE_ASSETS: AssetEntry[] = [
  makeAsset(1, "Real Estate One", "real_estate", BigInt(500_000_00), 1_000),
  makeAsset(2, "Invoice Alpha", "invoice", BigInt(200_000_00), 2_000),
  makeAsset(3, "Commodity Gold", "commodity", BigInt(300_000_00), 3_000),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UseAssetsReturn = ReturnType<typeof useAssets>;

function mockLoading(): void {
  mockUseAssets.mockReturnValue({
    assets: [],
    loading: true,
    error: null,
    data: undefined,
    refetch: jest.fn(),
  } as unknown as UseAssetsReturn);
}

function mockError(message: string): jest.Mock {
  const refetch = jest.fn();
  mockUseAssets.mockReturnValue({
    assets: [],
    loading: false,
    error: message,
    data: undefined,
    refetch,
  } as unknown as UseAssetsReturn);
  return refetch;
}

function mockAssets(assets: AssetEntry[]): void {
  mockUseAssets.mockReturnValue({
    assets,
    loading: false,
    error: null,
    data: assets,
    refetch: jest.fn(),
  } as unknown as UseAssetsReturn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetExplorer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("renders skeleton placeholders while data is loading", () => {
      mockLoading();
      const { container } = render(<AssetExplorer />);

      // No real asset card links while loading
      const links = container.querySelectorAll("a[href^='/asset']");
      expect(links).toHaveLength(0);

      // CardSkeletonGrid renders aria-hidden shimmer divs
      const hiddenEls = container.querySelectorAll("[aria-hidden='true']");
      expect(hiddenEls.length).toBeGreaterThan(0);
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────

  describe("error state", () => {
    it("renders an error alert when loading fails", () => {
      mockError("RPC connection refused");
      render(<AssetExplorer />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/RPC connection refused/i)).toBeInTheDocument();
    });

    it("the retry button calls refetch", async () => {
      const user = userEvent.setup();
      const refetch = mockError("Timeout");
      render(<AssetExplorer />);

      await user.click(screen.getByRole("button", { name: /try again/i }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows a global empty state when there are no assets", () => {
      mockAssets([]);
      render(<AssetExplorer />);

      expect(screen.getByText(/no assets tokenized yet/i)).toBeInTheDocument();
    });

    it("shows a type-specific empty state after filtering to an empty category", async () => {
      const user = userEvent.setup();
      // Only real_estate — commodity bucket is empty
      mockAssets([makeAsset(1, "Tower", "real_estate")]);
      render(<AssetExplorer />);

      await user.click(screen.getByRole("button", { name: /commodity/i }));

      expect(screen.getByText(/no assets of this type/i)).toBeInTheDocument();
    });
  });

  // ── Success state ─────────────────────────────────────────────────────────

  describe("success state", () => {
    it("renders a card for each loaded asset", () => {
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      expect(screen.getByRole("heading", { name: /real estate one/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /invoice alpha/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /commodity gold/i })).toBeInTheDocument();
    });

    it("does not show pagination when all assets fit on one page", () => {
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    });
  });

  // ── Filtering ─────────────────────────────────────────────────────────────

  describe("type filtering", () => {
    it("shows all assets when 'All Assets' filter is active (default)", () => {
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      expect(screen.getAllByRole("link")).toHaveLength(THREE_ASSETS.length);
    });

    it("filters to real_estate assets only", async () => {
      const user = userEvent.setup();
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      await user.click(screen.getByRole("button", { name: /real estate/i }));

      expect(screen.getByRole("heading", { name: /real estate one/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /invoice alpha/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /commodity gold/i })).not.toBeInTheDocument();
    });

    it("filters to invoice assets only", async () => {
      const user = userEvent.setup();
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      await user.click(screen.getByRole("button", { name: /^invoice/i }));

      expect(screen.getByRole("heading", { name: /invoice alpha/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /real estate one/i })).not.toBeInTheDocument();
    });

    it("filter chips show the per-type count badges", () => {
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      // 3 total assets; each type has exactly 1
      expect(screen.getByRole("button", { name: /all assets/i })).toHaveTextContent("3");
      expect(screen.getByRole("button", { name: /real estate/i })).toHaveTextContent("1");
    });

    it("resets to page 1 when the type filter changes", async () => {
      const user = userEvent.setup();
      // 10 assets → page 1 of 2; navigate to page 2 then switch filter
      mockAssets(TEN_ASSETS);
      render(<AssetExplorer />);

      await user.click(screen.getByRole("button", { name: /next →/i }));
      expect(screen.getByText(/page 2 of/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^invoice/i }));
      // The invoice filter shows 5 assets which still fit on 1 page
      expect(screen.queryByText(/page 2/i)).not.toBeInTheDocument();
    });
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  describe("sort order", () => {
    it("default sort is highest valuation first", () => {
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      // Valuations: Real Estate=$5M (500_000_00 cents), Invoice=$2M, Commodity=$3M
      // Sorted desc: Real Estate, Commodity, Invoice
      const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
      const realIdx = headings.findIndex((t) => /real estate one/i.test(t));
      const commodityIdx = headings.findIndex((t) => /commodity gold/i.test(t));
      const invoiceIdx = headings.findIndex((t) => /invoice alpha/i.test(t));

      expect(realIdx).toBeLessThan(commodityIdx);
      expect(commodityIdx).toBeLessThan(invoiceIdx);
    });

    it("'newest' sort places the most recently created asset first", async () => {
      const user = userEvent.setup();
      mockAssets(THREE_ASSETS);
      render(<AssetExplorer />);

      // createdAt: Real Estate=1000, Invoice=2000, Commodity=3000
      // Newest first: Commodity, Invoice, Real Estate
      await user.selectOptions(screen.getByRole("combobox"), "newest");

      const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
      const commodityIdx = headings.findIndex((t) => /commodity gold/i.test(t));
      const invoiceIdx = headings.findIndex((t) => /invoice alpha/i.test(t));
      const realIdx = headings.findIndex((t) => /real estate one/i.test(t));

      expect(commodityIdx).toBeLessThan(invoiceIdx);
      expect(invoiceIdx).toBeLessThan(realIdx);
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("shows prev/next buttons when there are more assets than fit on one page", () => {
      mockAssets(TEN_ASSETS);
      render(<AssetExplorer />);

      expect(screen.getByRole("button", { name: /← prev/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next →/i })).toBeInTheDocument();
    });

    it("the prev button is disabled on the first page", () => {
      mockAssets(TEN_ASSETS);
      render(<AssetExplorer />);

      expect(screen.getByRole("button", { name: /← prev/i })).toBeDisabled();
    });

    it("the next button is disabled on the last page", async () => {
      const user = userEvent.setup();
      mockAssets(TEN_ASSETS);
      render(<AssetExplorer />);

      await user.click(screen.getByRole("button", { name: /next →/i }));

      expect(screen.getByRole("button", { name: /next →/i })).toBeDisabled();
    });

    it("navigating next shows the overflow assets on page 2", async () => {
      const user = userEvent.setup();
      mockAssets(TEN_ASSETS);
      render(<AssetExplorer />);

      // Page 1 shows 9 of 10; page 2 shows 1
      await user.click(screen.getByRole("button", { name: /next →/i }));

      // Only 1 card on page 2
      expect(screen.getAllByRole("link")).toHaveLength(1);
    });

    it("displays the 'Page X of Y · N assets' summary line", () => {
      mockAssets(TEN_ASSETS);
      render(<AssetExplorer />);

      expect(screen.getByText(/page 1 of 2 · 10 assets/i)).toBeInTheDocument();
    });
  });
});
