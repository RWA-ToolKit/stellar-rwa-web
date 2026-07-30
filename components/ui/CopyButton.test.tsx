import { act, fireEvent, render, screen } from "@testing-library/react";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("renders correctly with default icon-only mode", () => {
    render(<CopyButton value="GABC123456789" />);

    const button = screen.getByRole("button", { name: "Copy GABC123456789" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Copy");
  });

  it("renders with a custom label when provided", () => {
    render(<CopyButton value="GABC123456789" label="Wallet Address" />);

    const button = screen.getByRole("button", { name: "Copy Wallet Address" });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Wallet Address")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<CopyButton value="test" className="my-custom-class" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-class");
  });

  it("copies value to clipboard on click and temporarily displays confirmation state", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="GABC123456789" label="Copy Key" />);

    const button = screen.getByRole("button", { name: "Copy Copy Key" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith("GABC123456789");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();

    // Advance timer past 1400ms feedback timeout
    act(() => {
      jest.advanceTimersByTime(1400);
    });

    expect(screen.getByRole("button", { name: "Copy Copy Key" })).toBeInTheDocument();
    expect(screen.getByText("Copy Key")).toBeInTheDocument();
  });

  it("fails silently when clipboard API rejects", async () => {
    const writeTextMock = jest.fn().mockRejectedValue(new Error("Clipboard forbidden"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="GABC123456789" />);

    const button = screen.getByRole("button", { name: "Copy GABC123456789" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith("GABC123456789");
    // State remains uncopied
    expect(screen.getByRole("button", { name: "Copy GABC123456789" })).toBeInTheDocument();
  });
});
