import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../SiteFooter";

// Existing app routes
const VALID_ROUTES = ["/explore"];

// Routes that should NOT appear because the pages don't exist yet
const DEAD_ROUTES = ["/asset/new", "/issuer", "/portfolio"];

describe("SiteFooter", () => {
  it("renders the brand name", () => {
    render(<SiteFooter />);
    expect(screen.getByText("RWA")).toBeInTheDocument();
  });

  it("links to the Explore page", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /explore assets/i });
    expect(link).toHaveAttribute("href", "/explore");
  });

  it("does not link to routes that do not exist yet", () => {
    render(<SiteFooter />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    for (const dead of DEAD_ROUTES) {
      expect(hrefs).not.toContain(dead);
    }
  });

  it("links to the real RWA-ToolKit contracts repo, not a placeholder", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /contracts/i });
    expect(link.getAttribute("href")).toContain("RWA-ToolKit");
    expect(link.getAttribute("href")).not.toContain("your-org");
  });

  it("links to the real RWA-ToolKit docs repo, not a placeholder", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /docs/i });
    expect(link.getAttribute("href")).toContain("RWA-ToolKit");
    expect(link.getAttribute("href")).not.toContain("your-org");
  });

  it("links to the Soroban docs (external)", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /soroban/i });
    expect(link.getAttribute("href")).toContain("developers.stellar.org");
  });

  it("opens external links in a new tab", () => {
    render(<SiteFooter />);
    const externalLinks = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("target") === "_blank");
    for (const link of externalLinks) {
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });
});
