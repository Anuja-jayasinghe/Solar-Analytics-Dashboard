import { Tip } from '../ui/Tip.jsx';
import { useDrawRef } from '../ui/useMotion.js';
import { Info } from '../ui/Info.jsx';
import { Note } from '../ui/Note.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { areaPath, linePath } from '../charts/scale.js';
import { DASH, fmtNum } from '../overview/format.js';
import { FULL_DAY_MAX_DOWN_MIN } from '../../../shared/domain/uptime.js';
import { dayLabelYear, spreadGeometry } from './series.js';

/**
 * Statistics for a chosen period (last 30 days, last 365 days, lifetime): average per day, best day, lowest full day
 * (outages and days without an uptime record left out, so the lowest is the weather, not a power cut), drawn
 * on one chart (dashed line = average). Nothing else: total, yield, capacity factor, earnings and
 * days-above were removed on purpose (docs/design/v3/README.md).
 */
export function StatsBody({ showHead, stats, loading, error, rangeText, period, onPeriod, periods = [] }) {
  const drawRef = useDrawRef(); // draws when scrolled into view (useMotion.js)
  const avg = stats?.avgPerDayKwh ?? null;
  const best = stats?.best ?? null;
  const worst = stats?.worst ?? null; // the lowest recorded day: only sets the chart's scale
  const full = stats?.lowestFull ?? null;
  const low = full?.day ?? null;
  const geo = stats ? spreadGeometry(stats.series ?? [], best, worst, avg, low) : null;
  const leftOut = full ? full.stoppedDays + full.unknownDays : 0;
  const leftText = full
    ? [full.stoppedDays ? `${full.stoppedDays} stopped for over ${FULL_DAY_MAX_DOWN_MIN} min` : null, full.unknownDays ? `${full.unknownDays} without an uptime record` : null].filter(Boolean).join(' and ')
    : '';
  const lowInfo = {
    title: 'Days the inverter ran all day',
    text: `The lowest day with at most ${FULL_DAY_MAX_DOWN_MIN} min stopped, so a power cut or a missing reading never counts as the lowest.${leftOut ? ` Left out: ${leftText}.` : ' No day was left out.'}${worst && low && worst.date !== low.date ? ` Lowest of all recorded days: ${fmtNum(worst.kwh, 1)} kWh on ${dayLabelYear(worst.date)}.` : ''}`
  };
  const items = [
    { label: 'Average per day', short: 'Avg / day', color: 'var(--ceb)', value: avg, sub: stats ? `over ${stats.presentDays} recorded days` : '', info: { title: 'Recorded days only', text: 'The total divided by the days that have data. Days with no reading are left out, never counted as zero.' } },
    { label: 'Best day', short: 'Best day', color: 'var(--good)', value: best?.kwh ?? null, sub: best ? dayLabelYear(best.date) : '' },
    { label: 'Lowest full day', short: 'Lowest full', color: 'var(--warn)', value: low?.kwh ?? null, sub: low ? `${dayLabelYear(low.date)}${leftOut ? ` · ${leftOut} day${leftOut === 1 ? '' : 's'} left out` : ''}` : full ? 'no full day in this range' : '', info: full ? lowInfo : null }
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
          <div key={s.label} className="v3-chip v3-stat" style={{ borderLeft: `3px solid ${s.color}` }}>
            <div className="v3-stat-label"><i style={{ background: s.color }} /><span className="v3-long">{s.label}</span><span className="v3-short">{s.short}</span>{s.info && <Info label={`About ${s.label.toLowerCase()}`} {...s.info} />}</div>
            {loading && !stats ? <div className="v3-skeleton" style={{ height: 24, width: 90 }} aria-busy="true" aria-label="Loading" /> : <div className="v3-num v3-stat-value">{fmtNum(s.value, 1)}<span>kWh</span></div>}
            <div className="v3-stat-sub">{s.sub || ' '}</div>
          </div>
        ))}
      </div>

      {geo ? (
        <div className="v3-spread" ref={drawRef} role="img" aria-label={`Daily generation over the range. Best day ${best ? fmtNum(best.kwh, 1) : DASH} kWh, lowest full day ${low ? fmtNum(low.kwh, 1) : DASH} kWh, average ${fmtNum(avg, 1)} kWh.`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={areaPath(geo.points)} fill="url(#areaFillCeb)" />
            <path d={linePath(geo.points)} fill="none" style={{ stroke: 'var(--ceb)' }} strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {geo.avgY !== null && <line x1="0" x2="100" y1={geo.avgY} y2={geo.avgY} style={{ stroke: 'var(--ink2)' }} strokeWidth="1.4" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="v3-spread-dots">
            <Tip className="v3-sdot-wrap" style={{ '--at': geo.best.x / 100, left: `${geo.best.x}%`, top: `${geo.best.y}%` }} text={best ? `Best day · ${dayLabelYear(best.date)}` : ''}><span className="v3-sdot" style={{ background: 'var(--good)', boxShadow: '0 0 0 4px var(--good-a20)' }} /><span className="v3-sval" style={{ color: 'var(--good)' }}>{best ? fmtNum(best.kwh, 1) : ''}</span></Tip>
            {geo.low && <Tip className="v3-sdot-wrap" style={{ '--at': geo.low.x / 100, left: `${geo.low.x}%`, top: `${geo.low.y}%` }} text={`Lowest full day · ${dayLabelYear(low.date)}`}><span className="v3-sdot" style={{ background: 'var(--warn)', boxShadow: '0 0 0 4px var(--warn-a20)' }} /><span className="v3-sval below" style={{ color: 'var(--warn)' }}>{fmtNum(low.kwh, 1)}</span></Tip>}
          </div>
        </div>
      ) : !loading && !error ? <Note>No generation was recorded in this range.</Note> : null}
    </>
  );
}
