jest.mock("@/lib/stellar", () => ({
  ...jest.requireActual("@/lib/stellar"),
  invokeContract: jest.fn(),
  readContract: jest.fn(),
}));

import React, { useEffect, useState } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { assetToken, registry } from "@/lib/contracts";
import { readContract } from "@/lib/stellar";
import type { Network } from "@/types";

function NetworkAwareAssetCount({ network }: { network: Network }) {
  const [tvl, setTvl] = useState<string>("loading");

  useEffect(() => {
    let cancelled = false;
    setTvl("loading");
    registry.totalValueLocked(network).then((val) => {
      if (!cancelled) setTvl(`${network}:${val.toString()}`);
    });
    return () => {
      cancelled = true;
    };
  }, [network]);

  return <div data-testid="tvl">{tvl}</div>;
}

describe("contracts client — network switch mid-session (#665)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("discards stale testnet in-flight data when switching to mainnet mid-session", async () => {
    let resolveTestnet!: (value: bigint) => void;
    let resolveMainnet!: (value: bigint) => void;

    (readContract as jest.Mock).mockImplementation((net: Network) => {
      if (net === "testnet") {
        return new Promise<bigint>((resolve) => {
          resolveTestnet = resolve;
        });
      }
      return new Promise<bigint>((resolve) => {
        resolveMainnet = resolve;
      });
    });

    const { rerender } = render(<NetworkAwareAssetCount network="testnet" />);
    expect(screen.getByTestId("tvl").textContent).toBe("loading");

    // Switch network to mainnet before testnet resolves
    rerender(<NetworkAwareAssetCount network="mainnet" />);

    await act(async () => {
      resolveMainnet(999_000n);
    });
    await waitFor(() => {
      expect(screen.getByTestId("tvl").textContent).toBe("mainnet:999000");
    });

    // Late testnet resolution must not overwrite mainnet state
    await act(async () => {
      resolveTestnet(111_000n);
    });
    expect(screen.getByTestId("tvl").textContent).toBe("mainnet:999000");
  });

  it("isolates assetToken.decimals cache between testnet and mainnet across network switches", async () => {
    (readContract as jest.Mock)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);

    const token = "CTOKEN_NET_SWITCH_ISOLATION";
    const testnetDecimals = await assetToken.decimals("testnet", token);
    const mainnetDecimals = await assetToken.decimals("mainnet", token);
    const cachedTestnetDecimals = await assetToken.decimals("testnet", token);

    expect(testnetDecimals).toBe(6);
    expect(mainnetDecimals).toBe(2);
    expect(cachedTestnetDecimals).toBe(6);
    expect(readContract).toHaveBeenCalledTimes(2);
  });
});
