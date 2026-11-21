/**
 * Tests for components/asset/AssetCard.tsx
 *
 * Registry-supplied names are untrusted input. These tests pin the assertion
 * that issuer-controlled text is rendered as inert text and never as markup.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";
import { AssetCard } from "./AssetCard";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/format", () => ({
  assetTypeLabel: (type: string) => type,
  assetHref: (id: bigint) => `/asset/${id}`,
  formatUsdCents: (cents: bigint) => `$${cents / 100n}`,
  truncateAddress: (address: string) =>
    `${address.slice(0, 8)}…${address.slice(-8)}`,
}));

jest.mock("@/lib/assetCache", () => ({
  prefetchAssetMetadata: jest.fn().mockResolvedValue(undefined),
}));

const ASSET: AssetEntry = {
  id: 1n,
  tokenContract: "CTOKEN1234567890",
  issuer: "GISSUER1234567890",
  name: "Lagos Office Tower",
  assetType: "real_estate",
  valuation: 5_000_000_00n,
  createdAt: 100,
  active: true,
};

describe("AssetCard", () => {
  it("renders the issuer-supplied name as inert text, never as markup", () => {
    const payload =
      '<script>window.__assetCardXss = true</script><img src=x onerror="window.__assetCardXss = true">Lagos <b>Tower</b>';
    const { container } = render(<AssetCard asset={{ ...ASSET, name: payload }} />);

    expect(container.querySelector("script, img, b")).toBeNull();
    expect(
      (window as Window & { __assetCardXss?: boolean }).__assetCardXss,
    ).toBeUndefined();

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.children).toHaveLength(0);
    expect(heading).toHaveTextContent("window.__assetCardXss = true");
    expect(heading).toHaveTextContent("Lagos Tower");
  });

  it("still renders a normal asset name", () => {
    render(<AssetCard asset={ASSET} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Lagos Office Tower",
    );
  });
});
