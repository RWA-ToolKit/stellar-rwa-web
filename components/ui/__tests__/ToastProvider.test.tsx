import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "../ToastProvider";

function ToastHarness() {
  const { addToast } = useToast();

  return (
    <button onClick={() => addToast({ title: "Saved", description: "Your change is live." })}>
      Notify
    </button>
  );
}

describe("ToastProvider", () => {
  it("renders a toast and allows it to be dismissed", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /notify/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText("Your change is live.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
