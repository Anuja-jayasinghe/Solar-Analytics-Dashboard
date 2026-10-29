// src/lib/errorReporting.js
//
// The one place a browser error goes. Error boundaries and the window-level handlers call
// reportError(); it logs to the console and forwards to the registered reporter.
//
// Until 2026-10-29 errors went to the console and nowhere else: v3's AppErrorBoundary logged,
// and nothing listened for errors outside a render at all.
//
// The reporter is Rollbar (decision D4 in docs/IMPROVEMENT_PLAN_2026-10-29.md), provisioned
// through the Vercel Marketplace. Until it is provisioned and wired with setErrorReporter(),
// reportError() only logs. Wiring it is one call in main.jsx: build the client from the
// Marketplace-provided client token and pass `(error, context) => rollbar.error(error, context)`.
// Report the Clerk user id as the person, never the e-mail address.

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
