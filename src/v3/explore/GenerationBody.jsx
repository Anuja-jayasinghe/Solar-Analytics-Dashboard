import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tip } from '../ui/Tip.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { Note } from '../ui/Note.jsx';
import { ThresholdPlot } from '../charts/ThresholdPlot.jsx';
import { areaPath, axisTicks, linePath, maxOf, niceMax, xPct, yPct } from '../charts/scale.js';
import { fmtNum } from '../overview/format.js';
import { aboveCount, dayLabelYear } from './series.js';

const KINDS = [{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'custom', label: 'Custom' }];
const STYLES = [{ value: 'area', label: 'Area' }, { value: 'line', label: 'Line' }, { value: 'bars', label: 'Bars' }];

function pointTip(p, line, grouped) {
  if (p.kwh === null) return `${p.full}: no data recorded`;
  return `${p.full}: ${fmtNum(p.kwh, grouped ? 0 : 1)} kWh${p.kwh > line ? ' · above the line' : ''}`;
}

/** "Inverter generation": a range of days (or months), area by default, with the draggable "Mark above" line. */
export function GenerationBody({ showHead, kind, onKind, style, onStyle, range, bounds, canBack, canForward, onStep, onCustom, points, grouped, line, onLine, loading, error }) {
  const known = points.filter((p) => p.kwh !== null);
  const yMax = niceMax(Math.max(maxOf(points.map((p) => p.kwh), 1) * 1.1, line * 1.04));
  const n = points.length;
  const above = aboveCount(points, line);
  const unit = grouped ? 'kWh/month' : 'kWh/day';
  const linePts = points.map((p, i) => (p.kwh === null ? null : [xPct(i, n), yPct(p.kwh, yMax)]));
  const dense = n > 30;

  return (
    <>
      <div className="v3-tilehead">
        {showHead ? (
          <div>
            <h2 className="v3-h2">Inverter generation</h2>
            <div className="v3-sub">{grouped ? 'Monthly totals' : 'Daily'} · inverter only</div>
          </div>
        ) : null}
        <div className="v3-controls">
          <Segmented small options={KINDS} value={kind} onChange={onKind} label="Range" />
          <Segmented small options={STYLES} value={style} onChange={onStyle} label="Chart style" />
          <div className="v3-stepper">
            <button type="button" className="v3-iconbtn sm" onClick={() => onStep(-1)} disabled={!canBack} aria-label="Earlier"><ChevronLeft size={15} /></button>
            <span className="v3-steplabel">{range ? `${dayLabelYear(range.from)} to ${dayLabelYear(range.to)}` : ''}</span>
            <button type="button" className="v3-iconbtn sm" onClick={() => onStep(1)} disabled={!canForward} aria-label="Later"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      <div className="v3-markrow v3-markrow-wide">
        {kind === 'custom' && range && (
          <div className="v3-daterow">
            <label className="v3-field-label">From <input className="v3-field" type="date" value={range.from} min={bounds.min ?? undefined} max={bounds.max ?? undefined} onChange={(e) => e.target.value && onCustom(e.target.value, range.to)} /></label>
            <label className="v3-field-label">To <input className="v3-field" type="date" value={range.to} min={bounds.min ?? undefined} max={bounds.max ?? undefined} onChange={(e) => e.target.value && onCustom(range.from, e.target.value)} /></label>
          </div>
        )}
        <label className="v3-field-label" style={{ marginLeft: 'auto' }}>Mark above
          <input className="v3-field" type="number" min="0" step="1" value={line} aria-label={`Threshold in ${unit}`} onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onLine(Math.max(0, Math.round(v))); }} style={{ width: 90 }} />
          <span>{unit}</span>
        </label>
        <span className="v3-pill" data-tone="gen">{above.known ? `${above.above} of ${above.known} ${grouped ? 'months' : 'days'} above` : 'no data in range'}</span>
      </div>

      {error && <Note tone="bad">Could not load this range ({error.code ?? 'error'}). Nothing is drawn rather than a made-up zero.</Note>}
      {!error && loading && known.length === 0 && <div className="v3-skeleton" style={{ height: 240 }} aria-busy="true" aria-label="Loading" />}
      {!error && !loading && n > 0 && known.length === 0 && <Note>No generation was recorded in this range.</Note>}

      {n > 0 && known.length > 0 && (
        <div className="v3-chartgrid">
          <div className="v3-yaxis" aria-hidden="true">{axisTicks(yMax, (v) => fmtNum(v)).map((t) => <span key={t.pct}>{t.label}</span>)}</div>
          <div className="v3-plotwrap">
            <ThresholdPlot max={yMax} value={line} step={grouped ? 50 : 1} unit={unit} height="var(--plot-h)" onChange={onLine}>
              {axisTicks(yMax).map((t) => <div key={t.pct} className="v3-gridline" style={{ bottom: `${t.pct}%` }} />)}
              {style !== 'bars' && (
                <svg className="v3-plot-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {style === 'area' && <path d={areaPath(linePts)} fill="url(#areaFill)" />}
                  <path d={linePath(linePts)} fill="none" style={{ stroke: 'var(--gen)' }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              )}
              <div className="v3-cols" style={{ gap: dense ? 1 : undefined }}>
                {points.map((p) => {
                  const hi = p.kwh !== null && p.kwh > line;
                  const partial = p.present > 0 && p.present < p.total; // a month with some days missing: drawn hatched/hollow, never as a full month
                  const pct = p.kwh === null ? 0 : (p.kwh / yMax) * 100;
                  return (
                    <Tip key={p.key} text={pointTip(p, line, grouped)}>
                      <div className="v3-col" style={dense ? { padding: '0 1%' } : undefined}>
                        {style === 'bars' ? (
                          p.kwh === null ? <div className="v3-bar single" style={{ height: 3, background: 'var(--nodata)' }} /> : <div className="v3-bar single" style={{ height: `${pct}%`, background: partial ? 'repeating-linear-gradient(135deg, var(--gen) 0 5px, var(--gen-a30) 5px 9px)' : hi ? 'var(--gen)' : 'var(--gen-a34)', border: partial ? '1px solid var(--gen)' : undefined }} />
                        ) : (
                          p.kwh !== null && <span className="v3-dot" style={{ bottom: `${pct}%`, background: partial ? 'var(--bg)' : hi ? 'var(--gen)' : 'var(--ink2)', borderColor: partial ? 'var(--gen)' : undefined, width: hi ? 9 : 6, height: hi ? 9 : 6 }} />
                        )}
                      </div>
                    </Tip>
                  );
                })}
              </div>
            </ThresholdPlot>
            <div className="v3-xlabels" style={{ gap: dense ? 1 : undefined }}>
              {points.map((p) => <div key={p.key} className="v3-xlabel v3-xplain">{p.label}</div>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
