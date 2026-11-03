import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays } from '../../../shared/domain/time.js';
import { usePrefetch, useResource } from '../data/context.js';
import { Segmented } from '../ui/Segmented.jsx';
import { Note } from '../ui/Note.jsx';
import { DatePicker } from '../ui/Calendar.jsx';
import { axisTicks, chartNum, maxOf, niceMax } from '../charts/scale.js';
import { DASH, fmtNum } from '../overview/format.js';
import { dayLabelYear } from './series.js';
import { FIRST_HOUR, LAST_HOUR, hourlyFromTelemetry } from './hourly.js';
import { DAY_END_MIN, DAY_START_MIN, nearestPoint, powerCurve, xOfMinute } from './power.js';

const VIEWS = [{ value: 'power', label: 'Power' }, { value: 'hourly', label: 'Per hour' }];
const TODAY_POLL_MS = 120_000; // the server re-reads SolisCloud at most every 5 minutes; this just picks it up
const HOUR_TICKS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 2 }, (_, i) => FIRST_HOUR + i);

/** The live reading as a curve point, when it belongs to the day shown and is current. */
function liveNow(live, date, todayKey) {
  if (!live || date !== todayKey || live.stale) return null;
  const tsMs = live.dataTimestamp ?? live.fetchedAt;
  return typeof live.currentPowerKw === 'number' && Number.isFinite(tsMs) ? { kw: live.currentPowerKw, tsMs } : null;
}

/** The power curve: 5-minute kW, the peak marked, a "now" dot for today, and a hover line with time and kW. */
function PowerChart({ curve, isToday }) {
  const [hover, setHover] = useState(null);
  const yMax = niceMax(Math.max(maxOf(curve.pts.map((p) => p.kw), 1) * 1.15, 1));
  const y = (kw) => 100 - (kw / yMax) * 100;
  const segs = curve.segments.map((idx) => idx.map((i) => curve.pts[i]));
  const line = segs.map((s) => s.map((p, j) => `${j ? 'L' : 'M'} ${xOfMinute(p.min).toFixed(2)} ${y(p.kw).toFixed(2)}`).join(' ')).join(' ');
  const area = segs.filter((s) => s.length > 1).map((s) => `M ${xOfMinute(s[0].min).toFixed(2)} 100 ${s.map((p) => `L ${xOfMinute(p.min).toFixed(2)} ${y(p.kw).toFixed(2)}`).join(' ')} L ${xOfMinute(s[s.length - 1].min).toFixed(2)} 100 Z`).join(' ');

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const min = DAY_START_MIN + ((e.clientX - r.left) / r.width) * (DAY_END_MIN - DAY_START_MIN);
    setHover(nearestPoint(curve.pts, min));
  };
  const peakX = xOfMinute(curve.peak.min);
  const edge = (x) => (x < 12 ? 'start' : x > 88 ? 'end' : 'mid'); // keep labels inside the plot near its edges

  return (
    <div className="v3-chartgrid">
      <div className="v3-yaxis" aria-hidden="true">{axisTicks(yMax, (v) => fmtNum(v, v < 10 && v % 1 ? 1 : 0)).map((t) => <span key={t.pct}>{t.label}</span>)}</div>
      <div className="v3-plotwrap">
        <div
          className="v3-plot v3-power"
          style={{ height: 'var(--plot-h)' }}
          role="img"
          aria-label={`Power through the day. Peak ${fmtNum(curve.peak.kw, 1)} kW at ${curve.peak.at}${isToday ? ` so far; latest ${fmtNum(curve.last.kw, 1)} kW at ${curve.last.at}` : ''}.`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHover(null); }}
        >
          {axisTicks(yMax).map((t) => <div key={t.pct} className="v3-gridline" style={{ bottom: `${t.pct}%` }} />)}
          <svg className="v3-plot-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={area} fill="url(#areaFill)" />
            <path d={line} fill="none" style={{ stroke: 'var(--gen)' }} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>

          <span className="v3-peakmark" style={{ left: `${peakX}%`, bottom: `${100 - y(curve.peak.kw)}%` }} aria-hidden="true" />
          <span className="v3-peaklabel" data-edge={edge(peakX)} style={{ left: `${peakX}%`, bottom: `calc(${100 - y(curve.peak.kw)}% + 12px)` }} aria-hidden="true">
            {isToday ? 'Peak so far' : 'Peak'} <b>{fmtNum(curve.peak.kw, 1)} kW</b> · {curve.peak.at}
          </span>

          {isToday && curve.last.min !== curve.peak.min && (
            <span className="v3-nowmark" style={{ left: `${xOfMinute(curve.last.min)}%`, bottom: `${100 - y(curve.last.kw)}%` }} aria-hidden="true" />
          )}

          {hover && (
            <>
              <span className="v3-crosshair" style={{ left: `${xOfMinute(hover.min)}%` }} aria-hidden="true" />
              <span className="v3-hoverdot" style={{ left: `${xOfMinute(hover.min)}%`, bottom: `${100 - y(hover.kw)}%` }} aria-hidden="true" />
              <span className="v3-hoverlabel" data-edge={edge(xOfMinute(hover.min))} style={{ left: `${xOfMinute(hover.min)}%`, bottom: `calc(${100 - y(hover.kw)}% + 14px)` }} aria-hidden="true">
                <b>{fmtNum(hover.kw, 1)} kW</b> · {hover.at}{hover.live ? ' · now' : ''}
              </span>
            </>
          )}
        </div>
        <div className="v3-hourticks" aria-hidden="true">
          {HOUR_TICKS.map((h) => <span key={h} style={{ left: `${xOfMinute(h * 60)}%` }}>{h}</span>)}
        </div>
        <div className="v3-sub" style={{ textAlign: 'center', margin: '4px 0 0' }}>
          Colombo time · power every 5 minutes{isToday ? ' · updates live' : ''}
        </div>
      </div>
    </div>
  );
}

/** The day hour by hour: kWh generated in each hour (09 = 09:00 to 10:00). */
function HourlyChart({ day }) {
  const hours = day.hours;
  const yMax = niceMax(Math.max(maxOf(hours.map((h) => h.kwh), 1) * 1.12, 1));
  return (
    <div className="v3-chartgrid">
      <div className="v3-yaxis" aria-hidden="true">{axisTicks(yMax, (v) => fmtNum(v, v < 10 && v % 1 ? 1 : 0)).map((t) => <span key={t.pct}>{t.label}</span>)}</div>
      <div className="v3-plotwrap">
        <div className="v3-plot" style={{ height: 'var(--plot-h)' }}>
          {axisTicks(yMax).map((t) => <div key={t.pct} className="v3-gridline" style={{ bottom: `${t.pct}%` }} />)}
          <div className="v3-cols" style={{ gap: 0 }}>
            {hours.map((h) => (
              <div key={h.hour} className="v3-col" style={{ padding: 0 }}>
                <div className="v3-bar single" style={{ height: `${(h.kwh / yMax) * 100}%`, background: 'var(--gen)', maxWidth: 30, width: '60%', flex: '0 0 auto' }}><span className="v3-val">{h.kwh > 0 ? chartNum(h.kwh) : ''}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="v3-xlabels" style={{ gap: 0 }}>{hours.map((h) => <div key={h.hour} className="v3-xlabel v3-xplain">{h.hour}</div>)}</div>
        <div className="v3-sub" style={{ textAlign: 'center', margin: '4px 0 0' }}>kWh in each hour (9 = 09:00 to 10:00)</div>
      </div>
    </div>
  );
}

/**
 * "Generation through the day": the inverter's power every 5 minutes (as SolisCloud shows it), or kWh per hour.
 * Opens on today, which follows the live reading; past days come from the stored telemetry.
 */
export function DayBody({ showHead, bounds, todayKey = null, live = null }) {
  const [picked, setPicked] = useState(null); // null = follow today (or the newest day with data)
  const [view, setView] = useState('power');
  const maxDay = todayKey ?? bounds.max;
  const date = picked ?? maxDay;
  const isToday = !!date && date === todayKey;
  const enabled = !!date;
  const res = useResource('telemetry', { date }, { enabled, pollMs: isToday ? TODAY_POLL_MS : 0 });
  const points = res.data?.points;
  const now = liveNow(live, date, todayKey);
  const nowKw = now?.kw ?? null;
  const nowTs = now?.tsMs ?? null;
  const curve = useMemo(() => powerCurve(points, nowTs === null ? null : { kw: nowKw, tsMs: nowTs }), [points, nowKw, nowTs]);
  const day = useMemo(() => hourlyFromTelemetry(points), [points]);
  // the neighbouring days, so stepping with the arrows is instant
  usePrefetch(date ? [['telemetry', { date: addDays(date, -1) }], ...(maxDay && date < maxDay ? [['telemetry', { date: addDays(date, 1) }]] : [])] : [], !!res.data);

  const move = (n) => { if (date) setPicked(addDays(date, n)); };
  const hasData = view === 'power' ? !!curve : !!day;
  const noData = enabled && !res.loading && !res.error && !hasData;
  // Today's total from the inverter's own counter when the live reading has it; otherwise the readings, integrated.
  const totalKwh = isToday && typeof live?.todayKwh === 'number' ? live.todayKwh : day?.totalKwh ?? null;
  const peak = curve?.peak ?? null;

  return (
    <>
      <div className="v3-tilehead">
        {showHead ? (
          <div>
            <h2 className="v3-h2">Generation through the day</h2>
            <div className="v3-sub">Pick a day · Colombo time</div>
          </div>
        ) : null}
        <div className="v3-controls">
          <Segmented small options={VIEWS} value={view} onChange={setView} label="Chart view" />
          <div className="v3-stepper">
            <button type="button" className="v3-iconbtn sm" onClick={() => move(-1)} disabled={!date || (bounds.min && date <= bounds.min)} aria-label="Previous day"><ChevronLeft size={15} /></button>
            <DatePicker value={date} min={bounds.min} max={maxDay} onChange={setPicked} />
            <button type="button" className="v3-iconbtn sm" onClick={() => move(1)} disabled={!date || (maxDay && date >= maxDay)} aria-label="Next day"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      <div className="v3-markrow">
        <span className="v3-pill" data-tone="gen">{totalKwh === null ? DASH : `${fmtNum(totalKwh, 1)} kWh ${isToday ? 'so far today' : 'that day'}`}</span>
        <span className="v3-pill">{peak ? `${isToday ? 'Peak so far' : 'Peak'} ${fmtNum(peak.kw, 1)} kW at ${peak.at}` : 'Peak —'}</span>
        {isToday && curve && <span className="v3-pill" data-tone="good"><span className="v3-livedot" aria-hidden="true" />Live · {curve.last.at}</span>}
        <span className="v3-sub" style={{ margin: 0 }}>{date ? `${isToday ? 'Today · ' : ''}${dayLabelYear(date)}` : ''}</span>
      </div>

      {res.error && <Note tone="bad">Could not load this day ({res.error.code ?? 'error'}). Nothing is drawn rather than a made-up zero.</Note>}
      {noData && <Note>{isToday ? 'No readings yet today, so nothing is drawn (not a zero).' : 'No readings were recorded for this day, so nothing is drawn (not a zero).'}</Note>}
      {enabled && res.loading && !hasData && <div className="v3-skeleton" style={{ height: 200 }} aria-busy="true" aria-label="Loading" />}

      {view === 'power' && curve && <PowerChart curve={curve} isToday={isToday} />}
      {view === 'hourly' && day && <HourlyChart day={day} />}
    </>
  );
}

