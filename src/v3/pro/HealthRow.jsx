import { Glass } from '../ui/Glass.jsx';
import { Info } from '../ui/Info.jsx';
import { fmtNum } from '../overview/format.js';
import { minutesLabel, uptimeTone } from './metrics.js';

const TONE = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', none: 'var(--nodata)' };

function Ring({ pct, color }) {
  const dash = pct === null ? '0 100' : `${Math.max(0, Math.min(100, pct)).toFixed(1)} 100`;
  return (
    <svg className="v3-ring" width="62" height="62" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="15.5" fill="none" style={{ stroke: 'var(--track)' }} strokeWidth="4" />
      <circle cx="18" cy="18" r="15.5" fill="none" style={{ stroke: color }} strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray={dash} transform="rotate(-90 18 18)" />
    </svg>
  );
}

function RingTile({ label, value, unit, sub, info, pct, color, loading }) {
  return (
    <Glass className="v3-ringtile" aria-label={label}>
      <Ring pct={pct} color={color} />
      <div style={{ minWidth: 0 }}>
        <div className="v3-kpi-label">{label}{info && <Info label={`About ${label.toLowerCase()}`} {...info} />}</div>
        {loading ? <div className="v3-skeleton" style={{ height: 26, width: 80 }} aria-busy="true" aria-label="Loading" /> : <div className="v3-num v3-ring-value">{value}{unit ? <span>{unit}</span> : null}</div>}
        <div className="v3-kpi-sub">{loading ? ' ' : sub}</div>
      </div>
    </Glass>
  );
}

/** Four rings: uptime, time stopped, unresolved alarms in the period, and all-time coverage. */
export function HealthRow({ summary: s, loading }) {
  const upTone = uptimeTone(s.uptimePct);
  return (
    <section className="v3-rings" aria-label="Health">
      <RingTile
        label="Uptime" loading={loading}
        value={s.uptimePct === null ? '—' : fmtNum(s.uptimePct, 1)} unit={s.uptimePct === null ? '' : '%'}
        sub={s.daysCounted ? `daylight hours · ${s.daysCounted} days` : 'no days counted'}
        pct={s.uptimePct} color={TONE[upTone]}
        info={{ title: 'Daylight only', text: 'Share of each daylight window (sunrise + 30 min to sunset − 30 min) the inverter was running. Night never counts as downtime.' }}
      />
      <RingTile
        label="Time stopped" loading={loading}
        value={minutesLabel(s.downMinutes)} unit=""
        sub={s.tripCount === null ? '' : `${s.tripCount} trips · ${s.affectedDays ?? '—'} of ${s.totalDays} days`}
        pct={s.affectedDays === null || !s.totalDays ? null : (s.affectedDays / s.totalDays) * 100} color="var(--warn)"
        info={{ title: 'Trips and unexplained gaps', text: 'Minutes stopped inside daylight windows. The ring is the share of days affected.' }}
      />
      <RingTile
        label="Unresolved in period" loading={loading}
        value={s.openAlarms === null ? '—' : String(s.openAlarms)} unit=""
        sub={s.alarmsListed === null ? '' : `${s.alarmsListed}${s.alarmsTruncated ? '+' : ''} in selected period`}
        pct={s.openAlarms === null ? null : 100} color={s.openAlarms ? 'var(--bad)' : 'var(--good)'}
        info={{ title: 'Began in this period, no end recorded', text: 'Alarms still active from earlier are not counted. A dash means the alarm list may be incomplete.' }}
      />
      <RingTile
        label="All-time coverage" loading={loading}
        value={s.completenessPct === null ? '—' : fmtNum(s.completenessPct, 1)} unit={s.completenessPct === null ? '' : '%'}
        sub={s.dataDays === null ? '' : `${fmtNum(s.dataDays)} of ${fmtNum(s.spanDays)} days collected`}
        pct={s.completenessPct} color={s.completenessPct !== null && s.completenessPct >= 99 ? 'var(--good)' : 'var(--warn)'}
      />
    </section>
  );
}
