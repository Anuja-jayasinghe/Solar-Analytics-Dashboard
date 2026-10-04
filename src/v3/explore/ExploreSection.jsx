import { useMemo, useState } from 'react';
import { addDays } from '../../../shared/domain/time.js';
import { useResource } from '../data/context.js';
import { Glass } from '../ui/Glass.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { useIsPhone } from '../ui/useIsPhone.js';
import { GenerationBody } from './GenerationBody.jsx';
import { DayBody } from './DayBody.jsx';
import { StatsBody } from './StatsBody.jsx';
import { buildPoints, canStep, customRange, dayLabelYear, defaultLine, isGrouped, presetRange, stepRange } from './series.js';

const TABS = [{ value: 'gen', label: 'Generation' }, { value: 'day', label: 'Day' }, { value: 'stats', label: 'Stats' }];

/**
 * Inverter generation over time, one day hour by hour, and statistics for the chosen range.
 * Desktop: three tiles. Phone: one tile with three tabs, so the first screen is not a long scroll.
 * Reads only the existing `range` and `telemetry` resources; nothing is computed from fabricated data.
 */
export function ExploreSection({ totals, todayKey }) {
  const phone = useIsPhone();
  const [tab, setTab] = useState('gen');
  const [kind, setKind] = useState('month');
  const [endKey, setEndKey] = useState(null); // null = follow the newest day with data
  const [custom, setCustom] = useState(null);
  const [style, setStyle] = useState('area');
  const [lines, setLines] = useState({ day: null, month: null });

  const gen = totals?.generation;
  const bounds = useMemo(() => {
    const max = gen?.lastDay ?? (todayKey ? addDays(todayKey, -1) : null);
    return { min: gen?.firstDay ?? null, max };
  }, [gen, todayKey]);
  const ready = !!bounds.max;

  const range = useMemo(() => {
    if (!ready) return null;
    if (kind === 'custom') return customRange(custom?.from ?? bounds.max, custom?.to ?? bounds.max, bounds);
    return presetRange(kind, endKey ?? bounds.max, bounds);
  }, [ready, kind, endKey, custom, bounds]);

  const res = useResource('range', { from: range?.from, to: range?.to }, { enabled: ready && !!range });
  const series = res.data?.stats?.series;
  const grouped = range ? isGrouped(range) : false;
  const points = useMemo(() => buildPoints(series ?? [], grouped), [series, grouped]);
  const lineKey = grouped ? 'month' : 'day';
  const line = lines[lineKey] ?? defaultLine(points, grouped);

  const changeKind = (k) => {
    if (k === 'custom') setCustom(range ? { from: range.from, to: range.to } : null);
    else setEndKey(null);
    setKind(k);
  };
  const step = (dir) => { if (range) setEndKey(stepRange(kind, range, dir, bounds).to); };
  const rangeText = range ? `${dayLabelYear(range.from)} to ${dayLabelYear(range.to)}${res.data ? ` · ${res.data.stats.presentDays} of ${res.data.stats.daysInRange} days with data` : ''}` : '';

  const genBody = (
    <GenerationBody
      showHead={!phone}
      kind={kind}
      onKind={changeKind}
      style={style}
      onStyle={setStyle}
      range={range}
      bounds={bounds}
      canBack={!!range && canStep(kind, range, -1, bounds)}
      canForward={!!range && canStep(kind, range, 1, bounds)}
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
  const dayBody = <DayBody showHead={!phone} bounds={bounds} />;
  const statsBody = <StatsBody showHead={!phone} stats={res.data?.stats ?? null} loading={res.loading || !ready} error={res.error} rangeText={rangeText} />;

  if (phone) {
    return (
      <Glass card className="v3-explore" aria-label="Explore">
        <Segmented small fill role="tablist" options={TABS} value={tab} onChange={setTab} label="Explore" />
        {tab === 'gen' && genBody}
        {tab === 'day' && dayBody}
        {tab === 'stats' && statsBody}
      </Glass>
    );
  }
  return (
    <>
      <Glass card className="v3-explore" aria-label="Inverter generation">{genBody}</Glass>
      <Glass card className="v3-explore" aria-label="Generation through the day">{dayBody}</Glass>
      <Glass card className="v3-explore" aria-label="Range statistics">{statsBody}</Glass>
    </>
  );
}
