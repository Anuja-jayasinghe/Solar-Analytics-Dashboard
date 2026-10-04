import { Tip } from '../ui/Tip.jsx';
import { DASH, lkrCompact, longDate } from '../overview/format.js';
import { gapLabel, gapTip } from './rows.js';

const signed = (v) => (v === null ? DASH : `${v < 0 ? '−' : '+'} ${lkrCompact(Math.abs(v)).value}${lkrCompact(Math.abs(v)).unit ? ` ${lkrCompact(Math.abs(v)).unit}` : ''}`);

/**
 * The money gap (LR-004): CEB paid minus what the inverter's generation was worth, at each bill's own rate.
 * Below the line = CEB paid less than the inverter generated. A dash = the period could not be compared.
 */
export function GapStrip({ rows, summary }) {
  let maxAbs = 1;
  for (const r of rows) if (r.gapLkr !== null) maxAbs = Math.max(maxAbs, Math.abs(r.gapLkr));
  const a = summary.all;
  const negative = (summary.windowLkr ?? 0) < 0;

  return (
    <div className="v3-gap" aria-label="Money gap">
      <div className="v3-gap-head">
        <Tip text="For each complete bill: (CEB kWh − inverter kWh) × that bill's own LKR per kWh, i.e. what CEB paid minus what the generation was worth. Minus means CEB paid less than the inverter generated. Bills with missing days or no rate are left out, never counted as zero.">
          <div>
            <h3 className="v3-gap-title">Money gap: CEB paid minus what the inverter generated was worth</h3>
            <div className="v3-num v3-gap-value" style={{ color: summary.windowLkr === null ? 'var(--ink2)' : negative ? 'var(--warn)' : 'var(--good)' }}>{signed(summary.windowLkr)}</div>
            <div className="v3-sub" style={{ marginTop: 2 }}>
              {summary.windowCompared ? `in view · ${summary.windowCompared} of ${summary.windowTotal} compared · each bill at its own rate` : 'no comparable bill in view'}
            </div>
          </div>
        </Tip>
        <div className="v3-gap-chips">
          <div className="v3-chip v3-gapchip"><div>Generation worth (all compared bills)</div><b className="v3-num">{a.valueLkr === null ? DASH : `${lkrCompact(a.valueLkr).value} ${lkrCompact(a.valueLkr).unit}`}</b></div>
          <div className="v3-chip v3-gapchip"><div>CEB actually paid</div><b className="v3-num">{a.paidLkr === null ? DASH : `${lkrCompact(a.paidLkr).value} ${lkrCompact(a.paidLkr).unit}`}</b></div>
          <Tip text={a.periods ? `Over ${a.periods} complete bills (${longDate(a.from)} to ${longDate(a.to)}), ${a.differencePct === null ? '' : `${Math.abs(a.differencePct).toFixed(1)}% ${a.differencePct < 0 ? 'less' : 'more'} than the generation was worth. `}${a.excluded} bill${a.excluded === 1 ? '' : 's'} left out for missing days or no rate.` : 'No bill can be compared yet.'}>
            <div className="v3-chip v3-gapchip"><div>All-time gap</div><b className="v3-num" style={{ color: a.differenceLkr === null ? undefined : a.differenceLkr < 0 ? 'var(--warn)' : 'var(--good)' }}>{signed(a.differenceLkr)}</b></div>
          </Tip>
        </div>
      </div>

      <div className="v3-gap-allphone">All-time {signed(a.differenceLkr)} over {a.periods} bills · each at its own rate · a dash = days missing</div>
      <div className="v3-chartgrid">
        <div className="v3-gap-axis" aria-hidden="true"><span style={{ color: "var(--good)" }}>paid more</span><span>0</span><span style={{ color: "var(--warn)" }}>paid less</span></div>
        <div className="v3-plotwrap">
          <div className="v3-gap-plot">
            <div className="v3-gap-zero" />
            <div className="v3-cols">
              {rows.map((r) => {
                const h = r.gapLkr === null ? 0 : Math.max(3, (Math.abs(r.gapLkr) / maxAbs) * 46);
                return (
                  <Tip key={r.id} value={r.gapLkr === null ? `${r.label} ${r.year} · not compared` : `${r.label} ${r.year} · ${gapLabel(r.gapLkr)} LKR`} text={gapTip(r)}>
                    <div className="v3-col v3-gapcol">
                      {r.gapLkr !== null && <div className="v3-gapbar" style={r.gapLkr >= 0 ? { bottom: '50%', height: `${h}%`, background: 'var(--good)' } : { top: '50%', height: `${h}%`, background: 'var(--warn)' }} />}
                      {r.gapLkr === null && r.status !== 'provisional' && <span className="v3-gapdash">–</span>}
                    </div>
                  </Tip>
                );
              })}
            </div>
          </div>
          <div className="v3-xlabels">
            {rows.map((r) => (
              <div key={r.id} className="v3-xlabel">
                <div className="v3-num v3-gapamt" style={{ color: r.gapLkr === null ? 'var(--ink2)' : r.gapLkr < 0 ? 'var(--warn)' : 'var(--good)' }}>{gapLabel(r.gapLkr)}</div>
                <div className="v3-xtag" data-tone="muted">{r.label}</div>
              </div>
            ))}
          </div>
          <div className="v3-sub v3-gap-note">LKR thousands per bill period · a dash means the period could not be compared (missing days)</div>
        </div>
      </div>
    </div>
  );
}
