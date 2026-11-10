import React, { useEffect, useState } from "react";
import { render, act } from "@testing-library/react";
import {
  formatTokenAmount,
  formatUsdCents,
  holderSharePercentages,
} from "@/lib/format";

function AsyncFormattedValuation({
  loadData,
}: {
  loadData: () => Promise<{ cents: bigint; raw: bigint; decimals: number }>;
}) {
  const [display, setDisplay] = useState<string>("loading");

  useEffect(() => {
    let cancelled = false;
    loadData()
      .then(({ cents, raw, decimals }) => {
        if (cancelled) return;
        const usd = formatUsdCents(cents, { compact: true });
        const tok = formatTokenAmount(raw, decimals);
        const [share] = holderSharePercentages([raw], raw);
        setDisplay(`${usd} / ${tok} (${share}%)`);
      })
      .catch(() => {
        if (!cancelled) setDisplay("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  return <div>{display}</div>;
}

describe("format — unmount during in-flight async call (#669)", () => {
  it("does not emit state-update-on-unmounted warnings when formatting resolves after unmount", async () => {
    let resolveLoad!: (val: { cents: bigint; raw: bigint; decimals: number }) => void;
    const loadData = jest.fn(
      () =>
        new Promise<{ cents: bigint; raw: bigint; decimals: number }>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<AsyncFormattedValuation loadData={loadData} />);

    unmount();

    await act(async () => {
      resolveLoad({ cents: 500_000_000n, raw: 100_000n, decimals: 2 });
    });

    const unmountedWarnings = errorSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes("unmounted component")),
    );
    expect(unmountedWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
