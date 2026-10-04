import { Tip } from '../ui/Tip.jsx';
import { Note } from '../ui/Note.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { areaPath, linePath } from '../charts/scale.js';
import { DASH, fmtNum } from '../overview/format.js';
import { dayLabelYear, spreadGeometry } from './series.js';

/**
 * Statistics for a chosen period (last 30 days, last 365 days, lifetime): average per day, best day, lowest day, drawn
 * on one chart (dashed line = average). Nothing else: total, yield, capacity factor, earnings and
 * days-above were removed on purpose (docs/design/v3/README.md).
 */
export function StatsBody({ showHead, stats, loading, error, rangeText, period, onPeriod, periods = [] }) {
  const avg = stats?.avgPerDayKwh ?? null;
  const best = stats?.best ?? null;
  const worst = stats?.worst ?? null;
  const geo = stats ? spreadGeometry(stats.series ?? [], best, worst, avg) : null;
  const items = [
    { label: 'Average per day', short: 'Avg / day', color: 'var(--ceb)', value: avg, sub: stats ? `over ${stats.presentDays} recorded days` : '', tip: 'Total for the range divided by the days that have data. Days with no reading are left out, never counted as zero.' },
    { label: 'Best day', short: 'Best day', color: 'var(--good)', value: best?.kwh ?? null, sub: best ? dayLabelYear(best.date) : '', tip: 'Highest single-day generation in the range.' },
    { label: 'Lowest day', short: 'Lowest day', color: 'var(--warn)', value: worst?.kwh ?? null, sub: worst ? dayLabelYear(worst.date) : '', tip: 'Lowest single-day generation in the range. A measured zero would show as 0.' }
  ];

  return (
    <>
      <div className="v3-tilehead">
        <div>
          {showHead && <h2 className="v3-h2">Statistics</h2>}
          <div className="v3-sub" style={showHead ? undefined : { marginTop: 0 }}>{rangeText}</div>
        </div>
        {onPeriod && <Segmented small options={periods} value={period} onChange={onPeriod} label="Statistics period" />}
      </div>

      {error && <Note tone="bad">Could not load the statistics ({error.code ?? 'error'}).</Note>}
      <div className="v3-statgrid">
        {items.map((s) => (
          <Tip key={s.label} text={s.tip}>
            <div className="v3-chip v3-stat" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="v3-stat-label"><i style={{ background: s.color }} /><span className="v3-long">{s.label}</span><span className="v3-short">{s.short}</span></div>
              {loading && !stats ? <div className="v3-skeleton" style={{ height: 24, width: 90 }} aria-busy="true" aria-label="Loading" /> : <div className="v3-num v3-stat-value">{fmtNum(s.value, 1)}<span>kWh</span></div>}
              <div className="v3-stat-sub">{s.sub || ' '}</div>
            </div>
          </Tip>
        ))}
      </div>

      {geo ? (
        <div className="v3-spread" role="img" aria-label={`Daily generation over the range. Best day ${best ? fmtNum(best.kwh, 1) : DASH} kWh, lowest day ${worst ? fmtNum(worst.kwh, 1) : DASH} kWh, average ${fmtNum(avg, 1)} kWh.`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={areaPath(geo.points)} fill="url(#areaFillCeb)" />
            <path d={linePath(geo.points)} fill="none" style={{ stroke: 'var(--ceb)' }} strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {geo.avgY !== null && <line x1="0" x2="100" y1={geo.avgY} y2={geo.avgY} style={{ stroke: 'var(--ink2)' }} strokeWidth="1.4" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="v3-spread-dots">
            <Tip className="v3-sdot-wrap" style={{ left: `${geo.best.x}%`, top: `${geo.best.y}%` }} text={best ? `Best day · ${dayLabelYear(best.date)}` : ''}><span className="v3-sdot" style={{ background: 'var(--good)', boxShadow: '0 0 0 4px var(--good-a20)' }} /><span className="v3-sval" style={{ color: 'var(--good)' }}>{best ? fmtNum(best.kwh, 1) : ''}</span></Tip>
            <Tip className="v3-sdot-wrap" style={{ left: `${geo.worst.x}%`, top: `${geo.worst.y}%` }} text={worst ? `Lowest day · ${dayLabelYear(worst.date)}` : ''}><span className="v3-sdot" style={{ background: 'var(--warn)', boxShadow: '0 0 0 4px var(--warn-a20)' }} /><span className="v3-sval below" style={{ color: 'var(--warn)' }}>{worst ? fmtNum(worst.kwh, 1) : ''}</span></Tip>
          </div>
        </div>
      ) : !loading && !error ? <Note>No generation was recorded in this range.</Note> : null}
    </>
  );
}
