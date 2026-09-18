// src/components/dashboardV2/LiveGauges.jsx
//
// Current-power radial gauge + today-vs-target ring. Real data only:
//   currentPower / status   <- DataContext.livePowerData (solis-live-data edge function)
//   gridCapacity             <- DataContext.gridCapacity (system_settings, falls back to 40 kW)
//   todayKwh                 <- DataContext.livePowerData.dailyGeneration.value
//   dailyTarget               <- DataContext.dailyGenerationTarget (system_settings, falls back to 150)
//   tariff                    <- system_settings.rate_per_kwh, fetched by useDashboardV2Data
//
// Everything numeric can be null while its source is still loading; nulls render as "—",
// never as 0 — the LR-001 rule extends to every figure on this page, not just the hero.

import React from 'react';

function polarPoint(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarPoint(cx, cy, r, endAngle);
  const end = polarPoint(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function fmt(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export default function LiveGauges({ currentPower, status, gridCapacity, todayKwh, dailyTarget, tariff }) {
  const maxPower = Number.isFinite(gridCapacity) ? gridCapacity : 40;
  const powerFraction = Number.isFinite(currentPower) ? Math.min(Math.max(currentPower / maxPower, 0), 1) : 0;
  const gaugeEnd = -135 + powerFraction * 270;

  const target = Number.isFinite(dailyTarget) ? dailyTarget : 150;
  const targetFraction = Number.isFinite(todayKwh) ? Math.min(Math.max(todayKwh / target, 0), 1) : 0;
  const circumference = 2 * Math.PI * 58;
  const ringDash = `${circumference * targetFraction} ${circumference}`;

  const earnedToday = Number.isFinite(todayKwh) && Number.isFinite(tariff) ? todayKwh * tariff : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
      {/* current power */}
      <div className="dv2-card" style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="dv2-label">Current power</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: status === 'Online' ? 'var(--dv2-good)' : 'var(--dv2-bad)',
                animation: status === 'Online' ? 'dv2-pulse 1.8s ease-in-out infinite' : 'none'
              }}
            />
            <span className="dv2-mono" style={{ fontSize: 10, color: 'var(--dv2-ink-faint)' }}>{status || 'Offline'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
          <div style={{ position: 'relative', flex: 'none' }}>
            <svg viewBox="0 0 200 118" style={{ width: 150, height: 'auto', display: 'block' }}>
              <path d={arcPath(100, 110, 80, -135, 135)} fill="none" stroke="var(--dv2-surface-tile)" strokeWidth="12" strokeLinecap="round" />
              <path
                d={arcPath(100, 110, 80, -135, gaugeEnd)}
                fill="none"
                stroke="var(--dv2-inverter)"
                strokeWidth="12"
                strokeLinecap="round"
                style={{ transition: 'd 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', top: 44, left: 0, right: 0, textAlign: 'center' }}>
              <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 700, color: 'var(--dv2-inverter)', lineHeight: 1 }}>
                {fmt(currentPower, 2)}
                <span style={{ fontSize: 11, color: 'var(--dv2-ink-faint)', fontWeight: 500 }}> kW</span>
              </div>
              <div className="dv2-mono" style={{ fontSize: 9, color: 'var(--dv2-ink-faint)' }}>of {maxPower} kW</div>
            </div>
          </div>
        </div>
      </div>

      {/* today vs target */}
      <div className="dv2-card" style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="dv2-label">Today vs target</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ position: 'relative', width: 96, height: 96, flex: 'none' }}>
            <svg viewBox="0 0 160 160" style={{ width: 96, height: 96, display: 'block' }}>
              <circle cx="80" cy="80" r="58" fill="none" stroke="var(--dv2-surface-tile)" strokeWidth="13" />
              <circle
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke="var(--dv2-inverter)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray={ringDash}
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                {Number.isFinite(todayKwh) ? `${Math.round(targetFraction * 100)}%` : '—'}
              </div>
              <div className="dv2-mono" style={{ fontSize: 8, color: 'var(--dv2-ink-faint)' }}>of target</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 700 }}>
              {fmt(todayKwh, 1)}
              <span style={{ fontSize: 11, color: 'var(--dv2-ink-faint)' }}> kWh</span>
            </div>
            <div className="dv2-mono" style={{ fontSize: 10, color: 'var(--dv2-ink-faint)', marginBottom: 8 }}>of {target} kWh target</div>
            <div className="dv2-tnum" style={{ fontSize: 15, color: 'var(--dv2-ceb)', fontWeight: 600 }}>
              {earnedToday !== null ? `LKR ${Math.round(earnedToday).toLocaleString()}` : '—'}
            </div>
            <div className="dv2-mono" style={{ fontSize: 10, color: 'var(--dv2-ink-faint)' }}>earned today</div>
          </div>
        </div>
      </div>
    </div>
  );
}
