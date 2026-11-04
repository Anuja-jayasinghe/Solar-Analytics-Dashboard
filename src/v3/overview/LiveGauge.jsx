import { Glass } from '../ui/Glass.jsx';
import { Info } from '../ui/Info.jsx';
import { CountUp } from '../ui/Motion.jsx';
import { STAGE_MS, useCountUp } from '../ui/useMotion.js';
import { useMotionMode } from '../ui/motionMode.js';
import { fmtNum, gaugeFraction, liveState, liveStatusInfo, readingNote } from './format.js';
import { SCALE_PATH, SCALE_R, SUN_PATH, VIEWBOX, rayLevels, rays, scaleLabels } from './sunMeter.js';

const RAYS = rays();

/**
 * Live output as a rising sun (sunMeter.js): 40 rays over the horizon from 0 kW to the inverter's maximum, lit up to
 * the live reading, with today's peak marked on the scale like a cruise-control set point (a red line and a small
 * arrow pointing at it). The kW reading sits in the sun. Unknown power lights nothing and shows a dash, never 0 kW;
 * a real measured 0 is a 0. At night (asleep) the sun is grey and every ray dark.
 * `peak` is the day chart's peak ({ kw, at }); the live reading's own peak is the fallback.
 */
export function LiveGauge({ live, error = null, maxKw, peak = null, loading }) {
  const kw = live?.currentPowerKw ?? null;
  const frac = gaugeFraction(kw, maxKw ?? null);
  // Animates on every visit (it is live); waits for the headline figures only in the full sequence.
  const turn = useMotionMode() === 'full' ? STAGE_MS : 0;
  // The rays light up from the left when the first reading lands, then glide to each new one.
  const arc = useCountUp(frac === null ? null : frac * 100, { duration: 750, delay: turn });
  const peakKw = peak?.kw ?? live?.peakTodayKw ?? null;
  const peakAt = peak ? peak.at : live?.peakTodayAt ?? null;
  const peakShare = peakKw > 0 ? gaugeFraction(peakKw, maxKw ?? null) : null;
  // The peak marker sweeps out to its place after the rays, like a cruise-control mark being set.
  const pk = useCountUp(peakShare === null ? null : peakShare * 180, { duration: 900, delay: turn + 350 });
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
  const levels = rayLevels(typeof arc === 'number' ? arc / 100 : null);
  const resting = kw === null || state.key === 'asleep' || state.key === 'offline' || state.key === 'loading';
  const labels = scaleLabels(maxKw ?? null).filter((l) => peakShare === null || Math.abs(l.share - peakShare) > 0.06 || l.share === 0 || l.share === 1);
  const peakText = peakKw > 0 ? `Peak ${fmtNum(peakKw, 1)} kW${peakAt ? ` at ${peakAt}` : ''}` : null;
  const meter = frac === null ? {} : {
    'aria-valuemin': 0, 'aria-valuemax': maxKw, 'aria-valuenow': kw,
    'aria-valuetext': `${fmtNum(kw, 1)} kilowatts${peakText ? `; today's ${peakText.toLowerCase()}` : ''}`
  };

  return (
    <Glass className="v3-live-tile v3-gauge-tile" aria-label="Live power" data-stale={live?.stale || undefined}>
      <span className="v3-status" data-tone={state.tone}>
        {info ? <Info {...info}>{pill}</Info> : pill}
      </span>
      <div className="v3-gauge" role="meter" aria-label="Live power" data-resting={resting || undefined} {...meter}>
        <svg viewBox={VIEWBOX} aria-hidden="true">
          <path d={SCALE_PATH} className="v3-sun-scale" />
          {RAYS.map((r) => {
            const lv = levels[r.i];
            const end = lv > 0 ? r.outer : r.outerDim;
            return (
              <line key={r.i} className="v3-sun-ray" data-lit={lv > 0 || undefined} data-red={r.red || undefined}
                style={{ '--i': r.i, ...(lv > 0 && lv < 1 ? { opacity: 0.35 + 0.65 * lv } : null) }}
                x1={r.inner.x} y1={r.inner.y} x2={end.x} y2={end.y} />
            );
          })}
          <line className="v3-sun-horizon" x1={-(SCALE_R + 14)} x2={SCALE_R + 14} y1="0" y2="0" />
          <path d={SUN_PATH} className="v3-sun-disc" />
          {labels.map((l) => (
            <text key={l.share} className="v3-sun-label" x={l.x} y={l.share === 0 || l.share === 1 ? 17 : l.y + 4}
              textAnchor={l.share === 0 ? 'start' : l.share === 1 ? 'end' : 'middle'}>{l.text}</text>
          ))}
          {typeof pk === 'number' && (
            <g className="v3-sun-peak" transform={`rotate(${(pk - 90).toFixed(2)})`}>
              <line x1="0" y1={-(SCALE_R - 10)} x2="0" y2={-(SCALE_R + 8)} />
              <path d={`M 0 ${-(SCALE_R + 11)} L -7 ${-(SCALE_R + 24)} L 7 ${-(SCALE_R + 24)} Z`} />
            </g>
          )}
        </svg>
        <div className="v3-sun-read">
          {loading && !live ? <div className="v3-skeleton" style={{ height: 28, width: 64 }} aria-busy="true" aria-label="Loading" /> : <div className="v3-num v3-gauge-kw"><CountUp value={kw} dp={1} duration={750} delay={turn} /></div>}
          <div className="v3-sun-unit">{note ? 'kW then' : 'kW now'}</div>
        </div>
      </div>
      <div className="v3-kpi-sub v3-gauge-share">
        <div>
          {note
            ? `${note[0].toUpperCase()}${note.slice(1)}${pct === null ? '' : ` · ${pct}% of capacity`}`
            : state.key === 'upstream' ? 'No reading saved today yet' : pct === null ? 'share of capacity unknown' : `${pct}% of array capacity`}
        </div>
        {peakText && <div className="v3-gauge-peak"><i aria-hidden="true" />{peakText}</div>}
      </div>

      {/* phones: a slim strip instead of the sun, so the live tile stays small under the daily goal's town */}
      <div className="v3-live-compact" role="meter" aria-label="Live power" data-resting={resting || undefined} {...meter}>
        <div className="v3-live-compact-read">
          {loading && !live ? <div className="v3-skeleton" style={{ height: 22, width: 56 }} aria-busy="true" aria-label="Loading" /> : <span className="v3-num"><CountUp value={kw} dp={1} duration={750} delay={turn} /></span>}
          <span className="v3-live-compact-unit">{note ? 'kW then' : 'kW now'}</span>
        </div>
        <div className="v3-live-bar" aria-hidden="true">
          <i data-red={frac !== null && frac >= 0.875 ? true : undefined} style={{ width: `${typeof arc === 'number' ? Math.max(0, Math.min(100, arc)) : 0}%` }} />
          {typeof pk === 'number' && <span className="v3-live-bar-peak" style={{ left: `${(pk / 180) * 100}%` }} />}
        </div>
        <div className="v3-live-compact-sub">
          {note ? `${note[0].toUpperCase()}${note.slice(1)}` : pct === null ? (state.key === 'upstream' ? 'No reading saved today yet' : 'share unknown') : `${pct}% of ${fmtNum(maxKw)} kW`}
          {peakText ? ` · ${peakText}` : ''}
        </div>
      </div>
    </Glass>
  );
}
