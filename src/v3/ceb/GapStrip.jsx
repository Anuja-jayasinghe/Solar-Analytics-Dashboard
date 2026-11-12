import { Tip } from '../ui/Tip.jsx';
import { Info } from '../ui/Info.jsx';
import { GAP_MATCH_PCT, gapCell, gapCounts, gapSentence } from './rows.js';

const MARK = { matched: '✓', less: '▼', more: '▲' };

/**
 * The money gap (LR-004), one cell per bill month, under the chart's columns: did CEB pay for what the inverter
 * made? ✓ even (within GAP_MATCH_PCT), ▼ paid less, ▲ paid more, with the rupees. A dash = not comparable.
 */
export function GapStrip({ rows }) {
  const counts = gapCounts(rows);
  return (
    <div className="v3-gap" aria-label="Money gap, per bill">
      <div className="v3-gap-head">
        <h3 className="v3-gap-title">
          Money gap: did CEB pay for what the inverter made?
          <Info label="How the money gap is worked out" title="Each bill at its own rate" text={`(CEB kWh − inverter kWh) × that bill's LKR per kWh. Within ${GAP_MATCH_PCT}% counts as even: separate meters and reading days make small differences normal. Bills with missing days or no rate are not compared, never counted as zero.`} />
        </h3>
        <div className="v3-sub">{gapSentence(counts, rows.length)}</div>
      </div>
      <div className="v3-chartgrid">
        <div className="v3-gap-axis" aria-hidden="true">LKR</div>
        <div className="v3-gap-row">
          {rows.map((r) => {
            const c = gapCell(r);
            return (
              <Tip key={r.id} text={c.title} className="v3-gap-tip">
                <div className="v3-gapcell" data-state={c.state}>
                  {MARK[c.state] && <i aria-hidden="true">{MARK[c.state]}</i>}
                  <span aria-hidden="true">{c.text}</span>
                  <span className="v3-sr">{c.title.replace('\n', ': ')}</span>
                </div>
              </Tip>
            );
          })}
        </div>
      </div>
      <div className="v3-gap-key" aria-hidden="true"><span>✓ even (within {GAP_MATCH_PCT}%)</span><span>▼ CEB paid less</span><span>▲ CEB paid more</span></div>
    </div>
  );
}
