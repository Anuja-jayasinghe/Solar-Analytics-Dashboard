import { useResource } from '../data/context.js';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';

const kw = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 })} kW`);
const kwh = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh`);

/**
 * FOUNDATION PLACEHOLDER. The real Overview arrives in the overview-live, ceb-compare, generation and
 * overview-phone slices (docs/V3_REFACTOR_PLAN.md, P5b). This page exists to prove the pipeline end to
 * end: access level -> data source (demo or live) -> /api/data/live -> render, with unknown shown as "—".
 */
export default function OverviewPage() {
  const { data, error, loading, mode } = useResource('live', {}, { pollMs: 60_000 });
  return (
    <>
      <Glass card>
        <div>
          <h2 className="v3-h2">Live status</h2>
          <div className="v3-sub">Foundation check · reading from the {mode === 'live' ? 'real API' : 'demo data'}</div>
        </div>
        {loading && !data && <div className="v3-skeleton" style={{ height: 56 }} aria-busy="true" aria-label="Loading" />}
        {error && <Note tone="bad">Could not load live status ({error.code ?? 'error'}). Nothing is shown rather than a made-up zero.</Note>}
        {data && (
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pill tone={data.status === 'online' ? 'good' : 'warn'}>{data.status ?? 'unknown'}</Pill>
            <div><div className="v3-mut" style={{ fontSize: 12 }}>Now</div><div className="v3-num" style={{ fontSize: 26 }}>{kw(data.currentPowerKw)}</div></div>
            <div><div className="v3-mut" style={{ fontSize: 12 }}>Today</div><div className="v3-num" style={{ fontSize: 26 }}>{kwh(data.todayKwh)}</div></div>
          </div>
        )}
      </Glass>
      <Note>The full Overview is being built slice by slice against the signed-off design (docs/design/v3).</Note>
    </>
  );
}
