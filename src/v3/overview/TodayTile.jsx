import { Glass } from '../ui/Glass.jsx';
import { CountUp } from '../ui/Motion.jsx';
import { STAGE_MS } from '../ui/useMotion.js';
import { DASH, clockAt, fmtNum, freshness, targetProgress } from './format.js';

/** The data-freshness ring: full when fresh, draining as the reading ages. Deliberately faint. */
function FreshnessRing({ live, now }) {
  const f = live ? freshness(live, now) : null;
  const known = f !== null;
  const dash = known ? `${(f.fraction * 50.3).toFixed(1)} 50.3` : '0 50.3';
  return (
    <span className="v3-fresh" role="img" aria-label={known ? `Data refreshed ${f.label}` : 'Data age unknown'}>
      <span>{known ? f.label : live?.demo ? 'demo' : DASH}</span>
      <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="2" />
        <circle cx="10" cy="10" r="8" fill="none" style={{ stroke: 'var(--ink)' }} strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} transform="rotate(-90 10 10)" />
      </svg>
    </span>
  );
}

/**
 * Today: a circle that fills toward the daily target (the "game"), today's kWh, the peak so far, and the
 * freshness ring. Without a target there is no percentage to show, only the kWh.
 */
/**
 * `peak` is the day chart's peak ({ kw, at }) from today's readings; it is preferred so the tile and the chart always
 * agree, and the live reading's own peak is the fallback.
 */
export function TodayTile({ live, peak = null, targetKwh, now, loading }) {
  const today = live?.todayKwh ?? null;
  const prog = targetProgress(today, targetKwh ?? null);
  const peakKw = peak?.kw ?? live?.peakTodayKw ?? null;
  const peakAt = peak ? peak.at : live?.peakTodayAt ?? null;
  const hasPeak = peakKw != null;
  const label = prog ? `${prog.pct}% of today's target` : "Today's generation";
  // Not current (SolisCloud down): the tile greys out and says so, so an old figure is never read as live.
  const stale = !!live?.stale;
  const asOf = stale ? clockAt(live.dataTimestamp) : null;

  return (
    <Glass className="v3-live-tile v3-today" aria-label="Today" data-stale={stale || undefined}>
      {stale
        ? <span className="v3-stalechip">{asOf ? `Not live · as of ${asOf}` : 'Not live'}</span>
        : <div className="v3-fresh-wrap"><FreshnessRing live={live} now={now} /></div>}
      <div className="v3-filler" role="img" aria-label={label}>
        {prog ? (
          <>
            <div className="v3-liquid" style={{ top: `${100 - prog.level}%` }}>
              <svg className="v3-wave" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 12.5 0 25 7 T 50 7 T 75 7 T 100 7 T 125 7 T 150 7 T 175 7 T 200 7 V 14 H 0 Z" style={{ fill: 'var(--gen-hi)' }} /></svg>
              <svg className="v3-wave two" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 12.5 14 25 7 T 50 7 T 75 7 T 100 7 T 125 7 T 150 7 T 175 7 T 200 7 V 14 H 0 Z" style={{ fill: 'var(--gen)' }} /></svg>
            </div>
            <span className="v3-num v3-filler-pct"><CountUp value={prog.pct} duration={1000} delay={STAGE_MS} suffix="%" /></span>
          </>
        ) : (
          <span className="v3-filler-none">{loading ? '' : targetKwh == null ? 'No target' : DASH}</span>
        )}
      </div>
      <div className="v3-today-text">
        <div className="v3-kpi-label">Today</div>
        {loading && !live ? (
          <div className="v3-skeleton" style={{ height: 30, width: 120 }} aria-busy="true" aria-label="Loading" />
        ) : (
          <div className="v3-num v3-kpi-value"><CountUp value={today} dp={1} duration={750} delay={STAGE_MS} /><span className="v3-kpi-unit">kWh</span></div>
        )}
        <div className="v3-kpi-sub">
          {prog ? (prog.reached ? `target of ${fmtNum(targetKwh)} kWh reached` : `of ${fmtNum(targetKwh)} kWh target · ${fmtNum(prog.toGoKwh, 1)} to go`) : (targetKwh == null ? 'Set a daily target in Settings' : ' ')}
        </div>
        <div className="v3-kpi-sub" style={{ marginTop: 4 }}>
          Peak <b style={{ color: 'var(--ink)' }}>{hasPeak ? `${fmtNum(peakKw, 1)} kW` : DASH}</b>{hasPeak && peakAt ? ` at ${peakAt}` : ''}
        </div>
      </div>
    </Glass>
  );
}
