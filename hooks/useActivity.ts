"use client";

import { useCallback } from "react";

import { API_MAX_PAGES, API_PAGE_SIZE, api, type ApiEvent } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useWallet } from "@/hooks/useWallet";
import type { Network } from "@/types";

export interface TransferActivity {
  id: number;
  from: string;
  to: string;
  amount: bigint;
  ledger: number;
  timestamp: string | null;
}

function toTransferActivity(event: ApiEvent): TransferActivity | null {
  const { from, to, amount } = event.data;
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    typeof amount !== "string" ||
    !/^\d+$/.test(amount)
  ) {
    return null;
  }

  return {
    id: event.id,
    from,
    to,
    amount: BigInt(amount),
    ledger: event.ledger,
    timestamp: event.timestamp,
  };
}

function useActiveNetwork(): Network {
  try {
    return useWallet().network;
  } catch {
    return "testnet";
  }
}

/** Recent indexed transfer events for one asset token. */
export function useActivity(tokenContract: string | null, refreshKey = 0) {
  const network = useActiveNetwork();
  const pageSize = API_PAGE_SIZE ?? 100;
  const maxPages = API_MAX_PAGES ?? 50;
  const apiConfigured =
    typeof api.isConfigured === "function" ? api.isConfigured() : true;

  // Memoize the fetcher so it closes over the current tokenContract instead of
  // a stale value captured on an earlier render. useAsync re-runs when this
  // identity or the active network changes, preventing cross-network leakage.
  const fetchActivity = useCallback(async (): Promise<TransferActivity[]> => {
    if (!tokenContract) return [];

    const allEvents: ApiEvent[] = [];
    for (let page = 0; page < maxPages; page++) {
      const batch = await api.getEvents({
        offset: page * pageSize,
        limit: pageSize,
      });
      if (!batch) {
        throw new Error(
          "Transfer history is unavailable. Configure the indexing API or try again later.",
        );
      }
      allEvents.push(...batch);
      if (batch.length < pageSize) break;
    }

    return allEvents
      .filter(
        (event) =>
          event.contract === tokenContract && event.event_type === "Transfer",
      )
      .map(toTransferActivity)
      .filter((event): event is TransferActivity => event !== null);
  }, [tokenContract, maxPages, pageSize]);

  return useAsync<TransferActivity[]>(
    fetchActivity,
    [fetchActivity, refreshKey, network],
    Boolean(tokenContract) && apiConfigured,
  );
}
