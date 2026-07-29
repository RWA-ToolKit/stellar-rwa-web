"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
  subscribers: Set<() => void>;
}

/** How long a cached entry is served without triggering a background refetch. */
const DEFAULT_STALE_TIME_MS = 15_000;

/**
 * Module-level store shared by every `useAsync` consumer. Keyed by the
 * caller-supplied `cacheKey`, so navigating between screens that read the same
 * data (e.g. the registry list on /explore and an asset's entry on its detail
 * page) reuses the last response instead of re-fetching from the chain, and
 * in-flight requests for the same key are deduplicated across components.
 */
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function getEntry(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { data: undefined, timestamp: 0, subscribers: new Set() };
    cache.set(key, entry);
  }
  return entry;
}

function notify(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  for (const sub of entry.subscribers) sub();
}

/** Drop a single cached key (or the whole cache) — e.g. after a mutation. */
export function invalidateAsyncCache(key?: string) {
  if (key) {
    cache.delete(key);
    inFlight.delete(key);
  } else {
    cache.clear();
    inFlight.clear();
  }
}

/**
 * Run an async loader whenever its dependencies change, tracking
 * loading/error state and guarding against out-of-order responses.
 * Pass `enabled: false` to defer until preconditions are met.
 *
 * Pass `cacheKey` to share results across every `useAsync` call using that
 * same key: a fresh cache hit renders synchronously (no loading flash) and
 * concurrent callers dedupe onto a single in-flight request. Omit it to fall
 * back to the previous uncached, per-instance behavior.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  enabled = true,
  options?: { cacheKey?: string; staleTime?: number },
): AsyncState<T> {
  const cacheKey = options?.cacheKey;
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME_MS;
  const cached = cacheKey ? (cache.get(cacheKey) as CacheEntry | undefined) : undefined;
  const hasFreshCache = Boolean(
    cached && cached.timestamp > 0 && Date.now() - cached.timestamp < staleTime,
  );

  const [data, setData] = useState<T | null>(() =>
    cached && cached.timestamp > 0 ? (cached.data as T) : null,
  );
  const [loading, setLoading] = useState(enabled && !hasFreshCache);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  // Serialize deps to a stable string key so memoization is by value, not by
  // array identity/length — unstable references or a changing-length caller
  // deps array no longer break the useCallback dependency list below.
  const depsKey = JSON.stringify(deps);

  const run = useCallback(
    (force = false) => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      if (cacheKey) {
        const entry = getEntry(cacheKey);
        const isFresh = entry.timestamp > 0 && Date.now() - entry.timestamp < staleTime;
        if (isFresh && !force) {
          setData(entry.data as T);
          setLoading(false);
          setError(null);
          return;
        }

        const existing = inFlight.get(cacheKey) as Promise<T> | undefined;
        const request =
          existing ??
          loader().finally(() => {
            inFlight.delete(cacheKey);
          });
        if (!existing) inFlight.set(cacheKey, request as Promise<unknown>);

        // Serve stale data immediately (SWR) while the revalidation resolves.
        if (entry.timestamp > 0) {
          setData(entry.data as T);
          setLoading(false);
        } else {
          setLoading(true);
        }
        setError(null);

        const id = ++reqId.current;
        request
          .then((res) => {
            entry.data = res;
            entry.timestamp = Date.now();
            notify(cacheKey);
            if (id === reqId.current) {
              setData(res);
              setLoading(false);
            }
          })
          .catch((e) => {
            if (id === reqId.current) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
              setLoading(false);
            }
          });
        return;
      }

      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      loader()
        .then((res) => {
          if (id === reqId.current) {
            setData(res);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (id === reqId.current) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
            setLoading(false);
          }
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, depsKey, cacheKey, staleTime],
  );

  // Subscribe to cache updates from *other* components sharing this key, so
  // e.g. a refetch triggered on /explore is reflected on an open detail view.
  useEffect(() => {
    if (!cacheKey) return;
    const entry = getEntry(cacheKey);
    const onUpdate = () => {
      setData(entry.data as T);
      setLoading(false);
    };
    entry.subscribers.add(onUpdate);
    return () => {
      entry.subscribers.delete(onUpdate);
    };
  }, [cacheKey]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const refetch = useCallback(() => run(true), [run]);

  return { data, loading, error, refetch };
}
