// src/components/dashboardV2/DailyGenerationPanel.jsx
//
// Day/Week: small multiples, one card per day, real inverter_data_live samples plotted as
// they actually arrived. See src/lib/dashboardV2Data.js for why this does NOT interpolate or
// bucket into smooth hourly averages — the live table collects far sparser than its name
// suggests, and showing that honestly (a card with 3 points looks like 3 points) beats faking
// density.
//
// Month: 30 small-multiple cards would be unreadable, so this switches to a single bar chart
// of daily totals from inverter_data_daily_summary instead.
//
// The ‹ › stepper and the Day/Week/Month pills are wired to real state in
// useDashboardV2Data — nothing here is decorative.

import React from 'react';

const CARD_VIEW_W = 120;
const CARD_VIEW_H = 90;
const PAD = 6;

function buildPath(points, maxKw) {
  if (!points.length) return null;
  const usableW = CARD_VIEW_W - PAD * 2;
  const usableH = CARD_VIEW_H - PAD * 2;
  const coords = points.map((p) => {
    const x = PAD + (p.hour / 24) * usableW;
    const y = PAD + usableH - (Math.max(p.kw, 0) / maxKw) * usableH;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return coords.join(' L ');
}

function DayCard({ day, maxKw }) {
  const linePath = buildPath(day.points, maxKw);
  const areaPath = linePath
    ? `M ${PAD} ${CARD_VIEW_H - PAD} L ${linePath} L ${CARD_VIEW_W - PAD} ${CARD_VIEW_H - PAD} Z`
    : null;

  return (
    <div
      className="dv2-tile"
      style={{
        // flex-basis is set by .dv2-daycards > * in dv2-tokens.css, which the 768px
        // breakpoint overrides — an inline `flex: 1` here would out-specificity that
        // media query and the cards would never wrap on a phone.
        padding: '12px 12px 10px',
        outline: day.isToday ? '1.5px solid rgba(255,138,61,.5)' : 'none',
        outlineOffset: -1.5,
        minWidth: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="dv2-mono" style={{ fontSize: 10, color: day.isToday ? 'var(--dv2-inverter)' : 'var(--dv2-ink-faint)' }}>
          {day.label}
        </span>
        {day.isToday && (
          <span
            className="dv2-mono"
            style={{ fontSize: 8, color: 'var(--on-accent)', background: 'var(--dv2-inverter)', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}
          >
            TODAY
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${CARD_VIEW_W} ${CARD_VIEW_H}`} style={{ width: '100%', height: 84, display: 'block', margin: '8px 0 6px' }}>
        {areaPath && <path d={areaPath} fill="var(--dv2-inverter-fill)" />}
        {linePath && (
          <path d={`M ${linePath}`} fill="none" stroke="var(--dv2-inverter)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {linePath &&
          day.points.map((p, i) => {
            const x = PAD + (p.hour / 24) * (CARD_VIEW_W - PAD * 2);
            const y = PAD + (CARD_VIEW_H - PAD * 2) - (Math.max(p.kw, 0) / maxKw) * (CARD_VIEW_H - PAD * 2);
            return <circle key={i} cx={x} cy={y} r="2" fill="var(--dv2-inverter)" />;
          })}
        {!linePath && (
          <text x={CARD_VIEW_W / 2} y={CARD_VIEW_H / 2} textAnchor="middle" fontSize="8" fill="var(--dv2-ink-faintest)">
            no samples
          </text>
        )}
      </svg>

      <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 600 }}>
        {Number.isFinite(day.totalKwh) ? day.totalKwh.toFixed(day.isToday ? 1 : 0) : '—'}
        <span style={{ fontSize: 9, color: 'var(--dv2-ink-faint)' }}> kWh</span>
      </div>
      <div className="dv2-mono" style={{ fontSize: 9, color: 'var(--dv2-ink-faint)' }}>
        {day.isToday
          ? 'so far'
          : Number.isFinite(day.peakKw)
            ? `peak ${day.peakKw.toFixed(1)} kW`
            : `${day.sampleCount} sample${day.sampleCount === 1 ? '' : 's'}`}
      </div>
    </div>
  );
}

function MonthChart({ series }) {
  const known = series.filter((d) => Number.isFinite(d.totalKwh));
  const maxKwh = known.length ? Math.max(...known.map((d) => d.totalKwh)) * 1.15 : 1;
  const vbW = 640;
  const vbH = 150;
  const padB = 20;
  const barGap = 2;
  const barW = (vbW - (series.length - 1) * barGap) / series.length;

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: '100%', height: 170, display: 'block' }}>
      <line x1={0} y1={vbH - padB} x2={vbW} y2={vbH - padB} stroke="var(--dv2-ink-faint)" strokeOpacity="0.4" />
      {series.map((d, i) => {
        const x = i * (barW + barGap);
        if (d.isFuture) return null; // nothing to draw for a day that hasn't happened
        const h = Number.isFinite(d.totalKwh) ? (d.totalKwh / maxKwh) * (vbH - padB - 6) : 0;
        const y = vbH - padB - h;
        return (
          <g key={d.date}>
            {Number.isFinite(d.totalKwh) ? (
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="1.5"
                fill={d.isToday ? 'var(--dv2-inverter)' : 'var(--dv2-inverter-fill)'}
                stroke={d.isToday ? 'none' : 'var(--dv2-inverter)'}
                strokeWidth={d.isToday ? 0 : 0.6}
              />
            ) : (
              // A past day with genuinely no data — a thin tick, not a bar at 0. A missing
              // reading is not the same claim as "generated nothing that day".
              <line x1={x + barW / 2} y1={vbH - padB - 3} x2={x + barW / 2} y2={vbH - padB} stroke="var(--dv2-ink-faintest)" strokeWidth="1.5" />
            )}
            {(d.day === 1 || d.day % 5 === 0) && (
              <text x={x + barW / 2} y={vbH - 4} textAnchor="middle" fontSize="8" fill="var(--dv2-ink-faintest)" className="dv2-mono">
                {d.day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const MODES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' }
];

export default function DailyGenerationPanel({
  mode,
  onModeChange,
  onStepBack,
  onStepForward,
  canStepForward,
  rangeLabel,
  series,
  loading,
  error,
  monthSeries,
  monthLoading,
  monthError
}) {
  const isMonth = mode === 'month';
  const activeError = isMonth ? monthError : error;
  const activeLoading = isMonth ? monthLoading : loading;

  const allKw = !isMonth && series ? series.flatMap((d) => d.points.map((p) => p.kw)) : [];
  const maxKw = allKw.length ? Math.max(...allKw) * 1.15 : 1;
  const sparse = !isMonth && series && series.every((d) => d.sampleCount <= 4);

  return (
    <div className="dv2-card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600 }}>Daily generation</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="dv2-tile" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 4px' }}>
            <button
              type="button"
              onClick={onStepBack}
              aria-label="Earlier"
              style={{ width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dv2-ink-soft)', cursor: 'pointer' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="dv2-mono" style={{ fontSize: 12, color: 'var(--dv2-ink)', minWidth: 110, textAlign: 'center' }}>{rangeLabel}</span>
            <button
              type="button"
              onClick={onStepForward}
              disabled={!canStepForward}
              aria-label="Later"
              style={{
                width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: canStepForward ? 'var(--dv2-ink-soft)' : 'var(--dv2-ink-faintest)',
                cursor: canStepForward ? 'pointer' : 'default', opacity: canStepForward ? 1 : 0.5
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div className="dv2-tile" style={{ display: 'flex', padding: 3 }}>
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onModeChange(m.key)}
                className="dv2-mono"
                style={{
                  fontSize: 11, padding: '4px 11px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: mode === m.key ? 'var(--dv2-inverter)' : 'transparent',
                  color: mode === m.key ? 'var(--on-accent)' : 'var(--dv2-ink-faint)',
                  fontWeight: mode === m.key ? 600 : 400
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeError ? (
        <div style={{ color: 'var(--dv2-bad)', padding: '20px 0' }}>Couldn't load this range: {activeError.message}</div>
      ) : activeLoading || (isMonth ? !monthSeries : !series) ? (
        <div style={{ color: 'var(--dv2-ink-faint)', padding: '20px 0' }}>Loading…</div>
      ) : isMonth ? (
        <>
          <div className="dv2-mono" style={{ fontSize: 10.5, color: 'var(--dv2-ink-faint)', marginBottom: 4 }}>
            daily totals · a tick with no bar means the day is missing a reading, not that it generated nothing
          </div>
          <MonthChart series={monthSeries} />
        </>
      ) : (
        <>
          <div className="dv2-mono" style={{ fontSize: 10.5, color: 'var(--dv2-ink-faint)', marginBottom: 12 }}>
            {series.length} consecutive days · each dot is a real inverter reading
          </div>
          <div className="dv2-daycards">
            {series.map((day) => (
              <DayCard key={day.date} day={day} maxKw={maxKw} />
            ))}
          </div>
          {sparse && (
            <div className="dv2-mono" style={{ fontSize: 9.5, color: 'var(--dv2-ink-faintest)', marginTop: 10 }}>
              Live telemetry is arriving only a few times a day right now, not every 5 minutes — the shapes above are real, just thin.
            </div>
          )}
        </>
      )}
    </div>
  );
}
