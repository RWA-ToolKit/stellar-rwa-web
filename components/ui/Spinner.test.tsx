import { render, screen } from "@testing-library/react";
import { Spinner, LoadingPanel } from "./Spinner";

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

describe("Spinner", () => {
  it("renders with role='status' for accessibility", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("defaults aria-label to 'Loading'", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading");
  });

  it("uses a custom aria-label when label prop is provided", () => {
    render(<Spinner label="Fetching assets" />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Fetching assets",
    );
  });

  it("applies the default size of 20×20 via inline styles", () => {
    render(<Spinner />);
    const el = screen.getByRole("status");
    expect(el).toHaveStyle({ width: "20px", height: "20px" });
  });

  it("applies a custom size via inline styles", () => {
    render(<Spinner size={36} />);
    const el = screen.getByRole("status");
    expect(el).toHaveStyle({ width: "36px", height: "36px" });
  });

  it("forwards a custom className to the element", () => {
    render(<Spinner className="my-class" />);
    const el = screen.getByRole("status");
    expect(el.className).toMatch(/my-class/);
  });

  it("includes the spin animation class by default", () => {
    render(<Spinner />);
    expect(screen.getByRole("status").className).toMatch(/animate-spin/);
  });

  it("renders without throwing when no props are passed", () => {
    expect(() => render(<Spinner />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// LoadingPanel
// ---------------------------------------------------------------------------

describe("LoadingPanel", () => {
  it("renders a Spinner element inside the panel", () => {
    render(<LoadingPanel />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("displays the default label 'Loading…'", () => {
    render(<LoadingPanel />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("displays a custom label when provided", () => {
    render(<LoadingPanel label="Fetching holders…" />);
    expect(screen.getByText("Fetching holders…")).toBeInTheDocument();
  });

  it("does not display the default label when a custom one is set", () => {
    render(<LoadingPanel label="Please wait" />);
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("renders without throwing when no props are passed", () => {
    expect(() => render(<LoadingPanel />)).not.toThrow();
  });
});
