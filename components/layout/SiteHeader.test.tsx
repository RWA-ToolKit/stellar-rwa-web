import { render, screen, fireEvent } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";

// ── Mocks ──────────────────────────────────────────────────────────────────

// next/navigation: control usePathname per test
const mockUsePathname = jest.fn(() => "/");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// next/link: render as a plain <a> so href assertions work in jsdom
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

// Wallet child components: replace with simple stubs so we don't need to mock
// the entire wallet context tree in layout tests.
jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button data-testid="connect-button">Connect Wallet</button>,
}));

jest.mock("@/components/wallet/NetworkSelector", () => ({
  NetworkSelector: () => <div data-testid="network-selector">Testnet</div>,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function renderHeader(pathname = "/") {
  mockUsePathname.mockReturnValue(pathname);
  return render(<SiteHeader />);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SiteHeader", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Brand / logo ───────────────────────────────────────────────────────

  it("renders the brand name with a link to /", () => {
    renderHeader();
    // The logo <a> contains two text nodes: "Stellar" and "RWA"; the accessible
    // name is computed as "Stellar RWA" (with a space between the spans).
    const homeLink = screen.getByRole("link", { name: /stellar\s*rwa/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  // ── Desktop navigation ─────────────────────────────────────────────────

  const navLinks = [
    { label: "Explore", href: "/explore" },
    { label: "Tokenize", href: "/asset/new" },
    { label: "Issuer", href: "/issuer" },
    { label: "Portfolio", href: "/portfolio" },
  ];

  it("renders all four desktop nav links", () => {
    renderHeader();
    navLinks.forEach(({ label }) => {
      // There may be duplicates once the mobile drawer is in the DOM; we just
      // need at least one occurrence.
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    });
  });

  it.each(navLinks)("nav link '$label' points to $href", ({ label, href }) => {
    renderHeader();
    const links = screen.getAllByRole("link", { name: label });
    expect(links[0]).toHaveAttribute("href", href);
  });

  // ── Active-link state ──────────────────────────────────────────────────

  it("marks the Explore link as active when pathname is /explore", () => {
    renderHeader("/explore");
    // The active class includes bg-white/5; the inactive class includes /55.
    // We verify by checking the aria-selected equivalent isn't applied to a
    // sibling, and that the active link's class differs from others.
    const links = screen.getAllByRole("link", { name: "Explore" });
    // Active link does NOT have the muted opacity class
    expect(links[0].className).not.toMatch(/\/55/);
  });

  it("marks the Issuer link as active when pathname starts with /issuer/compliance", () => {
    renderHeader("/issuer/compliance");
    const links = screen.getAllByRole("link", { name: "Issuer" });
    expect(links[0].className).not.toMatch(/\/55/);
  });

  // ── Wallet controls ────────────────────────────────────────────────────

  it("renders the ConnectButton stub", () => {
    renderHeader();
    expect(screen.getByTestId("connect-button")).toBeInTheDocument();
  });

  it("renders at least one NetworkSelector stub", () => {
    renderHeader();
    // One is in the desktop header, another appears inside the mobile drawer
    // only when open; so at minimum one should always be present.
    expect(screen.getAllByTestId("network-selector").length).toBeGreaterThan(0);
  });

  // ── Mobile menu toggle ─────────────────────────────────────────────────

  it("hides the mobile nav drawer by default", () => {
    renderHeader();
    // The mobile nav contains the first mobile-only Platform links;
    // The drawer `nav` is only rendered when mobileOpen === true.
    const navEls = screen.getAllByRole("navigation");
    // Only the desktop nav should be present (1 nav element in the header)
    expect(navEls).toHaveLength(1);
  });

  it("shows the mobile nav drawer after clicking the toggle button", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // The mobile drawer nav is now rendered too
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
  });

  it("hides the mobile nav drawer again after a second toggle click", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    fireEvent.click(toggle); // open
    fireEvent.click(toggle); // close

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("closes the mobile drawer when a nav link inside it is clicked", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    fireEvent.click(toggle); // open

    // In the mobile drawer, each link has an onClick that closes the drawer.
    // getAllByRole returns desktop links first; the mobile drawer duplicates them.
    const allExploreLinks = screen.getAllByRole("link", { name: "Explore" });
    // The second occurrence is the mobile-drawer link
    fireEvent.click(allExploreLinks[allExploreLinks.length - 1]);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("renders the NetworkSelector inside the mobile drawer when it is open", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });

    // Before opening: only one NetworkSelector (desktop)
    expect(screen.getAllByTestId("network-selector")).toHaveLength(1);

    fireEvent.click(toggle);

    // After opening: desktop + mobile-drawer NetworkSelector
    expect(screen.getAllByTestId("network-selector")).toHaveLength(2);
  });
});
