jest.mock("@/lib/stellar", () => ({
  ...jest.requireActual("@/lib/stellar"),
  invokeContract: jest.fn(),
  readContract: jest.fn(),
}));

import React, { useEffect, useState } from "react";
import { render, act } from "@testing-library/react";
import { assetToken, dividend, registry } from "@/lib/contracts";
import { readContract } from "@/lib/stellar";

function InFlightContractsConsumer({ tokenId }: { tokenId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      registry.getAllAssets("testnet"),
      assetToken.totalSupply("testnet", tokenId),
      dividend.getDistributionsForAsset("testnet", tokenId),
    ])
      .then(([assets]) => {
        if (!cancelled) setCount(assets.length);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return <div>{error ?? count ?? "loading"}</div>;
}

describe("contracts client — unmount during in-flight async call (#664)", () => {
  const tokenId = "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("produces no React state-update-on-unmounted warning when in-flight reads resolve after unmount", async () => {
    let resolveCall!: (value: unknown) => void;
    (readContract as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
    );

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<InFlightContractsConsumer tokenId={tokenId} />);

    unmount();

    await act(async () => {
      resolveCall([]);
    });

    const unmountedWarnings = errorSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes("unmounted component")),
    );
    expect(unmountedWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("produces no React warning when in-flight reads reject after unmount", async () => {
    let rejectCall!: (reason?: unknown) => void;
    (readContract as jest.Mock).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectCall = reject;
        }),
    );

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<InFlightContractsConsumer tokenId={tokenId} />);

    unmount();

    await act(async () => {
      rejectCall(new Error("RPC aborted after unmount"));
    });

    const unmountedWarnings = errorSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes("unmounted component")),
    );
    expect(unmountedWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
