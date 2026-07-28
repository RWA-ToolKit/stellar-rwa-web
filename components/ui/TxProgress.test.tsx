import { fireEvent, render, screen } from "@testing-library/react";
import { TxProgress } from "./TxProgress";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/stellar", () => ({
  explorerTxUrl: (_network: string, hash: string) => `https://stellar.expert/tx/${hash}`,
}));

describe("TxProgress", () => {
  it("renders nothing when phase is idle", () => {
    const { container } = render(
      <TxProgress phase="idle" hash={null} error={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["building", /Preparing transaction…/],
    ["signing", /Awaiting signature in Freighter…/],
    ["submitting", /Submitting to the network…/],
    ["confirming", /Confirming on-chain…/],
  ])("shows pending text for %s phase", (phase, expected) => {
    render(<TxProgress phase={phase as any} hash={null} error={null} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders error state with message and dismiss button", () => {
    const onDismiss = jest.fn();
    render(
      <TxProgress
        phase="error"
        hash={null}
        error="Network issue"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Network issue");
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders success state with explorer link when hash exists", () => {
    render(
      <TxProgress
        phase="success"
        hash="abc123"
        error={null}
        successMessage="Done"
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on stellar expert/i })).toHaveAttribute(
      "href",
      expect.stringContaining("abc123"),
    );
  });

  it("renders success state without link when hash is null", () => {
    render(
      <TxProgress
        phase="success"
        hash={null}
        error={null}
        successMessage="Done"
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
