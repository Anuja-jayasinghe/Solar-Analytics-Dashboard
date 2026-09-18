// src/components/dashboardV2/GenerationVsCebChart.jsx
//
// "Generation vs CEB paid · kWh" — Option D from the comment-thread exploration (overlapping
// filled areas, two colours, exposed band = shortfall). Built from real, LR-001-aligned data
// (src/lib/dashboardV2Data.js#buildOverlapSeries), not from the mockup's fixed coordinates.
//
// The CEB series stops drawing at the last month that actually has a bill. The current
// in-progress month renders as a dashed inverter-only continuation with no CEB point and no
// fabricated shortfall — null is not 0, here as everywhere else in this app.

import React from 'react';

const VB_W = 640;
const VB_H = 210;
const PAD_L = 36;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 24;

function scaleY(value, min, max) {
  const usable = VB_H - PAD_T - PAD_B;
  if (max === min) return PAD_T + usable / 2;
  return PAD_T + usable - ((value - min) / (max - min)) * usable;
}

export default function GenerationVsCebChart({ series }) {
  const { points, maxKwh, minKwh } = series || { points: [], maxKwh: 0, minKwh: 0 };

  if (!points.length) {
    return (
      <div className="dv2-card" style={{ padding: 20, color: 'var(--dv2-ink-faint)' }}>
        Not enough billed history yet to compare generation against CEB.
      </div>
    );
  }

  const usableW = VB_W - PAD_L - PAD_R;
  const xStep = points.length > 1 ? usableW / (points.length - 1) : 0;
  const xAt = (i) => PAD_L + i * xStep;

  // A ~1-5% monthly shortfall is invisible on a 0-based axis — this is the whole reason a
  // bar chart and a 0-based line chart were both rejected as "feels empty". Padding tightly
  // around the actual values (not clamping to 0) is what makes the exposed-band technique
  // legible; see the comment on buildOverlapSeries in dashboardV2Data.js.
  const range = Math.max(maxKwh - minKwh, 1);
  const domainPad = range * 0.15;
  const domainMax = maxKwh + domainPad;
  const domainMin = Math.max(0, minKwh - domainPad);

  const lastBothIdx = (() => {
    let idx = -1;
    points.forEach((p, i) => { if (p.ceb !== null) idx = i; });
    return idx;
  })();

  const inverterCoords = points.map((p, i) => [xAt(i), scaleY(p.inverter, domainMin, domainMax)]);
  const cebCoords = points
    .map((p, i) => (p.ceb !== null ? [xAt(i), scaleY(p.ceb, domainMin, domainMax)] : null))
    .filter(Boolean);

  const settledInverterCoords = inverterCoords.slice(0, lastBothIdx + 1);
  const partialInverterCoords = inverterCoords.slice(lastBothIdx); // includes the join point

  const pathFrom = (coords) => coords.map(([x, y]) => `${x} ${y}`).join(' L ');

  const inverterAreaPath =
    settledInverterCoords.length > 1
      ? `M ${pathFrom(settledInverterCoords)} L ${settledInverterCoords[settledInverterCoords.length - 1][0]} ${VB_H - PAD_B} L ${settledInverterCoords[0][0]} ${VB_H - PAD_B} Z`
      : null;
  const cebAreaPath =
    cebCoords.length > 1
      ? `M ${pathFrom(cebCoords)} L ${cebCoords[cebCoords.length - 1][0]} ${VB_H - PAD_B} L ${cebCoords[0][0]} ${VB_H - PAD_B} Z`
      : null;

  // Largest shortfall among settled months, for the summary line.
  const settledDiffs = points
    .filter((p) => p.ceb !== null)
    .map((p) => ({ label: p.label, diff: p.ceb - p.inverter }));
  const worst = settledDiffs.length
    ? settledDiffs.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a))
    : null;
  const avgDiff = settledDiffs.length
    ? settledDiffs.reduce((s, d) => s + d.diff, 0) / settledDiffs.length
    : null;

  return (
    <div className="dv2-card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600 }}>
          Generation vs CEB paid <span style={{ color: 'var(--dv2-ink-faint)', fontWeight: 400 }}>· kWh</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 10, borderRadius: 2, background: 'var(--dv2-inverter-fill)' }} />
          <span className="dv2-mono" style={{ fontSize: 10.5, color: 'var(--dv2-ink-soft)' }}>Inverter generated</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 10, borderRadius: 2, background: 'var(--dv2-ceb-fill)' }} />
          <span className="dv2-mono" style={{ fontSize: 10.5, color: 'var(--dv2-ink-soft)' }}>CEB paid</span>
        </span>
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 210, display: 'block' }}>
        <line x1={PAD_L} y1={PAD_T} x2={VB_W - PAD_R} y2={PAD_T} stroke="var(--dv2-divider)" />
        <line x1={PAD_L} y1={(PAD_T + VB_H - PAD_B) / 2} x2={VB_W - PAD_R} y2={(PAD_T + VB_H - PAD_B) / 2} stroke="var(--dv2-divider)" />
        <line x1={PAD_L} y1={VB_H - PAD_B} x2={VB_W - PAD_R} y2={VB_H - PAD_B} stroke="var(--dv2-ink-faint)" strokeOpacity="0.4" />
        <text x={PAD_L - 4} y={scaleY(maxKwh, domainMin, domainMax) + 3} textAnchor="end" className="dv2-mono" fill="var(--dv2-ink-faintest)" fontSize="9">
          {Math.round(maxKwh).toLocaleString()}
        </text>
        <text x={PAD_L - 4} y={scaleY(minKwh, domainMin, domainMax) + 3} textAnchor="end" className="dv2-mono" fill="var(--dv2-ink-faintest)" fontSize="9">
          {Math.round(minKwh).toLocaleString()}
        </text>

        {inverterAreaPath && <path d={inverterAreaPath} fill="var(--dv2-inverter-fill)" />}
        {cebAreaPath && <path d={cebAreaPath} fill="var(--dv2-ceb-fill)" />}

        {cebCoords.length > 1 && (
          <path d={`M ${pathFrom(cebCoords)}`} fill="none" stroke="var(--dv2-ceb)" strokeWidth="2.2" strokeLinejoin="round" />
        )}
        {settledInverterCoords.length > 1 && (
          <path d={`M ${pathFrom(settledInverterCoords)}`} fill="none" stroke="var(--dv2-inverter)" strokeWidth="2.4" strokeLinejoin="round" />
        )}
        {partialInverterCoords.length > 1 && (
          <path
            d={`M ${pathFrom(partialInverterCoords)}`}
            fill="none"
            stroke="var(--dv2-inverter)"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeOpacity="0.7"
          />
        )}

        {points.map((p, i) => (
          <text
            key={p.label + i}
            x={xAt(i)}
            y={VB_H - 6}
            textAnchor="middle"
            className="dv2-mono"
            fill={p.status === 'provisional' ? 'var(--dv2-ink-faint)' : 'var(--dv2-ink-faintest)'}
            fontSize="9.5"
          >
            {p.label}
          </text>
        ))}
      </svg>

      {worst && (
        <div className="dv2-mono" style={{ fontSize: 10, color: 'var(--dv2-ink-faintest)', marginTop: 2, textAlign: 'right' }}>
          widest gap {worst.label} {worst.diff >= 0 ? '+' : ''}{Math.round(worst.diff)} kWh
          {avgDiff !== null && ` · avg ${avgDiff >= 0 ? '+' : ''}${Math.round(avgDiff)} kWh/mo`}
        </div>
      )}
    </div>
  );
}
