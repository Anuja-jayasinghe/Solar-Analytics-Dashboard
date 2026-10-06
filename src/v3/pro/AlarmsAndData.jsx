import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { fmtNum } from '../overview/format.js';
import { alarmLegend, alarmRows, minutesLabel } from './metrics.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const localWhen = (ts) => {
  const d = new Date(Date.parse(ts) + 330 * 60000);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

export function AlarmTable({ alarms, loading, error }) {
  const rows = alarmRows(alarms, 8);
  const legend = alarmLegend(alarms);
  return (
    <Glass card aria-label="Alarm history" style={{ gap: 12 }}>
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Alarm history</h2>
          <div className="v3-sub">Latest 8 shown · selected uptime/alarm period · Colombo time</div>
        </div>
        {alarms && <Pill>{alarms.alarms.length} in range{alarms.truncated ? '+' : ''}</Pill>}
      </div>
      {error && <Note tone="bad">Could not load alarms ({error.code ?? 'error'}).</Note>}
      {alarms?.truncated && <Note>The alarm list reached the API limit. The guide counts only the returned records; the unresolved count is unknown.</Note>}
      {loading && !alarms && <div className="v3-skeleton" style={{ height: 160 }} aria-busy="true" aria-label="Loading" />}
      {alarms && rows.length === 0 && <Note>No alarms in this range.</Note>}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="v3-table">
            <caption className="v3-sr">Inverter alarms, latest first</caption>
            <thead><tr><th scope="col">When</th><th scope="col">Code</th><th scope="col">What</th><th scope="col">Length</th><th scope="col">Level</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ whiteSpace: 'nowrap' }}>{localWhen(r.beginTs)}</td>
                  <td className="v3-num" style={{ fontSize: 12 }}>{r.code}</td>
                  <td><strong>{r.meaning}</strong>{r.message !== r.meaning && <div className="v3-sub">Solis: {r.message}</div>}{r.advice && <Tip text={r.advice}><span className="v3-sub">Advice from Solis ⓘ</span></Tip>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.length}</td>
                  <td><Pill tone={r.tone === 'neutral' ? undefined : r.tone}>{r.level}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {legend.length > 0 && (
        <details>
          <summary>Alarm code guide for this period</summary>
          <dl style={{ marginBottom: 0 }}>
            {legend.map((item) => <div key={item.code} style={{ marginTop: 10 }}><dt><strong>{item.code} · {item.meaning}</strong> ({item.count})</dt><dd style={{ marginLeft: 0 }}>{item.explanation}</dd></div>)}
          </dl>
          <div className="v3-sub">Definitions: <a href="https://usservice.solisinverters.com/support/solutions/articles/73000560423-solis-inverter-alarm-codes-complete-list-" target="_blank" rel="noreferrer">Solis alarm reference</a>. Codes without a verified mapping retain their Solis message.</div>
        </details>
      )}
    </Glass>
  );
}

function Bar({ label, value, pct, color, tip }) {
  return (
    <Tip text={tip}>
      <div className="v3-bartrack">
        <div className="v3-barhead"><span>{label}</span><b>{value}</b></div>
        <div className="v3-barbg"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>
      </div>
    </Tip>
  );
}

/** "Can we trust the numbers?": completeness, logger connection, and whether alarms were known for each day. */
export function DataAndLogger({ summary: s, uptime, loading }) {
  const days = uptime?.days ?? [];
  const commsMin = days.reduce((a, d) => a + (Number(d.comms_lost_min) || 0), 0);
  const alarmsKnown = days.filter((d) => d.alarms_known).length;
  const loggerKnown = days.filter((d) => d.logger_known).length;
  const windowMin = days.reduce((a, d) => a + (Number(d.window_minutes) || 0), 0);
  return (
    <Glass card aria-label="Data and logger" style={{ gap: 14 }}>
      <div>
        <h2 className="v3-h2">Data and logger</h2>
        <div className="v3-sub">Can we trust the numbers?</div>
      </div>
      {loading && !uptime ? <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" /> : (
        <>
          <Bar label="Days with a collected reading · all-time" value={s.completenessPct === null ? '—' : `${fmtNum(s.completenessPct, 1)}%`} pct={s.completenessPct ?? 0} color="var(--good)" tip={s.dataDays === null ? 'Not known yet.' : `${fmtNum(s.dataDays)} of ${fmtNum(s.spanDays)} days since the first reading.`} />
          <Bar label={`Logger connection · ${days.length} days`} value={days.length ? (commsMin ? `${minutesLabel(commsMin)} offline` : 'no gaps') : '—'} pct={windowMin ? 100 - (commsMin / windowMin) * 100 : 0} color={commsMin ? 'var(--warn)' : 'var(--good)'} tip="Minutes the data logger lost its internet link inside daylight windows. Counted as a data gap, not as inverter downtime." />
          <Bar label="Days with alarms known" value={days.length ? `${alarmsKnown} of ${days.length}` : '—'} pct={days.length ? (alarmsKnown / days.length) * 100 : 0} color="var(--good)" tip="Uptime is only trusted when the alarm log for that day was readable." />
          <Bar label="Days with logger status known" value={days.length ? `${loggerKnown} of ${days.length}` : '—'} pct={days.length ? (loggerKnown / days.length) * 100 : 0} color="var(--good)" tip="Distinguishes the logger being offline from the inverter being stopped." />
        </>
      )}
    </Glass>
  );
}
