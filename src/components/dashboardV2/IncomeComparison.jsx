// src/components/dashboardV2/IncomeComparison.jsx
//
// "Should have been paid" (generation x tariff) vs "actually paid" (the bill's own earnings
// figure), for the last settled period and lifetime. Lifetime reuses the SAME numbers
// EarningsDifference.jsx already computes in DataContext (inverterPotentialValue.total,
// totalEarningsData.total) — this panel doesn't recompute them, just presents them
// differently, so the two views of the app can never quietly disagree.

import React from 'react';

function money(value) {
  return Number.isFinite(value) ? `LKR ${Math.round(value).toLocaleString()}` : '—';
}

export default function IncomeComparison({ income, loading, error }) {
  if (error) {
    return (
      <div className="dv2-card" style={{ padding: 20, color: 'var(--dv2-bad)' }}>
        Couldn't load the income comparison: {error.message}
      </div>
    );
  }
  if (loading || !income) {
    return (
      <div className="dv2-card" style={{ padding: 20, color: 'var(--dv2-ink-faint)' }}>
        Loading income comparison…
      </div>
    );
  }

  const { periodLabel, expectedLast, actualLast, diffLast, diffPctLast, lifetimeExpected, lifetimeActual, lifetimeDiff } = income;

  const expectedFraction = 1;
  const actualFraction = Number.isFinite(expectedLast) && expectedLast > 0 && Number.isFinite(actualLast)
    ? Math.min(actualLast / expectedLast, 1.2)
    : 0;

  const diffColor = diffLast === null ? 'var(--dv2-ink-faint)' : diffLast < 0 ? 'var(--dv2-warn)' : 'var(--dv2-good)';
  const lifetimeDiffColor = lifetimeDiff === null ? 'var(--dv2-ink-faint)' : lifetimeDiff < 0 ? 'var(--dv2-warn)' : 'var(--dv2-good)';

  return (
    <div className="dv2-card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 600 }}>
          Income — should have been paid <span style={{ color: 'var(--dv2-ink-faint)', fontWeight: 400 }}>vs</span> actually paid
        </div>
        <span className="dv2-mono" style={{ fontSize: 10.5, color: 'var(--dv2-ink-faintest)' }}>
          expected = generation × tariff · current period still open
        </span>
      </div>

      <div className="dv2-income-grid">
        <div>
          <div className="dv2-label" style={{ marginBottom: 12 }}>
            {periodLabel ? `Last settled · ${periodLabel}` : 'No settled period yet'}
          </div>
          {periodLabel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--dv2-ink-soft)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--dv2-inverter)' }} />
                    Should have been paid
                  </span>
                  <span className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 600 }}>{money(expectedLast)}</span>
                </div>
                <div className="dv2-tile" style={{ height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${expectedFraction * 100}%`, height: '100%', background: 'var(--dv2-inverter)' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--dv2-ink-soft)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--dv2-ceb)' }} />
                    Actually paid (CEB)
                  </span>
                  <span className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 600 }}>{money(actualLast)}</span>
                </div>
                <div className="dv2-tile" style={{ height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(actualFraction, 1) * 100}%`, height: '100%', background: 'var(--dv2-ceb)' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dv2-income-side">
          <div className="dv2-label">Last-period difference</div>
          <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 30, fontWeight: 700, color: diffColor, lineHeight: 1.1, marginTop: 6 }}>
            {diffLast === null ? '—' : `${diffLast >= 0 ? '+' : ''}${money(diffLast)}`}
          </div>
          {diffPctLast !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span
                className="dv2-mono"
                style={{ padding: '3px 8px', borderRadius: 6, background: diffLast < 0 ? 'var(--dv2-warn-bg)' : 'var(--dv2-good-bg)', color: diffColor, fontSize: 11 }}
              >
                {diffPctLast >= 0 ? '+' : ''}{diffPctLast.toFixed(1)}%
              </span>
              <span className="dv2-mono" style={{ fontSize: 11, color: 'var(--dv2-ink-faint)' }}>
                {diffLast < 0 ? 'under-paid' : 'over-paid'}
              </span>
            </div>
          )}
        </div>

        <div className="dv2-income-side">
          <div className="dv2-label">Lifetime paid</div>
          <div className="dv2-tnum" style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 6 }}>
            {money(lifetimeActual)}
          </div>
          <div className="dv2-mono" style={{ fontSize: 11, color: 'var(--dv2-ink-faint)', marginTop: 6 }}>
            vs {money(lifetimeExpected)} expected
            {lifetimeDiff !== null && (
              <>
                {' · '}
                <span style={{ color: lifetimeDiffColor }}>
                  {lifetimeDiff >= 0 ? '+' : ''}{money(lifetimeDiff)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
