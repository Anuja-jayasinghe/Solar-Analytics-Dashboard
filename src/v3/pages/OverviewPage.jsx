import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../data/context.js';
import { pageTodayKey } from '../data/today.js';
import { Note } from '../ui/Note.jsx';
import { TotalsRow } from '../overview/TotalsRow.jsx';
import { LiveRow } from '../overview/LiveRow.jsx';
import { errorLabel } from '../overview/format.js';
import { CebCompare } from '../ceb/CebCompare.jsx';
import { ExploreSection } from '../explore/ExploreSection.jsx';
import { TODAY_POLL_MS, dayCurve } from '../explore/power.js';

/** Re-render about once a minute so "2 min ago" and the freshness ring keep moving between data polls. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Overview. Built slice by slice: headline tiles and live row (overview-live), CEB vs Inverter (ceb-compare),
 * generation over time + through the day + statistics (generation) (docs/V3_REFACTOR_PLAN.md, P5b).
 */
export default function OverviewPage() {
  const now = useNow();
  const live = useResource('live', {}, { pollMs: 60_000 });
  const totals = useResource('totals');
  const settings = useResource('settings');
  // From live, or from totals when SolisCloud is slow or down, so the CEB comparison and the open
  // billing period do not wait on the live tile. The open period itself comes from totals (LR-001).
  const todayKey = pageTodayKey(live, totals);
  const bills = useResource('bills');
  // Today's readings, read once and shared: the day chart draws them and the Today tile takes its peak from them,
  // so the two always agree (the live reading's own peak can lag while SolisCloud's day read is slow).
  const today = useResource('telemetry', { date: todayKey }, { enabled: todayKey !== null, pollMs: TODAY_POLL_MS });
  const curvePeak = useMemo(() => dayCurve(today.data?.points, live.data, todayKey, todayKey)?.peak ?? null, [today.data, live.data, todayKey]);

  const failed = [live, totals, bills].filter((r) => r.error);
  const s = settings.data?.settings ?? null;

  return (
    <>
      {failed.length > 0 && (
        <Note tone="bad">
          Some figures could not be loaded ({[...new Set(failed.map((r) => errorLabel(r.error.code)))].join(', ')}). They are shown as a dash, never as zero.
        </Note>
      )}
      <TotalsRow
        totals={totals.data}
        live={live.data}
        todayKey={todayKey}
        loading={totals.loading}
      />
      <LiveRow live={live.data} liveError={live.error} peak={curvePeak} targetKwh={s?.dailyTargetKwh ?? null} maxKw={s?.acRatedKw ?? null} now={now} loading={live.loading} />
      <CebCompare bills={bills.data} openPeriod={totals.data?.openPeriod} live={live.data} lastStoredDay={totals.data?.generation?.lastDay} todayKey={todayKey} loading={bills.loading || totals.loading} error={bills.error} />
      <ExploreSection totals={totals.data} todayKey={todayKey} live={live.data} today={today} />
    </>
  );
}
