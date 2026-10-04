// src/v3/data/client.js
//
// The browser's only way to read dashboard data. Two interchangeable sources with the same call
// shape, `source(resourceName, query) -> body`:
//   - live: GET /api/data/{resource} with the Clerk session token (viewer or admin only)
//   - demo: the very same resource code run in the browser against generated 2035+ data
// Nothing here talks to Supabase. Unknown/failed is an ApiError, never a made-up empty value.

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Stable query string: sorted keys, null/undefined/'' dropped, so equal queries share a cache key. */
export function buildQuery(query = {}) {
  const parts = Object.keys(query)
    .filter((k) => query[k] !== null && query[k] !== undefined && query[k] !== '')
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`);
  return parts.join('&');
}

export function cacheKey(name, query) {
  return `${name}?${buildQuery(query)}`;
}

/**
 * @param {{getToken:()=>Promise<string|null>, fetchImpl?:typeof fetch, base?:string}} deps
 */
export function createLiveSource({ getToken, fetchImpl = (...a) => globalThis.fetch(...a), base = '/api/data' }) {
  return async function live(name, query = {}, { signal } = {}) {
    const token = await getToken();
    if (!token) throw new ApiError('Not signed in', { status: 401, code: 'no_session' });
    const qs = buildQuery(query);
    let res;
    try {
      res = await fetchImpl(`${base}/${encodeURIComponent(name)}${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new ApiError('Network error', { status: 0, code: 'network' });
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error pages (e.g. a platform 502) fall through to the status handling below */
    }
    if (!res.ok) {
      throw new ApiError(body?.error || `Request failed (${res.status})`, { status: res.status, code: body?.code || `http_${res.status}` });
    }
    if (body === null || typeof body !== 'object') throw new ApiError('Unreadable response', { status: res.status, code: 'bad_body' });
    return body;
  };
}

/** @param {(name:string, query:object)=>Promise<{body?:object}>} demoRequest shared/demo/demoApi.js */
export function createDemoSource(demoRequest) {
  return async function demo(name, query = {}) {
    try {
      const out = await demoRequest(name, query);
      if (!out || typeof out.body !== 'object') throw new ApiError('Unreadable demo response', { code: 'bad_body' });
      return out.body;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Demo request failed', { status: err?.status ?? 400, code: err?.code ?? 'demo_error' });
    }
  };
}
