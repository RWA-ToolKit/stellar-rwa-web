"use client";

import { api, API_MAX_PAGES, API_PAGE_SIZE, type ApiEvent } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";

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

/** Recent indexed transfer events for one asset token. */
export function useActivity(tokenContract: string | null, refreshKey = 0) {
  return useAsync<TransferActivity[]>(
    async () => {
      if (!tokenContract || !api.isConfigured()) return [];

      const events: ApiEvent[] = [];
      for (let page = 0; page < API_MAX_PAGES; page++) {
        const batch = await api.getEvents({
          offset: page * API_PAGE_SIZE,
          limit: API_PAGE_SIZE,
        });
        if (!batch) {
          throw new Error(
            "Transfer history is unavailable. The indexing API could not load the events feed.",
          );
        }
        events.push(...batch);
        if (batch.length < API_PAGE_SIZE) break;
      }

      return events
        .filter(
          (event) =>
            event.contract === tokenContract && event.event_type === "Transfer",
        )
        .map(toTransferActivity)
        .filter((event): event is TransferActivity => event !== null);
    },
    [tokenContract, refreshKey],
    Boolean(tokenContract && api.isConfigured()),
  );
}
