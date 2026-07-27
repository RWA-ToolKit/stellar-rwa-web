import React from "react";
import { render, screen } from "@testing-library/react";
import { AssetCard } from "../AssetCard";
import type { AssetEntry } from "@/types";

// next/link needs the router context in tests; next/jest provides a lightweight
// mock but we also need to stub next/navigation used transitively.
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseAsset: AssetEntry = {
  id: BigInt(1),
  tokenContract: "CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ",
  issuer: "GABC1234DEFG5678ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  name: "Downtown Office Tower",
  assetType: "real_estate",
  // $1,500,000,000.00 in USD cents → formatUsdCents compact → "$1.5B"
  valuation: BigInt(1_500_000_000_00),
  createdAt: 1_000_000,
  active: true,
};

const inactiveAsset: AssetEntry = { ...baseAsset, active: false };
const invoiceAsset: AssetEntry = { ...baseAsset, assetType: "invoice", name: "Invoice #42" };
const commodityAsset: AssetEntry = { ...baseAsset, assetType: "commodity", name: "Gold Bars" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetCard", () => {
  it("renders the asset name and asset-type badge", () => {
    render(<AssetCard asset={baseAsset} />);

    expect(screen.getByRole("heading", { name: /downtown office tower/i })).toBeInTheDocument();
    // AssetTypeBadge renders a human-readable label
    expect(screen.getByText(/real estate/i)).toBeInTheDocument();
  });

  it("renders a link pointing to /asset/:id", () => {
    render(<AssetCard asset={baseAsset} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/asset/1");
  });

  it("displays the formatted valuation", () => {
    render(<AssetCard asset={baseAsset} />);

    // formatUsdCents with compact:true should produce something like "$1.5B"
    expect(screen.getByText(/\$1\.5B/i)).toBeInTheDocument();
  });

  it("shows the truncated issuer address", () => {
    render(<AssetCard asset={baseAsset} />);

    // truncateAddress keeps first 4 chars + "…" + last 4 chars
    expect(screen.getByText(/GABC.*Z/)).toBeInTheDocument();
  });

  it("shows 'Inactive' chip when asset.active is false", () => {
    render(<AssetCard asset={inactiveAsset} />);

    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it("does NOT show the Inactive chip when asset is active", () => {
    render(<AssetCard asset={baseAsset} />);

    expect(screen.queryByText(/inactive/i)).not.toBeInTheDocument();
  });

  it("displays the holders count when holders prop is provided", () => {
    render(<AssetCard asset={baseAsset} holders={42} />);

    // The dt label switches between 'Holders' and 'Supply'
    expect(screen.getByText(/holders/i)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("displays the supply string when supply prop is provided", () => {
    render(<AssetCard asset={baseAsset} supply="1,000,000" />);

    expect(screen.getByText(/supply/i)).toBeInTheDocument();
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
  });

  it("shows '—' when neither holders nor supply is provided", () => {
    render(<AssetCard asset={baseAsset} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the correct badge for an invoice asset", () => {
    render(<AssetCard asset={invoiceAsset} />);

    // The badge span contains "Invoice" as a text node; getAllByText handles
    // the ambiguity when the asset name also contains "invoice".
    const matches = screen.getAllByText(/^invoice$/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the correct badge for a commodity asset", () => {
    render(<AssetCard asset={commodityAsset} />);

    // "Commodity" only appears in the badge, not in the asset name
    expect(screen.getByText(/^commodity$/i)).toBeInTheDocument();
  });
});
