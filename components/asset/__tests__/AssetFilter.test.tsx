import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetFilter } from "../AssetFilter";
import type { FilterValue } from "../AssetFilter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultValue: FilterValue = { type: "all", sort: "valuation" };

function renderFilter(
  overrides: Partial<FilterValue> = {},
  onChange = jest.fn(),
  counts?: Record<string, number>,
) {
  const value: FilterValue = { ...defaultValue, ...overrides };
  return {
    onChange,
    ...render(
      <AssetFilter
        value={value}
        onChange={onChange}
        counts={counts as Parameters<typeof AssetFilter>[0]["counts"]}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetFilter", () => {
  describe("type filter chips", () => {
    it("renders all four filter chips", () => {
      renderFilter();

      // The four options are: All Assets, Real Estate, Invoice, Commodity
      expect(screen.getByRole("button", { name: /all assets/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /real estate/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /invoice/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /commodity/i })).toBeInTheDocument();
    });

    it("marks the active chip with aria-pressed=true", () => {
      renderFilter({ type: "all" });

      expect(screen.getByRole("button", { name: /all assets/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: /real estate/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("marks the correct chip as active for a non-default type", () => {
      renderFilter({ type: "invoice" });

      expect(screen.getByRole("button", { name: /invoice/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: /all assets/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("calls onChange with the selected type when a chip is clicked", async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({ type: "all" });

      await user.click(screen.getByRole("button", { name: /real estate/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ type: "real_estate", sort: "valuation" });
    });

    it("calls onChange with the correct type for each chip", async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({ type: "all" });

      await user.click(screen.getByRole("button", { name: /commodity/i }));
      expect(onChange).toHaveBeenLastCalledWith({ type: "commodity", sort: "valuation" });

      await user.click(screen.getByRole("button", { name: /invoice/i }));
      expect(onChange).toHaveBeenLastCalledWith({ type: "invoice", sort: "valuation" });
    });
  });

  describe("count badges", () => {
    const counts = { all: 10, real_estate: 5, invoice: 3, commodity: 2 };

    it("renders count badges when counts are provided", () => {
      renderFilter({}, jest.fn(), counts);

      // Each chip should include its count value in the rendered text
      // (the button text is "All Assets10", "Real Estate5", etc.)
      expect(screen.getByRole("button", { name: /all assets/i })).toHaveTextContent("10");
      expect(screen.getByRole("button", { name: /real estate/i })).toHaveTextContent("5");
      expect(screen.getByRole("button", { name: /invoice/i })).toHaveTextContent("3");
      expect(screen.getByRole("button", { name: /commodity/i })).toHaveTextContent("2");
    });

    it("does not render count badges when counts are not provided", () => {
      renderFilter();

      // Labels only, no number suffix
      expect(screen.getByRole("button", { name: /all assets/i })).toHaveTextContent(
        "All Assets",
      );
      expect(
        screen.getByRole("button", { name: /all assets/i }).textContent,
      ).not.toMatch(/\d/);
    });
  });

  describe("sort dropdown", () => {
    it("renders the sort select with the correct initial value", () => {
      renderFilter({ sort: "valuation" });

      const select = screen.getByRole("combobox");
      expect(select).toHaveValue("valuation");
    });

    it("renders the 'newest' sort option when sort is newest", () => {
      renderFilter({ sort: "newest" });

      const select = screen.getByRole("combobox");
      expect(select).toHaveValue("newest");
    });

    it("calls onChange with updated sort when the select changes", async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({ sort: "valuation" });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "newest");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ type: "all", sort: "newest" });
    });

    it("calls onChange with updated sort back to valuation", async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({ sort: "newest" });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "valuation");

      expect(onChange).toHaveBeenCalledWith({ type: "all", sort: "valuation" });
    });
  });
});
