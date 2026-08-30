import { render, screen } from "@testing-library/react";
import { AssetDetailSkeleton } from "./AssetDetailSkeleton";

describe("AssetDetailSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<AssetDetailSkeleton />);
    expect(container).toBeInTheDocument();
  });

  it("renders skeleton placeholders", () => {
    const { container } = render(<AssetDetailSkeleton />);
    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders skeleton layout that mirrors asset detail structure", () => {
    const { container } = render(<AssetDetailSkeleton />);
    // Check for card containers
    const cards = container.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThan(0);
    // Check for grid layout
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
  });
});
