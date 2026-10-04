import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { DASH, fmtNum, gaugeFraction, liveState } from './format.js';

// A 240 degree arc, drawn with pathLength=100 so the dash is simply the percentage.
const ARC = 'M 30.72 140 A 80 80 0 1 1 169.28 140';

/**
 * Live output as a share of the inverter's AC rating, with a status bulb. Unknown power draws an empty
 * arc and a dash, never a 0 kW reading. A real measured 0 draws as 0.
 */
export function LiveGauge({ live, maxKw, loading }) {
  const kw = live?.currentPowerKw ?? null;
  const frac = gaugeFraction(kw, maxKw ?? null);
  const state = liveState(live);
  const pct = frac === null ? null : Math.round(frac * 100);
  const meter = frac === null ? {} : { 'aria-valuemin': 0, 'aria-valuemax': maxKw, 'aria-valuenow': kw, 'aria-valuetext': `${fmtNum(kw, 1)} kilowatts` };

  return (
    <Glass className="v3-live-tile v3-gauge-tile" aria-label="Live power">
      <Tip text={live?.abnormalOffline ? 'Offline during daylight: the inverter or its logger is not reporting.' : state.key === 'asleep' ? 'The inverter sleeps at night; this is normal.' : state.key === 'online' ? 'Online: the inverter is feeding the grid.' : state.label}>
        <span className="v3-status" data-tone={state.tone}>
          <span className="v3-bulb" aria-hidden="true" />
          <span>{state.label}</span>
        </span>
      </Tip>
      <Tip text={maxKw ? `Live output as a share of the ${fmtNum(maxKw)} kW inverter rating.` : 'Live output.'}>
        <div className="v3-gauge" role="meter" aria-label="Live power" {...meter}>
          <svg viewBox="0 0 200 160" aria-hidden="true">
            <path d={ARC} pathLength="100" fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="13" strokeLinecap="round" />
            {frac !== null && frac > 0 && (
              <path d={ARC} pathLength="100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${Math.max(0.5, frac * 100).toFixed(1)} 100`} />
            )}
          </svg>
          <div className="v3-gauge-read">
            {loading && !live ? <div className="v3-skeleton" style={{ height: 34, width: 70, margin: '0 auto' }} aria-busy="true" aria-label="Loading" /> : <div className="v3-num v3-gauge-kw">{fmtNum(kw, 1)}</div>}
            <div className="v3-kpi-sub">kW now</div>
          </div>
          <span className="v3-gauge-min" aria-hidden="true">0</span>
          <span className="v3-gauge-max" aria-hidden="true">{maxKw ? `${fmtNum(maxKw)} kW` : DASH}</span>
        </div>
      </Tip>
      <div className="v3-kpi-sub v3-gauge-share">{pct === null ? 'share of capacity unknown' : `${pct}% of array capacity`}</div>
    </Glass>
  );
}
