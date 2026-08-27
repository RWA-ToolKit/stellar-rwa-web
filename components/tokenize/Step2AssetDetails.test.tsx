import { fireEvent, render, screen } from "@testing-library/react";
import { Step2AssetDetails } from "./Step2AssetDetails";

jest.mock("./Step1TokenContract", () => ({
  TokenContractPreview: () => <div>Token contract preview</div>,
}));

describe("Step2AssetDetails", () => {
  const validated = {
    tokenContract: "CABC123456789",
    metadata: {
      name: "On-chain asset",
      symbol: "AST",
      assetType: "real_estate",
      totalSupply: 1_000_000n,
      decimals: 2,
      admin: "GADMIN123456789",
      complianceContract: "CCOMPLIANCE123456",
      assetDescription: "A commercial property.",
      valuation: 100_000_00n,
      paused: false,
    },
  };

  function renderStep() {
    const onNext = jest.fn();

    render(
      <Step2AssetDetails
        validated={validated}
        initial={{}}
        onBack={jest.fn()}
        onNext={onNext}
      />,
    );

    return { onNext };
  }

  it("enforces the 100-character asset name limit", () => {
    renderStep();

    const nameInput = screen.getByRole("textbox", { name: "Asset name" });
    expect(nameInput).toHaveAttribute("maxlength", "100");

    fireEvent.change(nameInput, { target: { value: "a".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: /review/i }));

    expect(screen.getByText("Name must be 100 characters or fewer.")).toBeInTheDocument();
  });

  it("submits the selected asset type and valid details", () => {
    const { onNext } = renderStep();

    fireEvent.change(screen.getByRole("textbox", { name: "Asset name" }), {
      target: { value: "Lagos Office Tower" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Valuation (USD)" }), {
      target: { value: "1000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invoice" }));
    fireEvent.click(screen.getByRole("button", { name: /review/i }));

    expect(onNext).toHaveBeenCalledWith({
      name: "Lagos Office Tower",
      assetType: "invoice",
      valuation: 100_000_000n,
    });
  });
});