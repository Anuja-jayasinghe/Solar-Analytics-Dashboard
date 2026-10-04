import { useEffect, useState } from 'react';
import { useResource } from '../data/context.js';
import { Note } from '../ui/Note.jsx';
import { TotalsRow } from '../overview/TotalsRow.jsx';
import { LiveRow } from '../overview/LiveRow.jsx';

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
 * Overview. This slice (overview-live) builds the headline tiles and the live row. The CEB comparison,
 * generation charts and statistics arrive in the following slices (docs/V3_REFACTOR_PLAN.md, P5b).
 */
export default function OverviewPage() {
  const now = useNow();
  const live = useResource('live', {}, { pollMs: 60_000 });
  const totals = useResource('totals');
  const settings = useResource('settings');
  const todayKey = live.data?.todayKey ?? null;
  const comparison = useResource('comparison', { year: todayKey ? Number(todayKey.slice(0, 4)) : undefined }, { enabled: todayKey !== null });

  const failed = [live, totals, comparison].filter((r) => r.error);
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
      <Note>CEB vs Inverter, generation over time and statistics are the next slices (docs/design/v3).</Note>
    </>
  );
}
