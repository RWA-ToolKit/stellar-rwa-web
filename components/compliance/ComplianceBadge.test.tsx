import { render, screen } from "@testing-library/react";
import { ComplianceBadge } from "./ComplianceBadge";

describe("ComplianceBadge", () => {
  it.each([
    ["Approved", "Approved"],
    ["Pending", "Pending"],
    ["Rejected", "Rejected"],
    ["Suspended", "Suspended"],
  ] as const)("renders the %s badge", (status, accessibleName) => {
    render(<ComplianceBadge status={status} />);

    expect(screen.getByRole("status", { name: accessibleName })).toBeInTheDocument();
  });

  it("renders a neutral fallback badge for an unrecognised status value", () => {
    // AllowlistRow passes `record.status as never` to ComplianceBadge, which
    // means an unexpected string from on-chain data can reach this component
    // at runtime without TypeScript catching it. Casting to `never` here
    // mirrors exactly how AllowlistRow calls the component in production.
    render(<ComplianceBadge status={"UnknownStatus" as never} />);

    // The component must not crash and must fall back to the neutral
    // "None" / "Not Registered" style rather than throwing on an undefined
    // STYLES lookup.
    const badge = screen.getByRole("status", { name: "Not Registered" });
    expect(badge).toBeInTheDocument();
  });
});