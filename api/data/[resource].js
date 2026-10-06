// api/data/[resource].js
//
// The v3 authenticated READ API. One function serves every dashboard read, which keeps the
// project inside Vercel Hobby's 12-function cap (this is function #11; merging the two CEB
// delete endpoints frees another slot). The logic lives in api/_lib/data/* and shared/domain/*,
// both of which are tested without a network.
//
//   GET /api/data/range?from&to&rate=effective|fixed&compare=prev,yoy   Explore (inverter only)
//   GET /api/data/comparison?year=YYYY                                   CEB vs inverter (LR-001)
//   GET /api/data/bills                                                  per-bill detail
//   GET /api/data/uptime?from&to                                         uptime + timeline (LR-002)
//   GET /api/data/alarms?from&to&limit                                   alarm log
//   GET /api/data/telemetry?date                                         one day, 5-minute points
//   GET /api/data/electrical?from&to                                     up to 31 completed days, summarized
//   GET /api/data/live                                                   right-now status
//   GET /api/data/settings                                               tariff / capacity / target
//   GET /api/data/export?kind=daily|uptime|alarms&from&to                CSV
//
// Authorization: Clerk, level `viewer` or above. Reads use the service-role key SERVER-SIDE;
// the browser never talks to these tables directly (decision D-2).

import { verifyAccess } from '../_lib/verifyAdminToken.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';
import { solisFetch } from '../_lib/solisAuth.js';
import { createDataHandler } from '../_lib/data/handler.js';
import { createRepo } from '../_lib/data/repo.js';
import { createLiveProvider } from '../_lib/data/live.js';
import { createRateLimiter } from '../_lib/data/rateLimit.js';

const INVERTER_SN = process.env.INVERTER_SN || '1811040244070066';

const live = createLiveProvider({
  // Today's readings, only to find the day's peak (cached 5 minutes by the provider).
  fetchDay: async (dateKey) => {
    const res = await solisFetch('/v1/api/inverterDay', { sn: INVERTER_SN, money: 'LKR', time: dateKey, timeZone: 8 });
    if (String(res?.code) !== '0') throw new Error(`inverterDay: ${res?.msg ?? 'error'}`);
    return res.data;
  },
  fetchInverter: async () => {
    const res = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 100 });
    if (String(res?.code) !== '0') throw new Error(`inverterList: ${res?.msg ?? 'error'}`);
    const records = res.data?.page?.records ?? res.data?.records ?? [];
    return records.find((r) => r.sn === INVERTER_SN) ?? null;
  }
});

export default createDataHandler({
  verify: (req, res) => verifyAccess(req, res, 'viewer'),
  repo: createRepo(supabase, INVERTER_SN),
  live,
  limiter: createRateLimiter({ limit: 120, windowMs: 60_000 }),
  ready: (res) => !blockOnConfigProblem(res)
});
