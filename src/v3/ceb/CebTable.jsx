import { DASH, fmtNum } from '../overview/format.js';
import { varianceTag } from './rows.js';

/** The same numbers as the chart, as a table (for screen readers, keyboard users and anyone who wants exact figures). */
export function CebTable({ rows }) {
  return (
    <details className="v3-details">
      <summary>Show as a table</summary>
      <div style={{ overflowX: 'auto' }}>
        <table className="v3-table">
          <caption className="v3-sr">CEB versus inverter, per bill period</caption>
          <thead>
            <tr><th scope="col">Period</th><th scope="col">Inverter kWh</th><th scope="col">CEB kWh</th><th scope="col">Variance</th><th scope="col">Money gap (LKR)</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.label} {r.year}{r.status === 'provisional' ? ' (open)' : ''}</th>
                <td>{fmtNum(r.inverterKwh)}</td>
                <td>{r.status === 'provisional' ? 'awaiting bill' : fmtNum(r.cebKwh)}</td>
                <td>{varianceTag(r).text || DASH}</td>
                <td>{r.gapLkr === null ? DASH : fmtNum(r.gapLkr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
