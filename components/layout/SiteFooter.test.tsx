import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  beforeEach(() => {
    render(<SiteFooter />);
  });

  // ── Brand ─────────────────────────────────────────────────────────────────

  it("renders the brand name", () => {
    // The brand <p> element contains "Stellar" directly and "RWA" in a nested
    // <span>. Its text content is "StellarRWA". Use a heading-style check on
    // the bold paragraph instead.
    const brand = screen.getByText((_, el) =>
      el?.tagName === "P" && /stellar/i.test(el.textContent ?? "")
        && /rwa/i.test(el.textContent ?? "")
    );
    expect(brand).toBeInTheDocument();
  });

  it("renders the tagline copy", () => {
    expect(
      screen.getByText(/tokenize real-world assets on stellar/i)
    ).toBeInTheDocument();
  });

  // ── Platform nav links ────────────────────────────────────────────────────

  it("renders the Platform section heading", () => {
    expect(screen.getByText(/platform/i)).toBeInTheDocument();
  });

  it.each([
    ["Explore assets", "/explore"],
    ["Tokenize an asset", "/asset/new"],
    ["Issuer dashboard", "/issuer"],
    ["Portfolio", "/portfolio"],
  ])("renders platform link '%s' pointing to %s", (label, href) => {
    const link = screen.getByRole("link", { name: label });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", href);
  });

  // ── Developer external links ──────────────────────────────────────────────

  it("renders the Developers section heading", () => {
    expect(screen.getByText(/developers/i)).toBeInTheDocument();
  });

  it("renders the Contracts external link opening in a new tab", () => {
    const link = screen.getByRole("link", { name: /contracts/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the API & Docs external link opening in a new tab", () => {
    const link = screen.getByRole("link", { name: /api.*docs/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the Soroban external link pointing to Stellar docs", () => {
    const link = screen.getByRole("link", { name: /soroban/i });
    expect(link).toHaveAttribute(
      "href",
      "https://developers.stellar.org/docs/build/smart-contracts"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  // ── Compliance disclaimer ─────────────────────────────────────────────────

  it("renders the compliance disclaimer text", () => {
    expect(screen.getByText(/built on stellar \/ soroban/i)).toBeInTheDocument();
    expect(
      screen.getByText(/kyc-approved addresses/i)
    ).toBeInTheDocument();
  });
});
