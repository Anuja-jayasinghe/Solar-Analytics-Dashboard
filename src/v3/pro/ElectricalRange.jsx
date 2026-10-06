import { Glass } from '../ui/Glass.jsx';
import { Note } from '../ui/Note.jsx';
import { Pill } from '../ui/Pill.jsx';
import { fmtNum, longDate } from '../overview/format.js';

const display = (value, digits = 1) => value === null || value === undefined ? '—' : fmtNum(value, digits);

/** Compact daily summaries; no raw telemetry or physical string mapping is sent to the browser. */
export function ElectricalRange({ data, loading, error }) {
  const summary = data?.summary ?? null;
  const maxA = summary ? Math.max(...summary.pvInputs.map((p) => p.amps ?? 0), 0.0001) : 1;
  return (
    <Glass card aria-label="Electrical health over selected days">
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Electrical health</h2>
          <div className="v3-sub">{data ? `${longDate(data.from)} to ${longDate(data.to)}` : 'Selected completed days'} · samples above 1 kW</div>
        </div>
        {summary && <Pill>{summary.daysWithTelemetry}/{summary.daysRequested} days with telemetry</Pill>}
      </div>
      {error && <Note tone="bad">Could not load electrical history ({error.code ?? 'error'}).</Note>}
      {loading && !data && <div className="v3-skeleton" style={{ height: 170 }} aria-busy="true" aria-label="Loading" />}
      {summary && summary.producingSamples === 0 && <Note>No producing telemetry was stored for this range. Missing days are unknown, not zero-current days.</Note>}
      {summary && summary.producingSamples > 0 && (
        <>
          <div className="v3-sub">{summary.daysProducing} days with producing readings · {summary.producingSamples} producing readings · AC V1/V2/V3 median {summary.acPhaseVolts.map((v) => display(v)).join(' / ')} V · median phase spread {display(summary.acPhaseSpreadVolts)} V · mean power factor {display(summary.powerFactor, 2)}</div>
          <div className="v3-elec-col">
            <div className="v3-elec-title">PV inputs <span>· mean current across producing readings</span></div>
            {summary.pvInputs.map((input) => <div className="v3-strrow" key={input.n} aria-label={`PV${input.n}: ${display(input.amps)} A, ${display(input.volts)} V`}>
              <span>PV{input.n}</span>
              <div className="v3-barbg"><div style={{ width: `${(input.amps ?? 0) / maxA * 100}%`, background: 'var(--gen)' }} /></div>
              <b className="v3-num">{display(input.amps)} A <small>· {display(input.volts)} V</small></b>
            </div>)}
          </div>
          <div className="v3-sub">Inputs may be unused. These current readings cannot diagnose a string fault without the physical wiring map.</div>
        </>
      )}
      {data && <div style={{ overflowX: 'auto', maxHeight: 440 }}>
        <table className="v3-table">
          <caption className="v3-sr">Daily inverter electrical readings and coverage</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Producing samples</th><th scope="col">PV input, A / V</th><th scope="col">AC V1/V2/V3, V</th><th scope="col">Phase spread, V</th><th scope="col">Max temp, °C</th><th scope="col">Frequency, Hz</th><th scope="col">Power factor</th></tr></thead>
          <tbody>{data.days.map((day) => <tr key={day.date}>
            <th scope="row" style={{ whiteSpace: 'nowrap' }}>{longDate(day.date)}</th>
            <td>{day.samples === 0 ? 'No telemetry' : day.producingSamples === 0 ? 'No producing readings' : `${day.producingSamples} of ${day.samples}`}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{day.producingSamples ? day.pvInputs.map((p) => `PV${p.n} ${display(p.amps)} / ${display(p.volts)}`).join(' · ') : '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{day.acPhaseVolts.map((v) => display(v)).join(' / ')}</td>
            <td>{display(day.acPhaseSpreadVolts)}</td>
            <td>{display(day.temperatureMaxC)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{day.frequencyLoHz === null ? '—' : `${display(day.frequencyLoHz, 2)}–${display(day.frequencyHiHz, 2)}`}</td>
            <td>{display(day.powerFactor, 2)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </Glass>
  );
}
