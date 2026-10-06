import { useMemo, useState } from 'react';
import { addDays, diffDays } from '../../../shared/domain/time.js';
import { usePrefetch, useResource } from '../data/context.js';
import { DateRangePicker } from '../ui/Calendar.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { Note } from '../ui/Note.jsx';
import { buildCebRows } from '../ceb/rows.js';
import { colomboClock } from '../explore/hourly.js';
import { HealthRow } from '../pro/HealthRow.jsx';
import { UptimeStrip } from '../pro/UptimeStrip.jsx';
import { AlarmTable, DataAndLogger } from '../pro/AlarmsAndData.jsx';
import { Electrical } from '../pro/Electrical.jsx';
import { ElectricalRange } from '../pro/ElectricalRange.jsx';
import { RateHistory, YearOverYear } from '../pro/Money.jsx';
import { PRO_RANGES, electricalFromTelemetry, healthSummary, proRange, rateSeries, yoyPairs } from '../pro/metrics.js';

const OPTIONS = PRO_RANGES.map((n) => ({ value: n, label: `${n} days` }));
const ELECTRICAL_OPTIONS = [{ value: 'day', label: 'Last day' }, { value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }, { value: 'custom', label: 'Custom' }];

/**
 * Pro metrics: the health of the plant rather than its output. Admin and viewers see real data;
 * visitors see the same page on demo data. Everything is read from the API: uptime (LR-002) is never
 * recomputed in the browser.
 */
export default function ProPage() {
  const [days, setDays] = useState(30);
  const [electricalKind, setElectricalKind] = useState('day');
  const [electricalCustom, setElectricalCustom] = useState(null);
  const live = useResource('live');
  const todayKey = live.data?.todayKey ?? null;
  const range = useMemo(() => (todayKey ? proRange(todayKey, days) : null), [todayKey, days]);
  const ready = range !== null;

  const uptime = useResource('uptime', { from: range?.from, to: range?.to }, { enabled: ready });
  const alarms = useResource('alarms', { from: range?.from, to: range?.to, limit: 500 }, { enabled: ready });
  const electricalRange = useMemo(() => {
    if (!todayKey) return null;
    const latest = addDays(todayKey, -1);
    if (electricalKind === 'day') return { from: latest, to: latest };
    if (electricalKind === 'week') return { from: addDays(latest, -6), to: latest };
    if (electricalKind === 'month') return { from: addDays(latest, -29), to: latest };
    const to = electricalCustom?.to && electricalCustom.to < latest ? electricalCustom.to : latest;
    const from = electricalCustom?.from ?? addDays(to, -6);
    return { from: diffDays(from, to) > 30 ? addDays(to, -30) : from, to };
  }, [todayKey, electricalKind, electricalCustom]);
  const telemetry = useResource('telemetry', { date: electricalRange?.to }, { enabled: ready && electricalKind === 'day' });
  const electricalHistory = useResource('electrical', { from: electricalRange?.from, to: electricalRange?.to }, { enabled: ready && electricalKind !== 'day' });
  const totals = useResource('totals');
  const bills = useResource('bills');

  const periodUptime = uptime.data?.from === range?.from && uptime.data?.to === range?.to ? uptime.data : null;
  const periodAlarms = alarms.data?.from === range?.from && alarms.data?.to === range?.to ? alarms.data : null;
  const summary = useMemo(() => healthSummary({ uptime: periodUptime, alarms: periodAlarms, totals: totals.data }), [periodUptime, periodAlarms, totals.data]);
  const dayData = telemetry.data?.date === electricalRange?.to ? telemetry.data : null;
  const electrical = useMemo(() => electricalFromTelemetry(dayData?.points, (ts) => colomboClock(ts).hour), [dayData]);
  const historyData = electricalHistory.data?.from === electricalRange?.from && electricalHistory.data?.to === electricalRange?.to ? electricalHistory.data : null;
  const rates = useMemo(() => rateSeries(bills.data), [bills.data]);
  const pairs = useMemo(() => yoyPairs(buildCebRows(bills.data?.bills, null, null), Infinity), [bills.data]);

  const others = todayKey ? PRO_RANGES.filter((d) => d !== days).flatMap((d) => { const r = proRange(todayKey, d); return [['uptime', { from: r.from, to: r.to }], ['alarms', { from: r.from, to: r.to, limit: 500 }]]; }) : [];
  usePrefetch(others, !!periodUptime);
  const busy = uptime.refreshing || alarms.refreshing;

  const failed = [live, uptime, alarms, totals, bills, electricalKind === 'day' ? telemetry : electricalHistory].filter((r) => r.error);
  const waiting = !ready || (!periodUptime && !uptime.error) || (!periodAlarms && !alarms.error);

  return (
    <>
      <div className="v3-tilehead">
        <div className="v3-sub" style={{ margin: 0, maxWidth: 560 }}><strong>Uptime and alarm period.</strong> Changes uptime, time stopped, unresolved alarms, the daily strip, alarm history, logger connection and days with known alarm/logger status. All-time coverage, electrical readings and bill comparisons have their own periods.</div>
        <Segmented small options={OPTIONS} value={days} onChange={setDays} label="Uptime and alarm period" />
      </div>
      {failed.length > 0 && <Note tone="bad">Some figures could not be loaded ({[...new Set(failed.map((r) => r.error.code ?? 'error'))].join(', ')}). They are shown as a dash or left empty, never as zero.</Note>}
      <div className="v3-stack" data-busy={busy ? 'true' : undefined} aria-busy={busy}>
        <HealthRow summary={summary} loading={waiting && !uptime.data} />
        <UptimeStrip days={periodUptime?.days} loading={waiting} error={uptime.error} />
        <section className="v3-twocol">
          <AlarmTable alarms={periodAlarms} loading={waiting} error={alarms.error} />
          <DataAndLogger summary={summary} uptime={periodUptime} loading={waiting} />
        </section>
      </div>
      <div className="v3-tilehead">
        <div className="v3-sub"><strong>Electrical period.</strong> Changes only the PV input, AC phase, temperature and frequency readings below. Uses completed days.</div>
        <div className="v3-controls"><Segmented small options={ELECTRICAL_OPTIONS} value={electricalKind} onChange={setElectricalKind} label="Electrical period" />
          {electricalKind === 'custom' && electricalRange && <DateRangePicker from={electricalRange.from} to={electricalRange.to} min={totals.data?.generation?.firstDay ?? null} max={addDays(todayKey, -1)} onChange={(from, to) => setElectricalCustom({ from: diffDays(from, to) > 30 ? addDays(to, -30) : from, to })} />}
        </div>
      </div>
      {electricalKind === 'day'
        ? <Electrical e={electrical} date={electricalRange?.to} loading={telemetry.loading} error={telemetry.error} />
        : <ElectricalRange data={historyData} loading={electricalHistory.loading} error={electricalHistory.error} />}
      <section className="v3-twocol">
        <RateHistory rates={rates} loading={bills.loading} error={bills.error} />
        <YearOverYear pairs={pairs} loading={bills.loading} todayKey={todayKey} firstDay={totals.data?.generation?.firstDay ?? null} />
      </section>
    </>
  );
}
