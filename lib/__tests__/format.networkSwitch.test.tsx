import React, { useEffect, useState } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { formatTokenAmount, formatUsdCents } from "@/lib/format";
import type { Network } from "@/types";

function NetworkFormattedAsset({
  network,
  fetchSnapshot,
}: {
  network: Network;
  fetchSnapshot: (net: Network) => Promise<{ raw: bigint; decimals: number; cents: bigint }>;
}) {
  const [summary, setSummary] = useState<string>("loading");

  useEffect(() => {
    let cancelled = false;
    setSummary("loading");
    fetchSnapshot(network).then(({ raw, decimals, cents }) => {
      if (cancelled) return;
      setSummary(
        `${network}:${formatTokenAmount(raw, decimals)}:${formatUsdCents(cents, { compact: true })}`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [network, fetchSnapshot]);

  return <div data-testid="summary">{summary}</div>;
}

describe("format — network switch mid-session (testnet/mainnet) (#670)", () => {
  it("prevents stale testnet formatted output from leaking after switching to mainnet", async () => {
    let resolveTestnet!: (v: { raw: bigint; decimals: number; cents: bigint }) => void;
    let resolveMainnet!: (v: { raw: bigint; decimals: number; cents: bigint }) => void;

    const fetchSnapshot = jest.fn((net: Network) => {
      if (net === "testnet") {
        return new Promise<{ raw: bigint; decimals: number; cents: bigint }>((r) => {
          resolveTestnet = r;
        });
      }
      return new Promise<{ raw: bigint; decimals: number; cents: bigint }>((r) => {
        resolveMainnet = r;
      });
    });

    const { rerender } = render(
      <NetworkFormattedAsset network="testnet" fetchSnapshot={fetchSnapshot} />,
    );
    expect(screen.getByTestId("summary").textContent).toBe("loading");

    rerender(
      <NetworkFormattedAsset network="mainnet" fetchSnapshot={fetchSnapshot} />,
    );

    await act(async () => {
      resolveMainnet({ raw: 250_000n, decimals: 2, cents: 500_000_000n });
    });

    await waitFor(() => {
      expect(screen.getByTestId("summary").textContent).toBe("mainnet:2,500:$5M");
    });

    await act(async () => {
      resolveTestnet({ raw: 999_999n, decimals: 6, cents: 100_000_000n });
    });

    expect(screen.getByTestId("summary").textContent).toBe("mainnet:2,500:$5M");
  });
});
