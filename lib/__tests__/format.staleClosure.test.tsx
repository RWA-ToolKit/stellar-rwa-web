import React, { useMemo } from "react";
import { render, screen } from "@testing-library/react";
import {
  formatRawPlain,
  formatTokenAmount,
  formatUsdCents,
  holderSharePercentages,
} from "@/lib/format";

function FormattedSummary({
  rawAmount,
  decimals,
  valuationCents,
  compact,
  balances,
  supply,
}: {
  rawAmount: bigint;
  decimals: number;
  valuationCents: bigint;
  compact: boolean;
  balances: bigint[];
  supply: bigint;
}) {
  const tokenText = useMemo(
    () => formatTokenAmount(rawAmount, decimals),
    [rawAmount, decimals],
  );
  const plainText = useMemo(
    () => formatRawPlain(rawAmount, decimals),
    [rawAmount, decimals],
  );
  const usdText = useMemo(
    () => formatUsdCents(valuationCents, { compact }),
    [valuationCents, compact],
  );
  const shares = useMemo(
    () => holderSharePercentages(balances, supply),
    [balances, supply],
  );

  return (
    <div>
      <span data-testid="token">{tokenText}</span>
      <span data-testid="plain">{plainText}</span>
      <span data-testid="usd">{usdText}</span>
      <span data-testid="shares">{shares.join(",")}</span>
    </div>
  );
}

describe("format — stale closure and dependency array audit (#668)", () => {
  it("recomputes formatted token and USD strings when decimals or compact props change", () => {
    const { rerender } = render(
      <FormattedSummary
        rawAmount={123_400n}
        decimals={2}
        valuationCents={250_000_000n}
        compact={false}
        balances={[50n, 50n]}
        supply={100n}
      />,
    );

    expect(screen.getByTestId("token").textContent).toBe("1,234");
    expect(screen.getByTestId("plain").textContent).toBe("1234");
    expect(screen.getByTestId("usd").textContent).toBe("$2,500,000");
    expect(screen.getByTestId("shares").textContent).toBe("50.00,50.00");

    rerender(
      <FormattedSummary
        rawAmount={123_400n}
        decimals={4}
        valuationCents={250_000_000n}
        compact={true}
        balances={[25n, 75n]}
        supply={200n}
      />,
    );

    expect(screen.getByTestId("token").textContent).toBe("12.34");
    expect(screen.getByTestId("plain").textContent).toBe("12.34");
    expect(screen.getByTestId("usd").textContent).toBe("$2.5M");
    expect(screen.getByTestId("shares").textContent).toBe("12.51,37.49");
  });
});
