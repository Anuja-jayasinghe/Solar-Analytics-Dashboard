import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays } from '../../../shared/domain/time.js';
import { usePrefetch, useResource } from '../data/context.js';
import { Tip } from '../ui/Tip.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { Note } from '../ui/Note.jsx';
import { DatePicker } from '../ui/Calendar.jsx';
import { axisTicks, chartNum, maxOf, niceMax, smoothPath, xPct, yPct } from '../charts/scale.js';
import { DASH, fmtNum } from '../overview/format.js';
import { dayLabelYear } from './series.js';
import { hourlyFromTelemetry } from './hourly.js';

const STYLES = [{ value: 'area', label: 'Area' }, { value: 'bars', label: 'Bars' }];

/** "Generation through the day": pick a day, see kWh per hour (Colombo time). */
export function DayBody({ showHead, bounds }) {
  const [picked, setPicked] = useState(null); // null = follow the newest day with data
  const [style, setStyle] = useState('area');
  const date = picked ?? bounds.max;
  const enabled = !!date;
  const res = useResource('telemetry', { date }, { enabled });
  const day = useMemo(() => hourlyFromTelemetry(res.data?.points), [res.data]);
  // the neighbouring days, so stepping with the arrows is instant
  usePrefetch(date ? [['telemetry', { date: addDays(date, -1) }], ...(bounds.max && date < bounds.max ? [['telemetry', { date: addDays(date, 1) }]] : [])] : [], !!res.data);

  const hours = day?.hours ?? [];
  const yMax = niceMax(Math.max(maxOf(hours.map((h) => h.kwh), 1) * 1.12, 1));
  const pts = hours.map((h, i) => [xPct(i, hours.length), yPct(h.kwh, yMax)]);
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L ${pts[pts.length - 1][0].toFixed(2)} 100 L ${pts[0][0].toFixed(2)} 100 Z` : '';
  const move = (n) => { if (date) setPicked(addDays(date, n)); };
  const noData = enabled && !res.loading && !res.error && !day;

  return (
    <>
      <div className="v3-tilehead">
        {showHead ? (
          <div>
            <h2 className="v3-h2">Generation through the day</h2>
            <div className="v3-sub">Pick a day · kWh per hour · Colombo time</div>
          </div>
        ) : null}
        <div className="v3-controls">
          <Segmented small options={STYLES} value={style} onChange={setStyle} label="Chart style" />
          <div className="v3-stepper">
            <button type="button" className="v3-iconbtn sm" onClick={() => move(-1)} disabled={!date || (bounds.min && date <= bounds.min)} aria-label="Previous day"><ChevronLeft size={15} /></button>
            <DatePicker value={date} min={bounds.min} max={bounds.max} onChange={setPicked} />
            <button type="button" className="v3-iconbtn sm" onClick={() => move(1)} disabled={!date || (bounds.max && date >= bounds.max)} aria-label="Next day"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      <div className="v3-markrow">
        <span className="v3-pill" data-tone="gen">{day ? `${fmtNum(day.totalKwh, 1)} kWh that day` : DASH}</span>
        <span className="v3-pill">{day?.peak ? `Peak ${fmtNum(day.peak.kw, 1)} kW at ${day.peak.at}` : 'Peak —'}</span>
        <span className="v3-sub" style={{ margin: 0 }}>{date ? dayLabelYear(date) : ''}</span>
      </div>

      {res.error && <Note tone="bad">Could not load this day ({res.error.code ?? 'error'}). Nothing is drawn rather than a made-up zero.</Note>}
      {noData && <Note>No readings were recorded for this day, so nothing is drawn (not a zero).</Note>}
      {enabled && res.loading && !day && <div className="v3-skeleton" style={{ height: 200 }} aria-busy="true" aria-label="Loading" />}

      {day && (
        <div className="v3-chartgrid" data-busy={res.refreshing ? 'true' : undefined}>
          <div className="v3-yaxis" aria-hidden="true">{axisTicks(yMax, (v) => fmtNum(v, v < 10 && v % 1 ? 1 : 0)).map((t) => <span key={t.pct}>{t.label}</span>)}</div>
          <div className="v3-plotwrap">
            <div className="v3-plot" style={{ height: 'var(--plot-h)' }}>
              {axisTicks(yMax).map((t) => <div key={t.pct} className="v3-gridline" style={{ bottom: `${t.pct}%` }} />)}
              {style === 'area' && (
                <svg className="v3-plot-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d={area} fill="url(#areaFill)" />
                  <path d={line} fill="none" style={{ stroke: 'var(--gen)' }} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              )}
              <div className="v3-cols" style={{ gap: 0 }}>
                {hours.map((h, i) => (
                  <Tip key={h.hour}>
                    <div className="v3-col" style={{ padding: 0 }}>
                      {style === 'bars'
                        ? <div className="v3-bar single" style={{ height: `${(h.kwh / yMax) * 100}%`, background: 'var(--gen)', maxWidth: 30, width: '60%', flex: '0 0 auto' }}><span className="v3-val">{h.kwh > 0 ? chartNum(h.kwh) : ''}</span></div>
                        : <><span className="v3-dot" style={{ bottom: `${100 - pts[i][1]}%`, background: 'var(--gen)', width: 8, height: 8 }} />{h.kwh > 0 && <span className="v3-val v3-val-pt" style={{ bottom: `calc(${100 - pts[i][1]}% + 8px)` }}>{chartNum(h.kwh)}</span>}</>}
                    </div>
                  </Tip>
                ))}
              </div>
            </div>
            <div className="v3-xlabels" style={{ gap: 0 }}>{hours.map((h) => <div key={h.hour} className="v3-xlabel v3-xplain">{h.hour}</div>)}</div>
            <div className="v3-sub" style={{ textAlign: 'center', margin: '4px 0 0' }}>hour of day (9 = 09:00 to 10:00)</div>
          </div>
        </div>
      )}
    </>
  );
}
