import { useCallback, useMemo, useRef } from 'react';
import { useAccess } from '../access/context.js';
import { dataModeFor } from '../access/level.js';
import { cacheKey, createDemoSource, createLiveSource } from './client.js';
import { createResourceCache } from './cache.js';
import { DataContext } from './context.js';
import { signedOutHint } from '../access/level.js';

// The demo "API" runs the shared resource code in the browser; load it only when it is needed so the
// signed-in path does not ship the demo generator.
const loadDemo = () => import('../../../shared/demo/demoApi.js');
const demoRequest = async (name, query) => (await loadDemo()).demoRequest(name, query);

// A visitor who is (by Clerk's cookie) signed out will need the demo straight away: start downloading it now,
// in parallel with the rest of the page, instead of when the first request is made. Signed-in people skip it.
if (typeof document !== 'undefined' && signedOutHint(document.cookie)) loadDemo().catch(() => {});

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
