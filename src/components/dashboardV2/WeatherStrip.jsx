// src/components/dashboardV2/WeatherStrip.jsx
//
// D6 / §7.2 of docs/UI_REDESIGN_DIRECTION.md: Open-Meteo, explanatory context ONLY. Never
// render a value from here next to, or feeding into, any comparison figure — validated at
// r²=0.53 against this plant's own output, which is fine for "why was yesterday dim" and not
// fine for anything that looks like evidence.
//
// On any fetch failure this panel disappears rather than showing stale or placeholder
// weather — the CSP change in vercel.json is what makes the fetch reachable at all; without
// it the request is silently blocked and this returning null is exactly what should happen.

import React from 'react';
import { weatherCodeToKind } from '../../lib/dashboardV2Data';

function WeatherIcon({ kind, size = 22 }) {
  const stroke = 'var(--dv2-ink-faint)';
  const sunStroke = 'var(--dv2-inverter)';
  const rainStroke = 'var(--dv2-ceb)';
  switch (kind) {
    case 'clear':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" stroke={sunStroke} strokeWidth="1.6" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6l-1.4 1.4M6 17l-1.4 1.4" stroke={sunStroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'rain':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18H7z" stroke={stroke} strokeWidth="1.6" />
          <path d="M9 20l-1 2M13 20l-1 2" stroke={rainStroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'storm':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M7 15a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 15H7z" stroke={stroke} strokeWidth="1.6" />
          <path d="M12 15l-2 4h3l-1 3" stroke="var(--dv2-warn)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'fog':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M4 10h16M4 14h16M4 18h10" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'snow':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18H7z" stroke={stroke} strokeWidth="1.6" />
          <path d="M9 20l0 2M13 20l0 2M11 21h2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'cloudy':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18H7z" stroke={stroke} strokeWidth="1.6" />
        </svg>
      );
  }
}

export default function WeatherStrip({ weather, error }) {
  if (error || !weather) return null; // explanatory only — hide rather than fake it

  return (
    <div className="dv2-card" style={{ padding: '14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 600 }}>Weather</div>
          <span className="dv2-mono" style={{ fontSize: 9, color: 'var(--dv2-ink-faintest)' }}>
            OPEN-METEO · context only, not a forecast of output
          </span>
        </div>
        {weather.current.temperature !== null && (
          <span className="dv2-mono" style={{ fontSize: 11, color: 'var(--dv2-ink-soft)' }}>
            {Math.round(weather.current.temperature)}°C
            {weather.current.humidity !== null && ` · ${Math.round(weather.current.humidity)}% RH`}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weather.daily.length}, minmax(0,1fr))`, gap: 4 }}>
        {weather.daily.map((d, i) => (
          <div key={d.date} style={{ textAlign: 'center' }}>
            <div className="dv2-mono" style={{ fontSize: 9, color: 'var(--dv2-ink-faint)' }}>
              {i === 0 ? 'Today' : new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' })}
            </div>
            <div style={{ margin: '2px auto' }}>
              <WeatherIcon kind={weatherCodeToKind(d.weatherCode)} />
            </div>
            <div className="dv2-tnum" style={{ fontSize: 11 }}>
              {Number.isFinite(d.tMax) ? Math.round(d.tMax) : '—'}°
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
