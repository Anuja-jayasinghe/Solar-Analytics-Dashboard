// api/_lib/serviceKeyGuard.js
//
// Start-up check for anything that writes to Supabase outside the API: the scheduled
// collectors in functions/ and the maintenance scripts in scripts/.
//
// Why this exists: the assertion that `SUPABASE_SERVICE_KEY` really is a service-role key lived
// only in api/_lib/supabaseServer.js, protecting the API. The component that actually failed
// in the five-month outage was the GitHub Actions collector — its secret held an anon key, so
// every insert was rejected by row-level security while every read still worked, and the job
// logged an error nobody read. The freshness check added afterwards detects that after days;
// this stops it on the first run, with a message that names the fix.
//
// It takes the values as arguments (rather than reading the environment) so it works no matter
// when `dotenv` was loaded, and it imports nothing that talks to the network.

import { describeConfigProblem } from './supabaseServer.js';

/**
 * Exit the process with a clear message if the Supabase URL or service key is unusable.
 *
 * @param {string|undefined} url
 * @param {string|undefined} key
 * @param {(code: number) => never} [exit] injectable for tests
 * @returns {void}
 */
export function exitOnServiceKeyProblem(url, key, exit = (code) => process.exit(code)) {
  const problem = describeConfigProblem(url, key);
  if (!problem) return;

  console.error(`❌ [CRITICAL] ${problem.error}`);
  console.error(`   ${problem.details}`);
  exit(1);
}
