import { useState } from 'react';
import { useResource } from '../data/context.js';
import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Note } from '../ui/Note.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { chartNum, linePath, xPct } from '../charts/scale.js';
import { fmtNum, longDate } from '../overview/format.js';
import { lastCompleteMonth, monthWindow } from './metrics.js';

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
        <div className="v3-sub">All available bills · effective LKR per kWh = bill earnings ÷ units exported</div>
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
                <Tip key={r.key} text={`Bill ending ${longDate(r.key)} · LKR ${fmtNum(r.rate, 2)} per kWh${r.earningsLkr === null ? '' : ` (LKR ${fmtNum(r.earningsLkr)} for ${fmtNum(r.cebKwh)} kWh)`}`}>
                  <div className="v3-col" style={{ padding: 0 }}><span className="v3-dot" style={{ bottom: `${100 - pts[i][1]}%`, background: 'var(--ceb)', width: 8, height: 8 }} />{(i === 0 || r.rate !== rates[i - 1].rate) && <span className="v3-val v3-val-pt" style={{ bottom: `calc(${100 - pts[i][1]}% + 8px)`, color: 'var(--ceb)' }}>{fmtNum(r.rate, 0)}</span>}</div>
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

/** Compare recent matching bill periods or any two completed calendar months. */
export function YearOverYear({ pairs, loading, todayKey, firstDay }) {
  const [mode, setMode] = useState('bills');
  const [pairCount, setPairCount] = useState('8');
  const [chosenA, setChosenA] = useState(null);
  const [chosenB, setChosenB] = useState(null);
  const latest = todayKey ? lastCompleteMonth(todayKey) : null;
  const monthA = chosenA ?? latest;
  const monthB = chosenB ?? (latest ? `${Number(latest.slice(0, 4)) - 1}${latest.slice(4)}` : null);
  const rangeA = monthWindow(monthA);
  const rangeB = monthWindow(monthB);
  const earliest = firstDay?.slice(0, 7) ?? null;
  const monthsValid = !!latest && !!rangeA && !!rangeB && monthA <= latest && monthB <= latest
    && (!earliest || (monthA >= earliest && monthB >= earliest));
  const a = useResource('range', { from: rangeA?.from, to: rangeA?.to }, { enabled: mode === 'months' && monthsValid });
  const b = useResource('range', { from: rangeB?.from, to: rangeB?.to }, { enabled: mode === 'months' && monthsValid });
  const statsA = a.data?.from === rangeA?.from && a.data?.to === rangeA?.to ? a.data.stats : null;
  const statsB = b.data?.from === rangeB?.from && b.data?.to === rangeB?.to ? b.data.stats : null;
  const completeA = statsA && statsA.presentDays === statsA.daysInRange;
  const completeB = statsB && statsB.presentDays === statsB.daysInRange;
  const deltaPct = completeA && completeB && statsB.totalKwh > 0 ? (statsA.totalKwh / statsB.totalKwh - 1) * 100 : null;
  const shown = pairCount === 'all' ? pairs : pairs.slice(-Number(pairCount));
  const max = shown.length ? Math.max(...shown.flatMap((p) => [p.prev, p.cur])) * 1.05 : 1;
  return (
    <Glass card aria-label="Generation comparison">
      <div>
        <h2 className="v3-h2">Compare generation</h2>
        <div className="v3-sub">Choose matching bill periods or two calendar months · inverter kWh</div>
      </div>
      <Segmented small options={[{ value: 'bills', label: 'Bill periods' }, { value: 'months', label: 'Choose months' }]} value={mode} onChange={setMode} label="Generation comparison type" />
      {mode === 'months' && <>
        <div className="v3-controls">
          <label className="v3-field-label">Month A <input className="v3-field" type="month" value={monthA ?? ''} min={earliest ?? undefined} max={latest ?? undefined} onChange={(event) => setChosenA(event.target.value)} /></label>
          <label className="v3-field-label">Month B <input className="v3-field" type="month" value={monthB ?? ''} min={earliest ?? undefined} max={latest ?? undefined} onChange={(event) => setChosenB(event.target.value)} /></label>
        </div>
        {!monthsValid && <Note>Select two completed months to compare.</Note>}
        {(a.error || b.error) && <Note tone="bad">Could not load one of the selected months.</Note>}
        {monthsValid && (a.loading || b.loading) && (!statsA || !statsB) && <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" />}
        {statsA && statsB && <>
          <div className="v3-sub">{monthA}: {statsA.totalKwh === null ? 'unknown' : `${fmtNum(statsA.totalKwh)} kWh`} ({statsA.presentDays}/{statsA.daysInRange} days) · {monthB}: {statsB.totalKwh === null ? 'unknown' : `${fmtNum(statsB.totalKwh)} kWh`} ({statsB.presentDays}/{statsB.daysInRange} days)</div>
          {deltaPct === null
            ? <Note>Percentage comparison needs every day recorded in both months. Partial totals are shown for context only.</Note>
            : <Pill>{monthA} vs {monthB}: {deltaPct >= 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%</Pill>}
          <div className="v3-sub">Calendar months can differ in weather and day count; this is an energy comparison, not a fault diagnosis.</div>
        </>}
      </>}
      {mode === 'bills' && <>
      <Segmented small options={[{ value: '3', label: '3 pairs' }, { value: '8', label: '8 pairs' }, { value: '12', label: '12 pairs' }, { value: 'all', label: 'All' }]} value={pairCount} onChange={setPairCount} label="Bill period comparison window" />
      <div className="v3-sub">This selector changes only the comparison below. Bill periods must have complete daily inverter totals in both years.</div>
      {loading && shown.length === 0 && <div className="v3-skeleton" style={{ height: 150 }} aria-busy="true" aria-label="Loading" />}
      {!loading && shown.length === 0 && <Note>Needs a complete matching bill period in two different years to compare.</Note>}
      {shown.length > 0 && (
        <>
          <div className="v3-legend"><span><i style={{ background: 'var(--gen-a34)' }} />Previous year</span><span><i style={{ background: 'var(--gen)' }} />Shown year</span></div>
          <div className="v3-yoy">
            {shown.map((p) => (
              <Tip key={`${p.label}-${p.year}`} text={`${p.label} bill period: ${fmtNum(p.prev)} kWh in ${p.year - 1}, ${fmtNum(p.cur)} kWh in ${p.year}${p.deltaPct === null ? '' : ` (${p.deltaPct >= 0 ? '+' : '−'}${Math.abs(p.deltaPct).toFixed(1)}%)`}. Weather differs between years, so read it as a trend, not a fault.`}>
                <div className="v3-yoycol">
                  <div className="v3-yoybars"><i style={{ height: `${(p.prev / max) * 100}%`, background: 'var(--gen-a34)' }}><span className="v3-val">{chartNum(p.prev, { dense: true })}</span></i><i style={{ height: `${(p.cur / max) * 100}%`, background: 'var(--gen)' }}><span className="v3-val">{chartNum(p.cur, { dense: true })}</span></i></div>
                  <div className="v3-xmain">{p.label} {p.year}</div>
                  <div className="v3-xtag" style={{ fontWeight: 700, color: p.deltaPct === null ? undefined : p.deltaPct >= 0 ? 'var(--good)' : 'var(--warn)' }}>{p.deltaPct === null ? '' : `${p.deltaPct >= 0 ? '+' : '−'}${Math.abs(p.deltaPct).toFixed(1)}%`}</div>
                </div>
              </Tip>
            ))}
          </div>
        </>
      )}
      </>}
    </Glass>
  );
}
