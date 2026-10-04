import { useCallback, useMemo, useRef } from 'react';
import { useAccess } from '../access/context.js';
import { dataModeFor } from '../access/level.js';
import { cacheKey, createDemoSource, createLiveSource } from './client.js';
import { createResourceCache } from './cache.js';
import { DataContext } from './context.js';

// The demo "API" runs the shared resource code in the browser; load it only when it is needed so the
// signed-in path does not ship the demo generator.
const demoRequest = async (name, query) => (await import('../../../shared/demo/demoApi.js')).demoRequest(name, query);

export function DataProvider({ children }) {
  const { level, userId, getToken } = useAccess();
  const mode = dataModeFor(level);
  const ready = level !== 'loading';
  const cacheRef = useRef(null);
  if (!cacheRef.current) cacheRef.current = createResourceCache();

  const source = useMemo(() => (mode === 'live' ? createLiveSource({ getToken }) : createDemoSource(demoRequest)), [mode, getToken]);

  // A different mode or user must never be served the previous one's cached data.
  const epoch = `${mode}:${userId ?? 'anon'}`;
  cacheRef.current.setEpoch(epoch);

  const request = useCallback(
    (name, query, opts) => cacheRef.current.get(cacheKey(name, query), () => source(name, query, opts), opts),
    [source]
  );
  const peek = useCallback((name, query) => cacheRef.current.peek(cacheKey(name, query)), []);

  const value = useMemo(() => ({ mode, ready, epoch, request, peek }), [mode, ready, epoch, request, peek]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
