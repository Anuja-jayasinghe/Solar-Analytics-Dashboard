import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { Note } from '../ui/Note.jsx';
import { ThresholdPlot } from '../charts/ThresholdPlot.jsx';
import { MarkToggle } from '../charts/MarkToggle.jsx';
import { usePrefs } from '../prefs/context.js';
import { MAX_LABELLED_COLUMNS, areaPath, axisTicks, chartNum, linePath, maxOf, niceMax, xPct, yPct } from '../charts/scale.js';
import { fmtNum, openBillPeriod, openPeriodSoFar } from '../overview/format.js';
import { aboveSummary, buildCebRows, columnTip, defaultThreshold, gapSummary, isPartial, stepEnd, varianceTag, windowOf } from './rows.js';
import { GapStrip } from './GapStrip.jsx';
import { CebTable } from './CebTable.jsx';

const STYLES = [{ value: 'bars', label: 'Bars' }, { value: 'line', label: 'Lines' }, { value: 'area', label: 'Area' }];
const COUNTS = [{ value: 8, label: '8' }, { value: 12, label: '12' }, { value: 'all', label: 'All' }];
const STRIPE = 'repeating-linear-gradient(135deg, var(--gen) 0 5px, var(--gen-a30) 5px 9px)';

function Columns({ rows, yMax, threshold, style }) {
  const n = rows.length;
  const dense = n > 12;
  const labels = n <= MAX_LABELLED_COLUMNS;
  const num = (v) => (labels ? chartNum(v, { dense }) : '');
  const invPts = rows.map((r, i) => (r.inverterKwh === null ? null : [xPct(i, n), yPct(r.inverterKwh, yMax)]));
  const cebPts = rows.map((r, i) => (r.cebKwh === null ? null : [xPct(i, n), yPct(r.cebKwh, yMax)]));
  return (
    <>
      {style !== 'bars' && (
        <svg className="v3-plot-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {style === 'area' && <path d={areaPath(invPts)} style={{ fill: 'var(--gen-a16)' }} />}
          <path d={linePath(invPts)} fill="none" style={{ stroke: 'var(--gen)' }} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={linePath(cebPts)} fill="none" style={{ stroke: 'var(--ceb)' }} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div className="v3-cols" data-dense={n > 16 || undefined}>
        {rows.map((r) => {
          const hi = r.inverterKwh !== null && r.inverterKwh > threshold;
          const invPct = r.inverterKwh === null ? 0 : (r.inverterKwh / yMax) * 100;
          const cebPct = r.cebKwh === null ? 0 : (r.cebKwh / yMax) * 100;
          const striped = r.status === 'provisional' || isPartial(r);
          return (
            <Tip key={r.id} text={columnTip(r, threshold)}>
              <div className="v3-col">
                {style === 'bars' ? (
                  <>
                    {r.inverterKwh !== null && (
                      <div className="v3-bar" style={{ height: `${invPct}%`, background: striped ? STRIPE : 'var(--gen)', border: striped ? '1px solid var(--gen)' : undefined, opacity: hi ? 1 : 0.5 }}><span className="v3-val">{num(r.inverterKwh)}</span></div>
                    )}
                    {r.status === 'provisional' ? (
                      <div className="v3-bar" style={{ height: `${invPct * 0.9}%`, border: '1.5px dashed var(--ceb)', opacity: 0.6 }} />
                    ) : r.cebKwh !== null ? (
                      <div className="v3-bar" style={{ height: `${cebPct}%`, background: 'var(--ceb)' }}><span className="v3-val">{num(r.cebKwh)}</span></div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {r.inverterKwh !== null && <span className="v3-dot" style={{ bottom: `${invPct}%`, background: 'var(--gen)', width: hi ? 11 : 8, height: hi ? 11 : 8 }} />}
                    {r.inverterKwh !== null && <span className="v3-val v3-val-pt" style={{ bottom: `calc(${invPct}% + 8px)`, color: 'var(--gen)' }}>{num(r.inverterKwh)}</span>}
                    {r.cebKwh !== null && <span className="v3-dot" style={{ bottom: `${cebPct}%`, background: 'var(--ceb)', width: 9, height: 9 }} />}
                    {r.cebKwh !== null && <span className="v3-val v3-val-pt below" style={{ bottom: `calc(${cebPct}% - 20px)`, color: 'var(--ceb)' }}>{num(r.cebKwh)}</span>}
                  </>
                )}
              </div>
            </Tip>
          );
        })}
      </div>
    </>
  );
}

/**
 * CEB vs Inverter: one column per bill period (LR-001), the open period last and marked "awaiting bill",
 * a draggable "Mark above" line, and the money gap (LR-004) aligned underneath.
 */
export function CebCompare({ bills, comparison, live, lastStoredDay, todayKey, loading, error }) {
  const open = useMemo(() => {
    const r = (comparison?.rows ?? []).find((x) => x && x.status === 'provisional');
    const soFar = openPeriodSoFar(openBillPeriod(comparison?.rows), live, lastStoredDay, todayKey);
    return r && soFar ? { month: r.month, year: comparison.year, periodStart: r.periodStart, inverter: soFar.kwh, daysPresent: soFar.daysPresent, daysInPeriod: soFar.daysInPeriod, includesToday: soFar.includesToday } : null;
  }, [comparison, live, lastStoredDay, todayKey]);
  const rows = useMemo(() => buildCebRows(bills?.bills, open, todayKey), [bills, open, todayKey]);

  const [style, setStyle] = useState('bars');
  const [count, setCount] = useState(8);
  const [endIdx, setEndIdx] = useState(null); // null = follow the newest period
  const [thr, setThr] = useState(null); // null = the median of what we have
  const { showMark } = usePrefs();
  const threshold = thr ?? defaultThreshold(rows);
  const markAt = showMark ? threshold : -Infinity; // hidden: every inverter bar at full strength

  const win = windowOf(rows, count, endIdx ?? rows.length - 1);
  const yMax = niceMax(Math.max(maxOf(win.rows.flatMap((r) => [r.inverterKwh, r.cebKwh]), 1) * 1.06, showMark ? threshold * 1.04 : 0));
  const above = aboveSummary(win.rows, threshold);
  const gap = gapSummary(win.rows, bills?.bills ?? []);
  const first = win.rows[0];
  const last = win.rows[win.rows.length - 1];
  const range = first ? `${first.label} ${first.year} to ${last.label} ${last.year}` : '';
  const move = (dir) => setEndIdx(stepEnd(rows, count, win.end, dir));

  return (
    <Glass card className="v3-ceb" aria-label="CEB versus inverter">
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">CEB vs Inverter</h2>
          <div className="v3-sub">Per bill period · kWh</div>
        </div>
        <div className="v3-controls">
          <Segmented small options={STYLES} value={style} onChange={setStyle} label="Chart style" />
          <Segmented small options={COUNTS} value={count} onChange={(v) => { setCount(v); setEndIdx(null); }} label="Periods shown" />
          <div className="v3-stepper">
            <button type="button" className="v3-iconbtn sm" onClick={() => move(-1)} disabled={win.start === 0} aria-label="Earlier periods"><ChevronLeft size={15} /></button>
            <span className="v3-steplabel">{range}</span>
            <button type="button" className="v3-iconbtn sm" onClick={() => move(1)} disabled={win.end >= rows.length - 1} aria-label="Later periods"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {error && <Note tone="bad">Could not load the bill comparison ({error.code ?? 'error'}). Nothing is drawn rather than a made-up zero.</Note>}
      {!error && loading && rows.length === 0 && <div className="v3-skeleton" style={{ height: 250 }} aria-busy="true" aria-label="Loading" />}
      {!error && !loading && rows.length === 0 && <Note>No bills yet. The first bill period will appear here once a CEB bill is approved.</Note>}

      {rows.length > 0 && (
        <>
          <div className="v3-legendrow">
            <div className="v3-legend">
              <span><i style={{ background: 'var(--gen)' }} />Inverter generated</span>
              <span><i style={{ background: 'var(--ceb)' }} />CEB paid for</span>
              <span><i className="v3-hatch" />open period or missing days</span>
              <span><i className="v3-ghost" />bill not issued yet</span>
            </div>
            <div className="v3-markrow">
              <MarkToggle />
              {showMark && <><label className="v3-field-label"><span className="v3-sr">Mark above</span>
                <input className="v3-field" type="number" min="0" step="50" value={threshold} aria-label="Threshold in kWh" onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) setThr(Math.max(0, Math.round(v))); }} style={{ width: 90 }} />
                <span>kWh</span>
              </label>
              <span className="v3-pill" data-tone="gen">{above.known ? `Inverter above: ${above.above} of ${above.known} periods` : 'no data in view'}</span></>}
            </div>
          </div>

          <div className="v3-chartgrid">
            <div className="v3-yaxis" aria-hidden="true">{axisTicks(yMax, (v) => fmtNum(v)).map((t) => <span key={t.pct}>{t.label}</span>)}</div>
            <div className="v3-plotwrap">
              <ThresholdPlot show={showMark} max={yMax} value={threshold} step={10} unit="kWh" height="var(--plot-h, 250px)" onChange={(v) => setThr(v)}>
                {axisTicks(yMax).map((t) => <div key={t.pct} className="v3-gridline" style={{ bottom: `${t.pct}%` }} />)}
                <Columns rows={win.rows} yMax={yMax} threshold={markAt} style={style} />
              </ThresholdPlot>
              <div className="v3-xlabels">
                {win.rows.map((r, i) => {
                  const tag = varianceTag(r);
                  return (
                    <div key={r.id} className="v3-xlabel">
                      <div className="v3-xmain">{r.label}{win.rows.length <= 12 && (i === 0 || r.label === 'Jan') ? ` ${String(r.year).slice(2)}` : ''}</div>
                      <div className="v3-xtag" data-tone={tag.tone}>{tag.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <GapStrip rows={win.rows} summary={gap} />
          <CebTable rows={win.rows} />
        </>
      )}
    </Glass>
  );
}
