import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { DASH, fmtNum, freshness, targetProgress } from './format.js';

/** The data-freshness ring: full when fresh, draining as the reading ages. Deliberately faint. */
function FreshnessRing({ live, now }) {
  const f = live ? freshness(live, now) : null;
  const known = f !== null;
  const dash = known ? `${(f.fraction * 50.3).toFixed(1)} 50.3` : '0 50.3';
  return (
    <Tip text={known ? `Data refreshed ${f.label}. The ring drains as the reading ages and refreshes every minute.` : live?.demo ? 'Demo data: nothing is being refreshed.' : 'The age of this reading is not known.'}>
      <span className="v3-fresh" aria-label={known ? `Data refreshed ${f.label}` : 'Data age unknown'}>
        <span>{known ? f.label : live?.demo ? 'demo' : DASH}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="2" />
          <circle cx="10" cy="10" r="8" fill="none" style={{ stroke: 'var(--ink)' }} strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} transform="rotate(-90 10 10)" />
        </svg>
      </span>
    </Tip>
  );
}

/**
 * Today: a circle that fills toward the daily target (the "game"), today's kWh, the peak so far, and the
 * freshness ring. Without a target there is no percentage to show, only the kWh.
 */
export function TodayTile({ live, targetKwh, now, loading }) {
  const today = live?.todayKwh ?? null;
  const prog = targetProgress(today, targetKwh ?? null);
  const hasPeak = live?.peakTodayKw != null;
  const label = prog ? `${prog.pct}% of today's target` : "Today's generation";

  return (
    <Glass className="v3-live-tile v3-today" aria-label="Today">
      <div className="v3-fresh-wrap"><FreshnessRing live={live} now={now} /></div>
      <Tip text={prog ? "Filling toward today's target: today's generation divided by the daily target set in Settings." : 'Set a daily target in Settings to see how far today has got.'}>
        <div className="v3-filler" role="img" aria-label={label}>
          {prog ? (
            <>
              <div className="v3-liquid" style={{ top: `${100 - prog.level}%` }}>
                <svg className="v3-wave" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 12.5 0 25 7 T 50 7 T 75 7 T 100 7 T 125 7 T 150 7 T 175 7 T 200 7 V 14 H 0 Z" style={{ fill: 'var(--gen-hi)' }} /></svg>
                <svg className="v3-wave two" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q 12.5 14 25 7 T 50 7 T 75 7 T 100 7 T 125 7 T 150 7 T 175 7 T 200 7 V 14 H 0 Z" style={{ fill: 'var(--gen)' }} /></svg>
              </div>
              <span className="v3-num v3-filler-pct">{prog.pct}%</span>
            </>
          ) : (
            <span className="v3-filler-none">{loading ? '' : 'No target'}</span>
          )}
        </div>
      </Tip>
      <div className="v3-today-text">
        <div className="v3-kpi-label">Today</div>
        {loading && !live ? (
          <div className="v3-skeleton" style={{ height: 30, width: 120 }} aria-busy="true" aria-label="Loading" />
        ) : (
          <div className="v3-num v3-kpi-value">{fmtNum(today, 1)}<span className="v3-kpi-unit">kWh</span></div>
        )}
        <div className="v3-kpi-sub">
          {prog ? (prog.reached ? `target of ${fmtNum(targetKwh)} kWh reached` : `of ${fmtNum(targetKwh)} kWh target · ${fmtNum(prog.toGoKwh, 1)} to go`) : (targetKwh == null ? 'Set a daily target in Settings' : ' ')}
        </div>
        <Tip text="Highest power so far today, and when it happened.">
          <div className="v3-kpi-sub" style={{ marginTop: 4 }}>
            Peak <b style={{ color: 'var(--ink)' }}>{hasPeak ? `${fmtNum(live.peakTodayKw, 1)} kW` : DASH}</b>{hasPeak && live.peakTodayAt ? ` at ${live.peakTodayAt}` : ''}
          </div>
        </Tip>
      </div>
    </Glass>
  );
}
