import { useMemo, useState } from 'react';
import { addDays } from '../../../shared/domain/time.js';
import { usePrefetch, useResource } from '../data/context.js';
import { Glass } from '../ui/Glass.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { useIsPhone } from '../ui/useIsPhone.js';
import { GenerationBody } from './GenerationBody.jsx';
import { DayBody } from './DayBody.jsx';
import { StatsBody } from './StatsBody.jsx';
import { STATS_PERIODS, buildPoints, canStepPeriod, clampYear, customRange, dataYears, dayLabelYear, dayPoints, defaultLine, isGrouped, periodLabel, periodRange, statsRange, stepPeriod, yearPoints, yearRange } from './series.js';

const TABS = [{ value: 'gen', label: 'Generation' }, { value: 'day', label: 'Day' }, { value: 'stats', label: 'Stats' }];
const VIEWS = [{ value: 'gen', label: 'Over time' }, { value: 'day', label: 'Through the day' }];

/**
 * Inverter generation over time, one day hour by hour, and statistics.
 * Desktop: one tile that switches between "over time" (default) and "through the day", plus the statistics tile.
 * Phone: one tile with three tabs, so the first screen is not a long scroll.
 * Statistics have their own period (last 30 days by default, last 365 days, lifetime).
 * Reads only the existing `range` and `telemetry` resources; nothing is computed from fabricated data.
 */
export function ExploreSection({ totals, todayKey, live = null, today = null }) {
  const phone = useIsPhone();
  const [tab, setTab] = useState('day');
  const [view, setView] = useState('day');
  const [kind, setKind] = useState('month');
  const [anchor, setAnchor] = useState(null); // a day in the week/month shown; null = the newest one with data
  const [custom, setCustom] = useState(null); // null = the latest complete bill period
  const [year, setYear] = useState(null); // null = the newest year with data
  const [style, setStyle] = useState('line');
  const [lines, setLines] = useState({ day: null, month: null });
  const [period, setPeriod] = useState('30');

  const gen = totals?.generation;
  const bounds = useMemo(() => {
    const max = gen?.lastDay ?? (todayKey ? addDays(todayKey, -1) : null);
    return { min: gen?.firstDay ?? null, max };
  }, [gen, todayKey]);
  const ready = !!bounds.max;
  const years = useMemo(() => dataYears(bounds), [bounds]);
  const shownYear = useMemo(() => clampYear(year, bounds), [year, bounds]);
  // Custom opens on the latest complete bill period (bill date to bill date); without bills, the last 30 days.
  const billPeriod = totals?.lastBillPeriod ?? null;
  const customDefault = useMemo(() => {
    if (!bounds.max) return null;
    if (billPeriod) return customRange(billPeriod.periodStart, billPeriod.periodEnd, bounds);
    return customRange(addDays(bounds.max, -29), bounds.max, bounds);
  }, [billPeriod, bounds]);

  const range = useMemo(() => {
    if (!ready) return null;
    if (kind === 'custom') return custom ? customRange(custom.from, custom.to, bounds) : customDefault;
    if (kind === 'year') return shownYear === null ? null : yearRange(shownYear, bounds);
    return periodRange(kind, anchor ?? bounds.max, bounds);
  }, [ready, kind, anchor, custom, customDefault, bounds, shownYear]);

  const res = useResource('range', { from: range?.from, to: range?.to }, { enabled: ready && !!range });
  const series = res.data?.stats?.series;
  const grouped = kind === 'year' || (range ? isGrouped(range) : false);
  const points = useMemo(
    () => (kind === 'year' && shownYear
      ? yearPoints(series ?? [], shownYear, bounds)
      : range?.full ? dayPoints(series ?? [], range.full, bounds) : buildPoints(series ?? [], grouped)),
    [series, grouped, kind, shownYear, bounds, range]
  );
  const lineKey = grouped ? 'month' : 'day';
  const line = lines[lineKey] ?? defaultLine(points, grouped);

  const sRange = useMemo(() => statsRange(period, bounds), [period, bounds]);
  const stats = useResource('range', { from: sRange?.from, to: sRange?.to }, { enabled: !!sRange });
  const statsLabel = STATS_PERIODS.find((p) => p.value === period)?.label ?? '';
  const statsText = sRange ? `${statsLabel} · ${dayLabelYear(sRange.from)} to ${dayLabelYear(sRange.to)}${stats.data ? ` · ${stats.data.stats.presentDays} of ${stats.data.stats.daysInRange} days with data` : ''}` : '';

  // Load the likely next choices in the background so clicking them is instant.
  const neighbours = [];
  if (ready && bounds.max) {
    for (const k of ['week', 'month']) {
      const r = periodRange(k, bounds.max, bounds);
      neighbours.push(['range', { from: r.from, to: r.to }]);
    }
    if (customDefault) neighbours.push(['range', { from: customDefault.from, to: customDefault.to }]);
    for (const y of years.slice(-2)) {
      const r = yearRange(y, bounds);
      neighbours.push(['range', { from: r.from, to: r.to }]);
    }
    if (range?.full && canStepPeriod(range, -1, bounds)) {
      const back = periodRange(kind, stepPeriod(kind, range, -1), bounds);
      neighbours.push(['range', { from: back.from, to: back.to }]);
    }
    for (const p of STATS_PERIODS) {
      const r = statsRange(p.value, bounds);
      if (r) neighbours.push(['range', { from: r.from, to: r.to }]);
    }
  }
  usePrefetch(neighbours, !!res.data);

  const changeKind = (k) => {
    if (k === 'custom') setCustom(null);
    else setAnchor(null);
    setKind(k);
  };
  const step = (dir) => { if (range?.full) setAnchor(stepPeriod(kind, range, dir)); };

  const genBody = (
    <GenerationBody
      showHead={false}
      kind={kind}
      onKind={changeKind}
      style={style}
      onStyle={setStyle}
      range={range}
      bounds={bounds}
      years={years}
      year={shownYear}
      onYear={(y) => setYear(clampYear(y, bounds))}
      stepLabel={range?.full ? periodLabel(kind, range) : ''}
      billPeriod={billPeriod}
      canBack={!!range?.full && canStepPeriod(range, -1, bounds)}
      canForward={!!range?.full && canStepPeriod(range, 1, bounds)}
      onStep={step}
      onCustom={(from, to) => setCustom({ from, to })}
      points={points}
      grouped={grouped}
      line={line}
      onLine={(v) => setLines((l) => ({ ...l, [lineKey]: v }))}
      loading={res.loading || !ready}
      error={res.error}
    />
  );
  const dayBody = <DayBody showHead={false} bounds={bounds} todayKey={todayKey} live={live} today={today} />;
  const statsBody = (
    <StatsBody
      showHead={!phone}
      stats={stats.data?.stats ?? null}
      loading={stats.loading || !sRange}
      error={stats.error}
      rangeText={statsText}
      period={period}
      onPeriod={setPeriod}
      periods={STATS_PERIODS}
    />
  );

  if (phone) {
    return (
      <Glass card className="v3-explore" aria-label="Explore" data-busy={(tab === 'gen' && res.refreshing) || (tab === 'stats' && stats.refreshing) ? 'true' : undefined}>
        <Segmented small fill role="tablist" options={TABS} value={tab} onChange={setTab} label="Explore" />
        {tab === 'gen' && genBody}
        {tab === 'day' && dayBody}
        {tab === 'stats' && statsBody}
      </Glass>
    );
  }
  return (
    <>
      <Glass card className="v3-explore" aria-label="Inverter generation" data-busy={view === 'gen' && res.refreshing ? 'true' : undefined} aria-busy={view === 'gen' && res.refreshing}>
        <div className="v3-tilehead">
          <div>
            <h2 className="v3-h2">{view === 'gen' ? 'Inverter generation' : 'Generation through the day'}</h2>
            <div className="v3-sub">{view === 'gen' ? `${grouped ? 'Monthly totals' : 'Daily'} · inverter only` : 'Pick a day · power in kW · Colombo time'}</div>
          </div>
          <Segmented role="tablist" options={VIEWS} value={view} onChange={setView} label="Generation view" />
        </div>
        {view === 'gen' ? genBody : dayBody}
      </Glass>
      <Glass card className="v3-explore v3-stats-tile" aria-label="Statistics" data-busy={stats.refreshing ? 'true' : undefined} aria-busy={stats.refreshing}>{statsBody}</Glass>
    </>
  );
}
