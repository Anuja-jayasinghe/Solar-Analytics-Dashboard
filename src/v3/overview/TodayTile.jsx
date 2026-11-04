import { Glass } from '../ui/Glass.jsx';
import { CountUp } from '../ui/Motion.jsx';
import { STAGE_MS, useCount } from '../ui/useMotion.js';
import { useMotionMode } from '../ui/motionMode.js';
import { DASH, clockAt, fmtNum, freshness, targetProgress } from './format.js';
import { GridTown } from './GridTown.jsx';
import { townState } from './gridTown.js';

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
 * Today: the daily goal as a little power grid (GridTown): your home's rooftop panels feeding a street of ten buildings,
 * each worth 10% of the target, lit as today's energy comes in. The percentage leads the text, then the kWh and what is
 * left to go. Without a target there is no percentage, only the kWh (and the town stays unlit).
 * `peak` is the day chart's peak ({ kw, at }) from today's readings; it is preferred so the tile and the chart always
 * agree, and the live reading's own peak is the fallback.
 */
export function TodayTile({ live, peak = null, targetKwh, now, loading }) {
  const today = live?.todayKwh ?? null;
  const turn = useMotionMode() === 'full' ? STAGE_MS : 0; // live: animates on every visit, waits its turn only in the full sequence
  const prog = targetProgress(today, targetKwh ?? null);
  const share = prog ? today / targetKwh : null;
  // The town lights up as the percentage counts up, and glides with each refresh.
  const { shown, waiting } = useCount(prog ? share * 100 : null, { duration: 1300, delay: turn });
  const shownShare = typeof shown === 'number' ? shown / 100 : 0;
  const powered = prog ? townState(share).powered : 0;
  const peakKw = peak?.kw ?? live?.peakTodayKw ?? null;
  const peakAt = peak ? peak.at : live?.peakTodayAt ?? null;
  const hasPeak = peakKw != null;
  // Not current (SolisCloud down): the tile greys out and says so, so an old figure is never read as live.
  const stale = !!live?.stale;
  const asOf = stale ? clockAt(live.dataTimestamp) : null;
  const flowing = !stale && today > 0 && live?.status !== 'offline';
  const label = prog
    ? `${prog.pct}% of today's target: ${prog.reached ? 'the whole town is powered' : `${powered} of 10 buildings powered`}`
    : "Today's generation";

  return (
    <Glass className="v3-live-tile v3-today" aria-label="Today" data-stale={stale || undefined}>
      {stale
        ? <span className="v3-stalechip">{asOf ? `Not live · as of ${asOf}` : 'Not live'}</span>
        : <div className="v3-fresh-wrap"><FreshnessRing live={live} now={now} /></div>}
      <div className="v3-town-wrap">
        <GridTown share={prog ? shownShare : 0} flowing={flowing} label={label} />
      </div>
      <div className="v3-today-text">
        <div className="v3-kpi-label">Today</div>
        {loading && !live ? (
          <div className="v3-skeleton" style={{ height: 30, width: 120 }} aria-busy="true" aria-label="Loading" />
        ) : prog ? (
          <div className="v3-num v3-kpi-value"><span className={waiting ? 'v3-countwait' : undefined}>{fmtNum(shown, 0)}%</span><span className="v3-kpi-unit">{`of ${fmtNum(targetKwh)} kWh`}</span></div>
        ) : (
          <div className="v3-num v3-kpi-value"><CountUp value={today} dp={1} duration={750} delay={turn} /><span className="v3-kpi-unit">kWh</span></div>
        )}
        <div className="v3-kpi-sub">
          {prog
            ? `${fmtNum(today, 1)} kWh · ${prog.reached ? `${fmtNum(today - targetKwh, 1)} over target` : `${fmtNum(prog.toGoKwh, 1)} to go`}`
            : (targetKwh == null ? 'Set a daily target in Settings' : ' ')}
        </div>
        <div className="v3-kpi-sub" style={{ marginTop: 4 }}>
          Peak <b style={{ color: 'var(--ink)' }}>{hasPeak ? `${fmtNum(peakKw, 1)} kW` : DASH}</b>{hasPeak && peakAt ? ` at ${peakAt}` : ''}
        </div>
      </div>
    </Glass>
  );
}
