import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cacheKey } from './client.js';
import { createPoller } from './poller.js';

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
 * never rendered as zero. `refresh()` forces a re-read; `enabled: false` waits (for a query that depends on another
 * resource) and reports not-loading with no data.
 *
 * `pollMs` makes it live (see poller.js): re-read on an interval while the tab is visible, at once when the person
 * comes back to the tab or the network returns, and sooner after a failure. A failed re-read of a live resource keeps
 * the last real result on screen with `error` set, so the view can mark it "not live" instead of going blank.
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

    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const poller = createPoller({
      pollMs,
      isHidden: hidden,
      run: async (force) => {
        const next = await load(force);
        if (alive) {
          // live: a failed re-read keeps the last real result (marked by `error`); otherwise it replaces it
          setState((s) => (next.error && pollMs > 0 && s.data !== null ? { data: s.data, error: next.error, loading: false } : next));
        }
        return !next.error;
      }
    });
    poller.start();

    let unlisten = () => {};
    if (pollMs > 0 && typeof window !== 'undefined') {
      const back = () => poller.onReturn();
      document.addEventListener('visibilitychange', back);
      window.addEventListener('focus', back);
      window.addEventListener('online', back);
      unlisten = () => {
        document.removeEventListener('visibilitychange', back);
        window.removeEventListener('focus', back);
        window.removeEventListener('online', back);
      };
    }
    return () => {
      alive = false;
      poller.stop();
      unlisten();
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
