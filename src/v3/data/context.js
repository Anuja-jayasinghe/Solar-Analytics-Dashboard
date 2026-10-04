import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cacheKey } from './client.js';

export const DataContext = createContext(null);

/**
 * Load other queries in the background (the choices a person is likely to click next), so switching to them is
 * instant. Runs once the main data is in; failures are ignored here and surface normally if the view is opened.
 * @param {Array<[string, object]>} items  [resourceName, query] pairs
 */
export function usePrefetch(items, when = true) {
  const { request, ready } = useDataSource();
  const key = JSON.stringify(items);
  useEffect(() => {
    if (!ready || !when) return undefined;
    const t = setTimeout(() => {
      for (const [name, query] of JSON.parse(key)) request(name, query).promise.catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [key, ready, when, request]);
}

export function useDataSource() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataSource must be used inside <DataProvider>');
  return ctx;
}

/**
 * Read one resource. `data` stays null until a real response arrives: a failed or pending read is
 * never rendered as zero. `refresh()` forces a re-read; `pollMs` re-reads on an interval; `enabled: false`
 * waits (for a query that depends on another resource) and reports not-loading with no data.
 */
export function useResource(name, query, { pollMs = 0, enabled = true } = {}) {
  const { ready, mode, epoch, request, peek } = useDataSource();
  const key = cacheKey(name, query);
  const [state, setState] = useState(() => ({ data: peek(name, query) ?? null, error: null, loading: true }));
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(
    async (force) => {
      try {
        const data = await request(name, queryRef.current, { force }).promise;
        return { data, error: null, loading: false };
      } catch (error) {
        return { data: null, error, loading: false };
      }
    },
    [name, request]
  );

  useEffect(() => {
    if (!ready || !enabled) {
      setState((s) => (s.loading ? { ...s, loading: false } : s));
      return undefined;
    }
    let alive = true;
    const cached = peek(name, queryRef.current);
    setState((s) => ({ data: cached ?? (s.error ? null : s.data), error: null, loading: cached === undefined }));
    load(false).then((next) => alive && setState(next));
    let timer = null;
    if (pollMs > 0) timer = setInterval(() => load(true).then((next) => alive && setState(next)), pollMs);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // `key` and `epoch` stand for the query and the data mode/user
  }, [ready, enabled, name, key, epoch, pollMs, load, peek]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return load(true).then(setState);
  }, [load]);

  // Showing the previous result while the new one loads: the screen should say it is working.
  const refreshing = state.loading && state.data !== null;
  return { ...state, refreshing, refresh, mode };
}
