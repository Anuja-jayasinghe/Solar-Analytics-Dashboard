import { Glass } from '../ui/Glass.jsx';
import { Info } from '../ui/Info.jsx';
import { Note } from '../ui/Note.jsx';
import { useResource } from '../data/context.js';
import { MAINTENANCE, alertItems, errorItems, freshnessItems, runItems, sectionProblem, workflowUrl } from './health.js';
import { useAdminApi, useAdminLoad } from './useAdmin.js';

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
              <div key={i.label} className="v3-healthrow">
                <span className="v3-mut">{i.label}{(i.tone === 'warn' || i.tone === 'bad') && i.tip && <Info label={`About ${i.label.toLowerCase()}`} text={i.tip} />}</span>
                <b style={{ color: TONE[i.tone] }}>{i.value}</b>
              </div>
            ))}
          </div>
        )}
      </Glass>

      <Monitoring />

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

function Rows({ items, empty }) {
  if (!items.length) return <div className="v3-sub" style={{ margin: 0 }}>{empty}</div>;
  return (
    <div className="v3-healthlist">
      {items.map((i) => (
        <div key={i.key} className="v3-healthrow">
          <span className="v3-mut">{i.label}{i.tip && <Info label={`About ${i.label}`} text={i.tip} />}</span>
          <b style={{ color: TONE[i.tone] }}>{i.value}</b>
        </div>
      ))}
    </div>
  );
}

function Section({ title, section, items, empty }) {
  const problem = sectionProblem(section);
  return (
    <div>
      <h3 className="v3-sub" style={{ margin: '0 0 4px' }}><b>{title}</b></h3>
      {problem ? <Note>{problem}</Note> : <Rows items={items} empty={empty} />}
    </div>
  );
}

/** Collector runs, open alerts and recent errors (issue #241), from GET /api/ops/status. Admin only. */
function Monitoring() {
  const api = useAdminApi();
  const { data, error, loading } = useAdminLoad(api.opsStatus);
  return (
    <Glass card aria-label="Monitoring" style={{ gap: 12 }}>
      <div>
        <h2 className="v3-h2">Monitoring</h2>
        <div className="v3-sub">Alerts are emailed as they open; this is the same picture on demand</div>
      </div>
      {error && <Note tone="bad">Could not read the monitoring status ({error.code ?? 'error'}).</Note>}
      {loading && !data ? <div className="v3-skeleton" style={{ height: 100 }} aria-busy="true" aria-label="Loading" /> : data && (
        <>
          <Section title="Open alerts" section={data.alerts} items={alertItems(data.alerts?.rows ?? [])} empty="None. Everything the watchdog checks is fine." />
          <Section title="Collector runs" section={data.runs} items={runItems(data.runs?.rows ?? [])} empty="No runs recorded in the log yet." />
          <Section title="Recent errors" section={data.errors} items={errorItems(data.errors?.rows ?? [])} empty="No errors recorded in the past 30 days." />
        </>
      )}
    </Glass>
  );
}
