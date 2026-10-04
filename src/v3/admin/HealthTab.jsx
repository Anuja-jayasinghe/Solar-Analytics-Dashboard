import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Note } from '../ui/Note.jsx';
import { useResource } from '../data/context.js';
import { MAINTENANCE, freshnessItems, workflowUrl } from './health.js';

const TONE = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', neutral: 'var(--ink2)' };

/** Is data arriving? Derived from the read API only. Maintenance opens the matching GitHub workflow (dry run first). */
export function HealthTab() {
  const live = useResource('live');
  const totals = useResource('totals');
  const items = freshnessItems({ totals: totals.data, todayKey: live.data?.todayKey ?? null });
  const loading = (totals.loading || live.loading) && !totals.data;
  return (
    <section className="v3-twocol">
      <Glass card aria-label="Data freshness" style={{ gap: 12 }}>
        <div>
          <h2 className="v3-h2">Is data arriving?</h2>
          <div className="v3-sub">From the daily totals and the bills already in the system</div>
        </div>
        {(totals.error || live.error) && <Note tone="bad">Could not read the data status ({(totals.error ?? live.error).code ?? 'error'}).</Note>}
        {loading ? <div className="v3-skeleton" style={{ height: 100 }} aria-busy="true" aria-label="Loading" /> : (
          <div className="v3-healthlist">
            {items.map((i) => (
              <Tip key={i.label} text={i.tip}>
                <div className="v3-healthrow">
                  <span className="v3-mut">{i.label}</span>
                  <b style={{ color: TONE[i.tone] }}>{i.value}</b>
                </div>
              </Tip>
            ))}
          </div>
        )}
        <div className="v3-sub" style={{ margin: 0 }}>The nightly collector's own run log is not shown here yet; if data stops, the daily freshness check opens an issue on GitHub by itself.</div>
      </Glass>

      <Glass card aria-label="Maintenance" style={{ gap: 12 }}>
        <div>
          <h2 className="v3-h2">Maintenance</h2>
          <div className="v3-sub">Always a dry run first; take a snapshot before anything that writes</div>
        </div>
        <div className="v3-maint">
          {MAINTENANCE.map((m) => (
            <div key={m.id} className="v3-maintrow">
              <div><b>{m.label}</b><div className="v3-sub" style={{ marginTop: 2 }}>{m.note}</div></div>
              <a className="v3-btn" href={workflowUrl(m.id)} target="_blank" rel="noopener noreferrer">Open in GitHub</a>
            </div>
          ))}
        </div>
        <Note>These open the workflow on GitHub. Nothing here changes data by itself.</Note>
      </Glass>
    </section>
  );
}
