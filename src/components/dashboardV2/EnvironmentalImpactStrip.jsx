// src/components/dashboardV2/EnvironmentalImpactStrip.jsx
//
// Reuses DataContext's environmentalImpact exactly as computed there (co2Avoided,
// treesPlanted — see DataContext.jsx's 'live' fetch branch). The redesign mockup also showed
// a "coal saved" tile; there is no coal-saved factor anywhere in system_settings or
// DataContext, so it is left out here rather than invented for the sake of matching the
// mockup's three-tile layout.

import React from 'react';

function fmtTonnes(value) {
  return Number.isFinite(value) ? `${(value / 1000).toFixed(1)} t` : '—';
}

export default function EnvironmentalImpactStrip({ co2Avoided, treesPlanted }) {
  return (
    <div className="dv2-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--dv2-good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 21v-6M12 15c-4 0-6-2.5-6-6 3.5 0 6 1.8 6 6zM12 12c0-4 2-6.5 6-6.5 0 4-2.5 6.5-6 6.5z" stroke="var(--dv2-good)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600 }}>
            {Number.isFinite(treesPlanted) ? treesPlanted.toFixed(1) : '—'}
          </div>
          <div className="dv2-mono" style={{ fontSize: 8.5, color: 'var(--dv2-ink-faint)' }}>equivalent trees</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--dv2-ceb-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M17 17H7a4 4 0 01-.5-8 5.5 5.5 0 0110.8-1A3.7 3.7 0 0117 17z" stroke="var(--dv2-ceb)" strokeWidth="1.6" />
          </svg>
        </div>
        <div>
          <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600 }}>
            {fmtTonnes(co2Avoided)}
          </div>
          <div className="dv2-mono" style={{ fontSize: 8.5, color: 'var(--dv2-ink-faint)' }}>CO₂ avoided</div>
        </div>
      </div>
    </div>
  );
}
