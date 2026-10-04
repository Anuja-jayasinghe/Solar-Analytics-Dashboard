import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccess } from '../access/context.js';
import { createAdminApi } from '../data/adminApi.js';

/** The admin API bound to the current session's token. */
export function useAdminApi() {
  const { getToken } = useAccess();
  return useMemo(() => createAdminApi({ getToken }), [getToken]);
}

/**
 * Load something once and on demand. `data` stays null until a real answer arrives; `reload()` re-reads
 * (used after every write so the screen shows what the server holds).
 */
export function useAdminLoad(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await loadRef.current(), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, []);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
