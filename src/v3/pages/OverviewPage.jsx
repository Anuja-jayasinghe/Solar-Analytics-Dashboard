import { useEffect, useState } from 'react';
import { useResource } from '../data/context.js';
import { Note } from '../ui/Note.jsx';
import { TotalsRow } from '../overview/TotalsRow.jsx';
import { LiveRow } from '../overview/LiveRow.jsx';
import { CebCompare } from '../ceb/CebCompare.jsx';
import { ExploreSection } from '../explore/ExploreSection.jsx';

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
  const todayKey = live.data?.todayKey ?? null;
  const bills = useResource('bills');
  const comparison = useResource('comparison', { year: todayKey ? Number(todayKey.slice(0, 4)) : undefined }, { enabled: todayKey !== null });

  const failed = [live, totals, comparison, bills].filter((r) => r.error);
  const s = settings.data?.settings ?? null;

  return (
    <>
      {failed.length > 0 && (
        <Note tone="bad">
          Some figures could not be loaded ({[...new Set(failed.map((r) => r.error.code ?? 'error'))].join(', ')}). They are shown as a dash, never as zero.
        </Note>
      )}
      <TotalsRow
        totals={totals.data}
        comparison={comparison.data}
        todayKey={todayKey}
        loading={totals.loading || (comparison.loading && !comparison.data)}
      />
      <LiveRow live={live.data} targetKwh={s?.dailyTargetKwh ?? null} maxKw={s?.acRatedKw ?? null} now={now} loading={live.loading} />
      <CebCompare bills={bills.data} comparison={comparison.data} todayKey={todayKey} loading={bills.loading || comparison.loading} error={bills.error} />
      <ExploreSection totals={totals.data} todayKey={todayKey} />
    </>
  );
}
