import { render, screen } from "@testing-library/react";
import { Skeleton, CardSkeletonGrid } from "./Skeleton";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

describe("Skeleton", () => {
  it("renders a presentational block", () => {
    const { container } = render(<Skeleton />);
    // The outer wrapper should be in the DOM
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("DIV");
  });

  it("is hidden from assistive technology (aria-hidden)", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("applies a default shimmer animation class", () => {
    const { container } = render(<Skeleton />);
    const shimmer = container.querySelector(".animate-shimmer");
    expect(shimmer).not.toBeNull();
  });

  it("forwards a custom className to the root element", () => {
    const { container } = render(<Skeleton className="h-10 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/h-10/);
    expect(el.className).toMatch(/w-32/);
  });

  it("renders without a className prop (defaults to empty string)", () => {
    expect(() => render(<Skeleton />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CardSkeletonGrid
// ---------------------------------------------------------------------------

describe("CardSkeletonGrid", () => {
  it("renders the default count of 6 cards", () => {
    const { container } = render(<CardSkeletonGrid />);
    // Each card is a direct child of the grid wrapper
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(6);
  });

  it("renders the specified number of cards", () => {
    const { container } = render(<CardSkeletonGrid count={3} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(3);
  });

  it("renders 0 cards when count is 0", () => {
    const { container } = render(<CardSkeletonGrid count={0} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(0);
  });

  it("renders 1 card when count is 1", () => {
    const { container } = render(<CardSkeletonGrid count={1} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(1);
  });

  it("each card contains multiple Skeleton blocks (shimmer children)", () => {
    const { container } = render(<CardSkeletonGrid count={1} />);
    const shimmers = container.querySelectorAll(".animate-shimmer");
    // The single card template has at least 4 Skeleton blocks
    expect(shimmers.length).toBeGreaterThanOrEqual(4);
  });

  it("all inner Skeleton blocks are hidden from assistive technology", () => {
    const { container } = render(<CardSkeletonGrid count={2} />);
    const ariaHiddenEls = container.querySelectorAll("[aria-hidden='true']");
    expect(ariaHiddenEls.length).toBeGreaterThan(0);
  });

  it("uses a CSS grid layout", () => {
    const { container } = render(<CardSkeletonGrid />);
    const grid = container.firstChild as HTMLElement;
    // Tailwind grid class is present
    expect(grid.className).toMatch(/grid/);
  });
});
