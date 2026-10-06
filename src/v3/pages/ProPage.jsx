import { useMemo, useState } from 'react';
import { usePrefetch, useResource } from '../data/context.js';
import { Segmented } from '../ui/Segmented.jsx';
import { Note } from '../ui/Note.jsx';
import { buildCebRows } from '../ceb/rows.js';
import { colomboClock } from '../explore/hourly.js';
import { HealthRow } from '../pro/HealthRow.jsx';
import { UptimeStrip } from '../pro/UptimeStrip.jsx';
import { AlarmTable, DataAndLogger } from '../pro/AlarmsAndData.jsx';
import { Electrical } from '../pro/Electrical.jsx';
import { RateHistory, YearOverYear } from '../pro/Money.jsx';
import { PRO_RANGES, electricalFromTelemetry, healthSummary, proRange, rateSeries, yoyPairs } from '../pro/metrics.js';

const OPTIONS = PRO_RANGES.map((n) => ({ value: n, label: `${n} days` }));

/**
 * Pro metrics: the health of the plant rather than its output. Admin and viewers see real data;
 * visitors see the same page on demo data. Everything is read from the API: uptime (LR-002) is never
 * recomputed in the browser.
 */
export default function ProPage() {
  const [days, setDays] = useState(30);
  const live = useResource('live');
  const todayKey = live.data?.todayKey ?? null;
  const range = useMemo(() => (todayKey ? proRange(todayKey, days) : null), [todayKey, days]);
  const ready = range !== null;

  const uptime = useResource('uptime', { from: range?.from, to: range?.to }, { enabled: ready });
  const alarms = useResource('alarms', { from: range?.from, to: range?.to, limit: 50 }, { enabled: ready });
  const telemetry = useResource('telemetry', { date: range?.to }, { enabled: ready });
  const totals = useResource('totals');
  const bills = useResource('bills');

  const summary = useMemo(() => healthSummary({ uptime: uptime.data, alarms: alarms.data, totals: totals.data }), [uptime.data, alarms.data, totals.data]);
  const electrical = useMemo(() => electricalFromTelemetry(telemetry.data?.points, (ts) => colomboClock(ts).hour), [telemetry.data]);
  const rates = useMemo(() => rateSeries(bills.data), [bills.data]);
  const pairs = useMemo(() => yoyPairs(buildCebRows(bills.data?.bills, null, null)), [bills.data]);

  const others = todayKey ? PRO_RANGES.filter((d) => d !== days).flatMap((d) => { const r = proRange(todayKey, d); return [['uptime', { from: r.from, to: r.to }], ['alarms', { from: r.from, to: r.to, limit: 50 }]]; }) : [];
  usePrefetch(others, !!uptime.data);
  const busy = uptime.refreshing || alarms.refreshing;

  const failed = [live, uptime, alarms, telemetry, totals, bills].filter((r) => r.error);
  const waiting = !ready || uptime.loading || alarms.loading;

  return (
    <>
      <div className="v3-tilehead">
        <div className="v3-sub" style={{ margin: 0, maxWidth: 560 }}>Check uptime, alarms, PV input readings and bill rates. The electrical card uses the latest completed day; the range selector applies to uptime and alarms.</div>
        <Segmented small options={OPTIONS} value={days} onChange={setDays} label="Range" />
      </div>
      {failed.length > 0 && <Note tone="bad">Some figures could not be loaded ({[...new Set(failed.map((r) => r.error.code ?? 'error'))].join(', ')}). They are shown as a dash or left empty, never as zero.</Note>}
      <div className="v3-stack" data-busy={busy ? 'true' : undefined} aria-busy={busy}>
        <HealthRow summary={summary} loading={waiting && !uptime.data} />
        <UptimeStrip days={uptime.data?.days} loading={uptime.loading} error={uptime.error} />
        <section className="v3-twocol">
          <AlarmTable alarms={alarms.data} loading={alarms.loading} error={alarms.error} />
          <DataAndLogger summary={summary} uptime={uptime.data} loading={uptime.loading} />
        </section>
      </div>
      <Electrical e={electrical} date={range?.to} loading={telemetry.loading} error={telemetry.error} />
      <section className="v3-twocol">
        <RateHistory rates={rates} loading={bills.loading} error={bills.error} />
        <YearOverYear pairs={pairs} loading={bills.loading} />
      </section>
    </>
  );
}
