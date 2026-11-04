import { Glass } from '../ui/Glass.jsx';
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
 * Today's peak is not repeated here: it is marked on the live power gauge beside this tile.
 */
export function TodayTile({ live, targetKwh, now, loading }) {
  const today = live?.todayKwh ?? null;
  const turn = useMotionMode() === 'full' ? STAGE_MS : 0; // live: animates on every visit, waits its turn only in the full sequence
  const prog = targetProgress(today, targetKwh ?? null);
  const share = prog ? today / targetKwh : null;
  // The town lights up as the percentage counts up, and glides with each refresh.
  const { shown, waiting } = useCount(prog ? share * 100 : null, { duration: 1300, delay: turn });
  // today's kWh, counting up on the billboard over the town
  const kwhShown = useCount(today, { duration: 1100, delay: turn }).shown;
  const shownShare = typeof shown === 'number' ? shown / 100 : 0;
  const powered = prog ? townState(share).powered : 0;
  // Not current (SolisCloud down): the tile greys out and says so, so an old figure is never read as live.
  const stale = !!live?.stale;
  const asOf = stale ? clockAt(live.dataTimestamp) : null;
  const flowing = !stale && today > 0 && live?.status !== 'offline';
  const kwhText = today === null ? null : `${fmtNum(today, 1)} kWh today`;
  const label = prog
    ? `${kwhText}, ${prog.pct}% of today's target: ${prog.reached ? 'the whole town is powered' : `${powered} of 10 buildings powered`}`
    : kwhText ?? "Today's generation";

  return (
    <Glass className="v3-live-tile v3-today" aria-label="Today" data-stale={stale || undefined}>
      {stale
        ? <span className="v3-stalechip">{asOf ? `Not live · as of ${asOf}` : 'Not live'}</span>
        : <div className="v3-fresh-wrap"><FreshnessRing live={live} now={now} /></div>}
      <div className="v3-town-wrap">
        <GridTown share={prog ? shownShare : 0} flowing={flowing} label={label}
          reading={typeof kwhShown === 'number' ? kwhShown.toFixed(1) : null} />
      </div>
      <div className="v3-today-text">
        <div className="v3-kpi-label">Today</div>
        {/* today's kWh is on the billboard over the town; here: how far that is toward the target, then the target */}
        <span className="v3-sr">{kwhText ?? "Today's generation unknown"}</span>
        {loading && !live ? (
          <div className="v3-skeleton" style={{ height: 30, width: 120 }} aria-busy="true" aria-label="Loading" />
        ) : prog ? (
          <>
            <div className="v3-num v3-kpi-value v3-today-pct"><span className={waiting ? 'v3-countwait' : undefined}>{`${fmtNum(shown, 0)}%`}</span><span className="v3-kpi-unit">of today&apos;s target</span></div>
            <div className="v3-kpi-sub">
              {`${fmtNum(targetKwh)} kWh target · ${prog.reached ? `${fmtNum(today - targetKwh, 1)} over` : `${fmtNum(prog.toGoKwh, 1)} to go`}`}
            </div>
          </>
        ) : (
          <div className="v3-kpi-sub">{targetKwh == null ? 'Set a daily target in Settings' : ' '}</div>
        )}
      </div>
    </Glass>
  );
}
