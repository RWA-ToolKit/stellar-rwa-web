"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Run an async loader whenever its dependencies change, tracking
 * loading/error state and guarding against out-of-order responses.
 * Pass `enabled: false` to defer until preconditions are met.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const run = useCallback(() => {
    if (!enabled) {
      setLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}
