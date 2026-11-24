// src/v3/ui/errorReporting.js
//
// The one place a browser error goes. Error boundaries and the window-level handlers call
// reportError(); it logs to the console and forwards to the registered reporter.
//
// Until 2026-10-29 errors went to the console and nowhere else: v3's AppErrorBoundary logged,
// and nothing listened for errors outside a render at all.
//
// The reporter is our own (issue #241, replacing decision D4's Rollbar): createBeaconReporter() posts each
// error to /api/ops/error, which groups it in the private `error_events` table. No tracker SDK, no other
// host in the CSP, and nothing that identifies the visitor: the report holds the message, the stack, the
// page's path (no query string) and the release. The server redacts again before storing.

let reporter = null;

/** Register the function that ships an error to the tracker. */
export function setErrorReporter(fn) {
  reporter = typeof fn === 'function' ? fn : null;
}

/**
 * Report an error.
 *
 * @param {unknown} error
 * @param {{ source: string, [key: string]: unknown }} context  where it came from
 */
export function reportError(error, context = { source: 'unknown' }) {
  console.error(`[${context.source}]`, error, context);
  if (!reporter) return;
  try {
    reporter(error instanceof Error ? error : new Error(String(error)), context);
  } catch (reportingFailure) {
    // The tracker must never become the second error.
    console.warn('Error reporter failed:', reportingFailure);
  }
}

// The Vercel preview toolbar throws harmless script errors from its own origin. Only scripts
// from ANOTHER origin are considered: matching any filename containing "vercel" (the old rule)
// swallowed every error from our own bundle on *.vercel.app preview deployments.
const isForeignScript = (url) => {
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
};

const isToolbarNoise = (event) => {
  const file = event.filename || '';
  return isForeignScript(file) && (file.includes('share-modal') || file.includes('vercel.live'));
};

let installed = false;

/** Install the window-level handlers once. Called when the v3 app module loads (V3Root.jsx). */
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    if (isToolbarNoise(event)) {
      event.preventDefault();
      return;
    }
    reportError(event.error || event.message, {
      source: 'window.error',
      file: event.filename || null,
      line: event.lineno || null
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });
}

// ---------------------------------------------------------------------------------------------
// The beacon reporter
// ---------------------------------------------------------------------------------------------

export const ERROR_ENDPOINT = '/api/ops/error';

/**
 * Report errors to our own API. At most `maxPerPage` reports per page load, and each distinct
 * message once, so a render loop cannot flood the endpoint (which rate-limits as well).
 *
 * @param {{ release?: string, endpoint?: string, maxPerPage?: number,
 *           send?: (url: string, body: string) => unknown, path?: () => string }} [options]
 */
export function createBeaconReporter({
  release = null,
  endpoint = ERROR_ENDPOINT,
  maxPerPage = 10,
  send = defaultSend,
  path = () => (typeof window !== 'undefined' ? window.location.pathname : null)
} = {}) {
  const seen = new Set();
  return (error, context = {}) => {
    const message = String(error?.message || error).slice(0, 500);
    if (seen.size >= maxPerPage || seen.has(message)) return;
    seen.add(message);
    send(endpoint, JSON.stringify({
      message,
      stack: typeof error?.stack === 'string' ? error.stack.slice(0, 4000) : null,
      source: context.source || 'unknown',
      route: path(),
      release,
      file: typeof context.file === 'string' ? context.file : undefined,
      line: Number.isInteger(context.line) ? context.line : undefined
    }));
  };
}

function defaultSend(url, body) {
  const blob = new Blob([body], { type: 'application/json' });
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, blob)) return;
  // No beacon (or it was refused): a fire-and-forget fetch that outlives the page.
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit' }).catch(() => {});
}
