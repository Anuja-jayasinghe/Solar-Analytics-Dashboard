// shared/demo/demoApi.js
//
// The demo's "API": the same resource functions the real endpoint runs, against the in-memory
// demo dataset. The frontend's demo data source calls demoRequest() exactly where the live data
// source calls GET /api/data/{resource}, and gets responses of identical shape.
//
// The demo never touches the network, Supabase, Clerk or SolisCloud.

import { resolveResource } from '../data/resources.js';
import { DEMO, createDemoDataset, createDemoRepo, demoLive, demoTodayPoints } from './demoData.js';

let repo = null;
let lifetimeKwh = null;

function getRepo() {
  if (!repo) {
    const ds = createDemoDataset();
    repo = createDemoRepo(ds);
    // The demo inverter's lifetime counter: every demo day plus today so far, so it agrees with the daily records.
    lifetimeKwh = Math.round(ds.dailyRows.reduce((s, r) => s + (r.kwh ?? 0), 0) + demoLive().todayKwh);
  }
  return repo;
}

/**
 * @param {string} name   resource name, e.g. 'range'
 * @param {object} query  the same query parameters as the real endpoint
 * @returns {Promise<{body?:object, csv?:string, filename?:string}>}
 * @throws {HttpError} with the same status/code as the real endpoint for bad input
 */
export function demoRequest(name, query = {}) {
  const run = resolveResource(name);
  const live = async () => ({ ...demoLive(), totalKwh: lifetimeKwh });
  live.today = async () => ({ date: DEMO.today, points: demoTodayPoints(), fetchedAt: null });
  return run(getRepo(), query, { todayKey: DEMO.today, live });
}

export { DEMO };
