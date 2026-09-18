// src/components/dashboardV2/DailyGenerationPanel.jsx
//
// Small multiples: one card per day, real inverter_data_live samples plotted as they actually
// arrived. See src/lib/dashboardV2Data.js for why this does NOT interpolate or bucket into
// smooth hourly averages — the live table collects far sparser than its name suggests, and
// showing that honestly (a card with 3 points looks like 3 points) beats faking density.

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
            style={{
              fontSize: 8,
              color: 'var(--on-accent)',
              background: 'var(--dv2-inverter)',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600
            }}
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

export default function DailyGenerationPanel({ series, loading, error }) {
  if (error) {
    return (
      <div className="dv2-card" style={{ padding: 20, color: 'var(--dv2-bad)' }}>
        Couldn't load recent generation: {error.message}
      </div>
    );
  }
  if (loading || !series) {
    return (
      <div className="dv2-card" style={{ padding: 20, color: 'var(--dv2-ink-faint)' }}>
        Loading recent days…
      </div>
    );
  }

  const allKw = series.flatMap((d) => d.points.map((p) => p.kw));
  const maxKw = allKw.length ? Math.max(...allKw) * 1.15 : 1;
  const sparse = series.every((d) => d.sampleCount <= 4);

  return (
    <div className="dv2-card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600 }}>Daily generation</div>
      </div>
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
    </div>
  );
}
