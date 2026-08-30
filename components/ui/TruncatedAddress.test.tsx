import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TruncatedAddress } from "./TruncatedAddress";

// Mock CopyButton's clipboard functionality
jest.mock("./CopyButton", () => ({
  CopyButton: ({ value }: { value: string }) => (
    <button
      onClick={() => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(value);
        }
      }}
      title={`Copy ${value}`}
      aria-label={`Copy ${value}`}
    >
      📋
    </button>
  ),
}));

describe("TruncatedAddress", () => {
  const fullAddress = "GCZST3XVCDTUJ76ZAV2HA72KYQJLZPLXNXJCB5GES2LFVZJKFE6ZRQNC";

  it("renders truncated address with default 4...4 format", () => {
    render(<TruncatedAddress address={fullAddress} />);
    expect(screen.getByText(/GCZS.*RQNC/)).toBeInTheDocument();
  });

  it("renders truncated address with custom lead and tail values", () => {
    render(<TruncatedAddress address={fullAddress} lead={6} tail={6} />);
    expect(screen.getByText(/GCZST3.*ZRQNC/)).toBeInTheDocument();
  });

  it("renders a copy button next to the truncated address", () => {
    render(<TruncatedAddress address={fullAddress} />);
    const copyButton = screen.getByRole("button", {
      name: new RegExp(fullAddress),
    });
    expect(copyButton).toBeInTheDocument();
  });

  it("copies the full (untruncated) address to clipboard when copy button is clicked", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<TruncatedAddress address={fullAddress} />);
    const copyButton = screen.getByRole("button", {
      name: new RegExp(fullAddress),
    });

    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(fullAddress);
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <TruncatedAddress address={fullAddress} className="custom-class" />
    );
    const span = container.querySelector(".custom-class");
    expect(span).toBeInTheDocument();
  });

  it("does not truncate very short addresses", () => {
    const shortAddress = "GABC";
    render(<TruncatedAddress address={shortAddress} />);
    expect(screen.getByText(shortAddress)).toBeInTheDocument();
  });
});
