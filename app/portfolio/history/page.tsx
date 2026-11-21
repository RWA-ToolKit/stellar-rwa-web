"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useActivity } from "@/hooks/useActivity";
import type { TransferActivity } from "@/hooks/useActivity";

const PAGE_SIZE = 20;

type MergedActivity = TransferActivity & {
  assetName: string;
  assetSymbol: string;
  tokenContract: string;
};

type AssetActivityProps = {
  tokenContract: string;
  assetName: string;
  assetSymbol: string;
  onLoaded: (activities: MergedActivity[]) => void;
};

function AssetActivity({
  tokenContract,
  assetName,
  assetSymbol,
  onLoaded,
}: AssetActivityProps) {
  const { activities, isLoading, error, refetch } = useActivity(tokenContract);

  const merged = useMemo<MergedActivity[]>(
    () =>
      (activities ?? []).map((activity) => ({
        ...activity,
        assetName,
        assetSymbol,
        tokenContract,
      })),
    [activities, assetName, assetSymbol, tokenContract],
  );

  // Report results upward so the parent can merge across assets.
  useMemo(() => {
    onLoaded(merged);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged]);

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500">
        Loading activity for {assetSymbol}…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load activity for {assetSymbol}.{" "}
        <button
          type="button"
          onClick={() => refetch()}
          className="underline"
        >
          Retry
        </button>
      </p>
    );
  }

  return null;
}

function formatTimestamp(timestamp: string | number | null | undefined): string {
  if (timestamp === null || timestamp === undefined) {
    return "—";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

export default function PortfolioHistoryPage() {
  const { address, isConnected } = useWallet();
  const { holdings, isLoading: isPortfolioLoading, error: portfolioError, refetch: refetchPortfolio } =
    usePortfolio(address);

  const [page, setPage] = useState(0);
  const [activityMap, setActivityMap] = useState<Record<string, MergedActivity[]>>(
    {},
  );

  const handleLoaded = (tokenContract: string, activities: MergedActivity[]) => {
    setActivityMap((prev) => {
      if (prev[tokenContract] === activities) {
        return prev;
      }
      return { ...prev, [tokenContract]: activities };
    });
  };

  const mergedActivities = useMemo<MergedActivity[]>(() => {
    const all = Object.values(activityMap).flat();
    return all.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : null;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : null;
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return bTime - aTime;
    });
  }, [activityMap]);

  const totalPages = Math.max(1, Math.ceil(mergedActivities.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = mergedActivities.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  if (!isConnected || !address) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Transaction History</h1>
          <Link href="/portfolio" className="text-sm underline">
            Back to portfolio
          </Link>
        </div>
        <p className="text-gray-600">
          Connect your wallet to view your transaction history.
        </p>
      </main>
    );
  }

  if (isPortfolioLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Transaction History</h1>
          <Link href="/portfolio" className="text-sm underline">
            Back to portfolio
          </Link>
        </div>
        <p className="text-sm text-gray-500">Loading your holdings…</p>
      </main>
    );
  }

  if (portfolioError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Transaction History</h1>
          <Link href="/portfolio" className="text-sm underline">
            Back to portfolio
          </Link>
        </div>
        <p className="text-sm text-red-600">
          Failed to load your holdings.{" "}
          <button
            type="button"
            onClick={() => refetchPortfolio()}
            className="underline"
          >
            Retry
          </button>
        </p>
      </main>
    );
  }

  if (!holdings || holdings.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Transaction History</h1>
          <Link href="/portfolio" className="text-sm underline">
            Back to portfolio
          </Link>
        </div>
        <p className="text-gray-600">
          You don&apos;t hold any assets yet, so there is no transaction history
          to display.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transaction History</h1>
        <Link href="/portfolio" className="text-sm underline">
          Back to portfolio
        </Link>
      </div>

      {holdings.map((holding) => (
        <AssetActivity
          key={holding.tokenContract}
          tokenContract={holding.tokenContract}
          assetName={holding.name ?? holding.symbol ?? holding.tokenContract}
          assetSymbol={holding.symbol ?? holding.tokenContract}
          onLoaded={(activities) => handleLoaded(holding.tokenContract, activities)}
        />
      ))}

      {mergedActivities.length === 0 ? (
        <p className="text-gray-600">
          No transactions found across your assets.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-200">
            {pageItems.map((activity, index) => (
              <li
                key={`${activity.tokenContract}-${activity.txHash ?? index}-${index}`}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium">
                    {activity.type ?? "Transfer"} · {activity.assetSymbol}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activity.assetName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{formatTimestamp(activity.timestamp)}</p>
                  {activity.amount !== undefined && activity.amount !== null && (
                    <p className="text-sm text-gray-500">
                      {activity.amount} {activity.assetSymbol}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}