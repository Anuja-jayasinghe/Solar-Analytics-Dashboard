// api/_lib/supabaseServer.js
//
// The single server-side Supabase client, plus a hard assertion that it is actually
// privileged.
//
// ============================================================================
// WHY THIS EXISTS
// ============================================================================
// Every endpoint used to build its own client like this:
//
//   const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY
//                            || process.env.SUPABASE_ANON_KEY
//                            || process.env.VITE_SUPABASE_ANON_KEY
//
// That fallback chain looks defensive and is the opposite. If the service-role key is
// missing or wrong, the client silently becomes an anon client that *half* works: reads
// succeed, storage writes succeed, and then one INSERT fails on RLS and the endpoint
// returns a generic 500. The config error is indistinguishable from a bug.
//
// It happened twice in this project:
//   - the GitHub Actions secret held an anon key, and inverter collection was dead for
//     five months with "new row violates row-level security policy" in a log nobody read;
//   - the Vercel env var held an anon key, and bill upload returned 500 after the file had
//     already been written to storage.
//
// So: no fallback. One key, asserted at startup, with an error that names the fix.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;

// Two accepted names for the SAME privileged key. This is NOT the old anon fallback: both
// names mean "the service-role key", and the role assertion below rejects an anon value under
// either. Supabase's dashboard labels the key `service_role`, so SUPABASE_SERVICE_ROLE_KEY is
// the name people reach for first — that guess cost a production outage once already, and
// there is no reason for the variable's spelling to matter.
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Read the `role` claim from a Supabase JWT without verifying the signature.
 *
 * We are not authenticating anything here — Supabase does that. We only want to know which
 * key we were handed, so a misconfiguration can be reported precisely instead of surfacing
 * later as an RLS rejection.
 *
 * Returns null for the newer `sb_secret_…` / `sb_publishable_…` formats, which are opaque.
 */
export function readKeyRole(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith('sb_secret_')) return 'service_role';
  if (key.startsWith('sb_publishable_')) return 'anon';

  const parts = key.split('.');
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString())?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Describe what is wrong with the server configuration, or null when it is fine.
 * Separated from the client so it can be unit-tested.
 */
export function describeConfigProblem(url = SUPABASE_URL, key = SUPABASE_SERVICE_KEY) {
  if (!url) {
    return {
      error: 'Missing Supabase server configuration',
      details: 'SUPABASE_URL is not set on this deployment.'
    };
  }

  if (!key) {
    return {
      error: 'Missing Supabase server configuration',
      details:
        'Neither SUPABASE_SERVICE_KEY nor SUPABASE_SERVICE_ROLE_KEY is set on this ' +
        'deployment. It must be the service_role ' +
        '(secret) key from Supabase → Project Settings → API. There is deliberately no ' +
        'fallback to the anon key: an anon client is rejected by row-level security on write ' +
        'and produces a confusing 500 rather than a clear failure.'
    };
  }

  const role = readKeyRole(key);
  if (role && role !== 'service_role') {
    return {
      error: 'Supabase server key is not a service_role key',
      details:
        `SUPABASE_SERVICE_KEY carries role "${role}". Server endpoints write to tables whose ` +
        'RLS policies only permit the service role, so every write will be rejected. Set the ' +
        'service_role (secret) key from Supabase → Project Settings → API — on Vercel AND as ' +
        'the GitHub Actions secret; they are configured separately.'
    };
  }

  return null;
}

/**
 * Guard an API handler. Returns true when the handler should stop.
 *
 * Call this before touching the database, so a misconfigured deployment answers with an
 * explanation rather than failing halfway through and leaving a file in storage.
 */
export function blockOnConfigProblem(res) {
  const problem = describeConfigProblem();
  if (!problem) return false;

  console.error('Supabase server configuration problem:', problem.error, '—', problem.details);
  res.status(500).json(problem);
  return true;
}

// A single shared client. Built with a placeholder when unconfigured so that importing this
// module never throws — the guard above is what reports the problem, at request time, with a
// useful message.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_KEY || 'placeholder-key'
);

export { SUPABASE_URL, SUPABASE_SERVICE_KEY };
