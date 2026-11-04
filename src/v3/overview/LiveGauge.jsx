import { Glass } from '../ui/Glass.jsx';
import { Info } from '../ui/Info.jsx';
import { CountUp } from '../ui/Motion.jsx';
import { STAGE_MS, useCountUp } from '../ui/useMotion.js';
import { DASH, fmtNum, gaugeFraction, liveState, liveStatusInfo, readingNote } from './format.js';

// A 240 degree arc, drawn with pathLength=100 so the dash is simply the percentage.
const ARC = 'M 30.72 140 A 80 80 0 1 1 169.28 140';

/**
 * Live output as a share of the inverter's AC rating, with a status bulb. Unknown power draws an empty
 * arc and a dash, never a 0 kW reading. A real measured 0 draws as 0.
 */
export function LiveGauge({ live, error = null, maxKw, loading }) {
  const kw = live?.currentPowerKw ?? null;
  const frac = gaugeFraction(kw, maxKw ?? null);
  // The arc sweeps up from 0 when the first reading lands, then glides to each new one.
  const arc = useCountUp(frac === null ? null : frac * 100, { duration: 750, delay: STAGE_MS }); // second, after the headline figures
  // Before the first reading arrives the bulb says so, instead of claiming the status is unknown.
  const state = loading && !live ? { key: 'loading', label: 'Checking…', tone: 'neutral' } : liveState(live, error);
  const note = readingNote(live);
  const info = state.key === 'loading' ? null : liveStatusInfo(live, error, state);
  const pill = (
    <>
      <span className="v3-bulb" aria-hidden="true" />
      <span>{state.label}</span>
    </>
  );
  const pct = frac === null ? null : Math.round(frac * 100);
  const meter = frac === null ? {} : { 'aria-valuemin': 0, 'aria-valuemax': maxKw, 'aria-valuenow': kw, 'aria-valuetext': `${fmtNum(kw, 1)} kilowatts` };

  return (
    <Glass className="v3-live-tile v3-gauge-tile" aria-label="Live power" data-stale={live?.stale || undefined}>
      <span className="v3-status" data-tone={state.tone}>
        {info ? <Info {...info}>{pill}</Info> : pill}
      </span>
      <div className="v3-gauge" role="meter" aria-label="Live power" {...meter}>
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path d={ARC} pathLength="100" fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="13" strokeLinecap="round" />
          {frac !== null && frac > 0 && arc > 0 && (
            <path d={ARC} pathLength="100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${Math.max(0.5, arc).toFixed(1)} 100`} />
          )}
        </svg>
        <div className="v3-gauge-read">
          {loading && !live ? <div className="v3-skeleton" style={{ height: 34, width: 70, margin: '0 auto' }} aria-busy="true" aria-label="Loading" /> : <div className="v3-num v3-gauge-kw"><CountUp value={kw} dp={1} duration={750} delay={STAGE_MS} /></div>}
          <div className="v3-kpi-sub">{note ? 'kW then' : 'kW now'}</div>
        </div>
        <span className="v3-gauge-min" aria-hidden="true">0</span>
        <span className="v3-gauge-max" aria-hidden="true">{maxKw ? `${fmtNum(maxKw)} kW` : DASH}</span>
      </div>
      <div className="v3-kpi-sub v3-gauge-share">
        {note
          ? `${note[0].toUpperCase()}${note.slice(1)}${pct === null ? '' : ` · ${pct}% of capacity`}`
          : state.key === 'upstream' ? 'No reading saved today yet' : pct === null ? 'share of capacity unknown' : `${pct}% of array capacity`}
      </div>
    </Glass>
  );
}
