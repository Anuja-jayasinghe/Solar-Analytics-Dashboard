import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Note } from '../ui/Note.jsx';
import { linePath, xPct } from '../charts/scale.js';
import { fmtNum, longDate } from '../overview/format.js';

/** What each bill really paid per kWh (earnings / units exported), bill by bill. Never today's tariff. */
export function RateHistory({ rates, loading, error }) {
  const vals = rates.map((r) => r.rate);
  const lo = vals.length ? Math.floor(Math.min(...vals)) - 1 : 0;
  const hi = vals.length ? Math.ceil(Math.max(...vals)) + 1 : 1;
  const pts = rates.map((r, i) => [xPct(i, rates.length), 100 - ((r.rate - lo) / (hi - lo)) * 100]);
  return (
    <Glass card aria-label="Tariff drift">
      <div>
        <h2 className="v3-h2">What each bill really paid</h2>
        <div className="v3-sub">Effective LKR per kWh = bill earnings ÷ units exported</div>
      </div>
      {error && <Note tone="bad">Could not load bills ({error.code ?? 'error'}).</Note>}
      {loading && rates.length === 0 && <div className="v3-skeleton" style={{ height: 170 }} aria-busy="true" aria-label="Loading" />}
      {rates.length > 0 && (
        <>
          <div className="v3-miniplot" style={{ height: 170, marginTop: 18 }}>
            {[0, 50, 100].map((p) => <div key={p} className="v3-gridline" style={{ bottom: `${p}%` }}><span className="v3-mini-tick">{fmtNum(lo + ((hi - lo) * p) / 100)}</span></div>)}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={linePath(pts)} fill="none" style={{ stroke: 'var(--ceb)' }} strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
            <div className="v3-cols">
              {rates.map((r, i) => (
                <Tip key={r.key} value={`${longDate(r.key)} · LKR ${fmtNum(r.rate, 2)} / kWh`} text={`Bill ending ${longDate(r.key)} · LKR ${fmtNum(r.rate, 2)} per kWh${r.earningsLkr === null ? '' : ` (LKR ${fmtNum(r.earningsLkr)} for ${fmtNum(r.cebKwh)} kWh)`}`}>
                  <div className="v3-col" style={{ padding: 0 }}><span className="v3-dot" style={{ bottom: `${100 - pts[i][1]}%`, background: 'var(--ceb)', width: 8, height: 8 }} /></div>
                </Tip>
              ))}
            </div>
          </div>
          <div className="v3-sub" style={{ margin: 0 }}>LKR {fmtNum(Math.min(...vals), 2)} to {fmtNum(Math.max(...vals), 2)} per kWh across {rates.length} bills. Each bill is judged at its own rate, never today's tariff.</div>
        </>
      )}
    </Glass>
  );
}

/** Same bill period, last year vs this year (kWh). Weather differs between years, so it is a trend, not a fault. */
export function YearOverYear({ pairs, loading }) {
  const max = pairs.length ? Math.max(...pairs.flatMap((p) => [p.prev, p.cur])) * 1.05 : 1;
  const years = pairs.length ? [pairs[pairs.length - 1].year - 1, pairs[pairs.length - 1].year] : [];
  return (
    <Glass card aria-label="Year over year">
      <div>
        <h2 className="v3-h2">Year over year</h2>
        <div className="v3-sub">Same bill period, last year vs this year · kWh</div>
      </div>
      {loading && pairs.length === 0 && <div className="v3-skeleton" style={{ height: 150 }} aria-busy="true" aria-label="Loading" />}
      {!loading && pairs.length === 0 && <Note>Needs a complete bill period in two different years to compare.</Note>}
      {pairs.length > 0 && (
        <>
          <div className="v3-legend"><span><i style={{ background: 'var(--gen-a34)' }} />{years[0]}</span><span><i style={{ background: 'var(--gen)' }} />{years[1]}</span></div>
          <div className="v3-yoy">
            {pairs.map((p) => (
              <Tip key={`${p.label}-${p.year}`} value={`${p.label} · ${fmtNum(p.prev)} → ${fmtNum(p.cur)} kWh`} text={`${p.label} bill period: ${fmtNum(p.prev)} kWh in ${p.year - 1}, ${fmtNum(p.cur)} kWh in ${p.year}${p.deltaPct === null ? '' : ` (${p.deltaPct >= 0 ? '+' : '−'}${Math.abs(p.deltaPct).toFixed(1)}%)`}. Weather differs between years, so read it as a trend, not a fault.`}>
                <div className="v3-yoycol">
                  <div className="v3-yoybars"><i style={{ height: `${(p.prev / max) * 100}%`, background: 'var(--gen-a34)' }} /><i style={{ height: `${(p.cur / max) * 100}%`, background: 'var(--gen)' }} /></div>
                  <div className="v3-xmain">{p.label}</div>
                  <div className="v3-xtag" style={{ fontWeight: 700, color: p.deltaPct === null ? undefined : p.deltaPct >= 0 ? 'var(--good)' : 'var(--warn)' }}>{p.deltaPct === null ? '' : `${p.deltaPct >= 0 ? '+' : '−'}${Math.abs(p.deltaPct).toFixed(1)}%`}</div>
                </div>
              </Tip>
            ))}
          </div>
        </>
      )}
    </Glass>
  );
}
