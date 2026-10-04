import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Note } from '../ui/Note.jsx';
import { longDate } from '../overview/format.js';
import { stripCell, stripTip } from './metrics.js';

const TONE = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', none: 'var(--nodata)' };
const LEGEND = [['good', '99%+'], ['warn', '95 to 99%'], ['bad', 'under 95%'], ['none', 'no data']];

/** One cell per day: height and colour show the uptime of that day's daylight window. */
export function UptimeStrip({ days, loading, error }) {
  const cells = (days ?? []).map(stripCell);
  return (
    <Glass card aria-label="Uptime by day">
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Uptime by day</h2>
          <div className="v3-sub">Share of the daylight window the inverter was running · hover or tap a day</div>
        </div>
        <div className="v3-legend">
          {LEGEND.map(([tone, label]) => <span key={tone}><i style={{ background: TONE[tone] }} />{label}</span>)}
        </div>
      </div>
      {error && <Note tone="bad">Could not load uptime ({error.code ?? 'error'}).</Note>}
      {loading && cells.length === 0 && <div className="v3-skeleton" style={{ height: 92 }} aria-busy="true" aria-label="Loading" />}
      {cells.length > 0 && (
        <>
          <div className="v3-strip">
            {cells.map((c) => (
              <Tip key={c.key} text={stripTip(c)}>
                <div className="v3-stripcell" style={{ height: `${c.height}%`, background: TONE[c.tone] }} />
              </Tip>
            ))}
          </div>
          <div className="v3-strip-ends"><span>{longDate(cells[0].key)}</span><span>{longDate(cells[cells.length - 1].key)}</span></div>
        </>
      )}
      {!loading && !error && cells.length === 0 && <Note>No uptime has been derived for these days yet.</Note>}
    </Glass>
  );
}
