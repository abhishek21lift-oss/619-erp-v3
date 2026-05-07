// frontend/src/lib/use-async.ts
//
// Minimal data-fetching hook. SWR-lite — but no extra dependency. Solves the
// three things every page in this app currently re-implements:
//   1. abort on unmount (prevents the "set state on unmounted component" warn)
//   2. ignore stale responses when the input changes mid-flight
//   3. consistent { data, error, loading, refetch } shape

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
  /** True after the first response (success or error) has come back. */
  hasResolved: boolean;
}

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasResolved, setHasResolved] = useState(false);
  const [tick, setTick] = useState(0);

  // Keep the latest fetcher in a ref so we can refetch without re-binding deps.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    setLoading(true);
    setError(null);

    fetcherRef
      .current(ctrl.signal)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Aborted on unmount or deps-change is not an error.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setHasResolved(true);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  return { data, error, loading, refetch, hasResolved };
}
