// api/_lib/ops/status.js — served at GET /api/ops/status by api/ops/[action].js
//
// What the Admin → Health tab shows about the pipeline and the alerts (issue #241, #181): the newest
// collector runs, the open alerts and the most recent error groups. Admin only. Each section is read on
// its own, so a table that is not set up yet (migration not applied) shows as such and the rest still
// loads.
//
//   200  { runs, alerts, errors }, each { rows: [...] } or { rows: null, problem: 'not_set_up' | 'failed' }
//   401 / 403  not signed in / not an admin (verifyAdminToken)

import { handlePreflightAndMethod } from '../httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../supabaseServer.js';
import { verifyAdminToken } from '../verifyAdminToken.js';
import { isMissingTable, withRequestLog } from '../log.js';

export const RUNS_LIMIT = 20;
export const ERRORS_LIMIT = 10;

async function section(query) {
  try {
    const { data, error } = await query;
    if (!error) return { rows: data ?? [] };
    if (isMissingTable(error)) return { rows: null, problem: 'not_set_up' };
    console.warn('[OPS] status section failed:', error.message);
    return { rows: null, problem: 'failed' };
  } catch (err) {
    console.warn('[OPS] status section failed:', err?.message);
    return { rows: null, problem: 'failed' };
  }
}

/** Read the three sections. Exported for tests. */
export async function readStatus(db) {
  const [runs, alerts, errors] = await Promise.all([
    section(db.from('collector_runs').select('id,job,status,started_at,finished_at,points_written,alarms_written,days_derived,error').order('started_at', { ascending: false }).limit(RUNS_LIMIT)),
    section(db.from('alert_state').select('key,title,opened_at,last_seen_at,occurrences,last_sent_at').eq('status', 'open').order('opened_at', { ascending: false }).limit(50)),
    section(db.from('error_events').select('fingerprint,source,message,route,release,occurrences,first_seen_at,last_seen_at').order('last_seen_at', { ascending: false }).limit(ERRORS_LIMIT))
  ]);
  if (runs.rows) runs.rows = runs.rows.map((r) => ({ ...r, error: r.error ? String(r.error).slice(0, 200) : null }));
  return { runs, alerts, errors };
}

/** @param {{ verify?: Function, db?: object }} [overrides]  for tests */
export function createStatusHandler(overrides = {}) {
  const verify = overrides.verify ?? verifyAdminToken;
  return async function status(req, res) {
    if (handlePreflightAndMethod(req, res, ['GET'])) return;
    const user = await verify(req, res);
    if (!user) return;
    if (!overrides.db && blockOnConfigProblem(res)) return;
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(await readStatus(overrides.db ?? supabase));
  };
}

export default withRequestLog('ops/status', createStatusHandler());
