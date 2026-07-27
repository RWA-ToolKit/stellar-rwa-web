import React from "react";
import { render, screen } from "@testing-library/react";
import { AssetGrid } from "../AssetGrid";
import type { AssetEntry } from "@/types";

// Stub next/link — identical to the AssetCard test stub
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

const makeAsset = (id: number, name: string): AssetEntry => ({
  id: BigInt(id),
  tokenContract: `CONTRACT_${id}`,
  issuer: "GABC1234DEFG5678ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  name,
  assetType: "real_estate",
  valuation: BigInt(1_000_000_00),
  createdAt: 1_000_000,
  active: true,
});

const twoAssets = [makeAsset(1, "Alpha Tower"), makeAsset(2, "Beta Plaza")];
const threeAssets = [...twoAssets, makeAsset(3, "Gamma Hub")];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetGrid", () => {
  it("renders nothing when the assets array is empty", () => {
    const { container } = render(<AssetGrid assets={[]} />);

    // The grid wrapper is present but holds no cards
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(0);
  });

  it("renders one card per asset", () => {
    render(<AssetGrid assets={twoAssets} />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("renders the asset name for each card", () => {
    render(<AssetGrid assets={threeAssets} />);

    expect(screen.getByRole("heading", { name: /alpha tower/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /beta plaza/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /gamma hub/i })).toBeInTheDocument();
  });

  it("each card link points to the correct /asset/:id route", () => {
    render(<AssetGrid assets={twoAssets} />);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/asset/1");
    expect(hrefs).toContain("/asset/2");
  });

  it("renders a single asset correctly", () => {
    render(<AssetGrid assets={[makeAsset(7, "Solo Asset")]} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /solo asset/i })).toBeInTheDocument();
  });
});
