jest.mock("@/lib/stellar", () => ({
  ...jest.requireActual("@/lib/stellar"),
  invokeContract: jest.fn(),
  readContract: jest.fn(),
}));

import React, { useCallback, useEffect, useState } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { assetToken, contractIds, registry } from "@/lib/contracts";
import { invokeContract, readContract } from "@/lib/stellar";
import type { Network } from "@/types";

function TokenWatcher({
  network,
  tokenId,
  holder,
}: {
  network: Network;
  tokenId: string;
  holder: string;
}) {
  const [balance, setBalance] = useState<bigint>(0n);

  useEffect(() => {
    let active = true;
    assetToken.balance(network, tokenId, holder).then((val) => {
      if (active) setBalance(val);
    });
    return () => {
      active = false;
    };
  }, [network, tokenId, holder]);

  const handlePause = useCallback(async () => {
    await assetToken.pause(
      { network, source: holder, sign: jest.fn() },
      tokenId,
    );
  }, [network, holder, tokenId]);

  return (
    <div>
      <span data-testid="balance">{balance.toString()}</span>
      <button onClick={handlePause}>Pause</button>
    </div>
  );
}

describe("contracts client — stale closure and dependency array audit (#663)", () => {
  const holderA = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";
  const holderB = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
  const tokenA = "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3";
  const tokenB = "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("re-runs balance reads with updated network, tokenId, and holder without stale closure values", async () => {
    (readContract as jest.Mock)
      .mockResolvedValueOnce(100n)
      .mockResolvedValueOnce(250n)
      .mockResolvedValueOnce(900n);

    const { rerender } = render(
      <TokenWatcher network="testnet" tokenId={tokenA} holder={holderA} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("100");
    });

    rerender(<TokenWatcher network="testnet" tokenId={tokenB} holder={holderB} />);
    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("250");
    });

    rerender(<TokenWatcher network="mainnet" tokenId={tokenB} holder={holderB} />);
    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("900");
    });

    expect(readContract).toHaveBeenNthCalledWith(1, "testnet", tokenA, "balance", expect.any(Array));
    expect(readContract).toHaveBeenNthCalledWith(2, "testnet", tokenB, "balance", expect.any(Array));
    expect(readContract).toHaveBeenNthCalledWith(3, "mainnet", tokenB, "balance", expect.any(Array));
  });

  it("uses the latest WriteCtx and contractIds when invoking write callbacks after prop updates", async () => {
    (readContract as jest.Mock).mockResolvedValue(0n);
    (invokeContract as jest.Mock).mockResolvedValue({ hash: "ok" });

    const { rerender } = render(
      <TokenWatcher network="testnet" tokenId={tokenA} holder={holderA} />,
    );
    rerender(<TokenWatcher network="mainnet" tokenId={tokenB} holder={holderB} />);

    fireEvent.click(screen.getByText("Pause"));
    await waitFor(() => {
      expect(invokeContract).toHaveBeenCalledWith(
        "mainnet",
        holderB,
        tokenB,
        "pause",
        expect.any(Array),
        expect.any(Function),
        undefined,
      );
    });

    expect(contractIds("testnet").registry).not.toBe(contractIds("mainnet").registry);
    await registry.totalValueLocked("mainnet");
    expect(readContract).toHaveBeenLastCalledWith(
      "mainnet",
      contractIds("mainnet").registry,
      "total_value_locked",
    );
  });
});
