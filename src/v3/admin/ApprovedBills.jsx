import { useState } from 'react';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { fmtNum, longDate } from '../overview/format.js';
import { BILL_FIELDS, buildRecordFromRow, describeChanges, impliedRate, recordProblem, rowToDraft, validateBillDraft } from './billForm.js';
import { useAdminApi, useAdminLoad } from './useAdmin.js';
import { PdfModal } from './PdfModal.jsx';

const SHOWN = 8;

function EditRow({ row, onDone, onCancel }) {
  const api = useAdminApi();
  const [draft, setDraft] = useState(() => rowToDraft(row));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const errors = validateBillDraft(draft);
  const changes = describeChanges(row, draft);
  const rate = impliedRate(draft);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.updateRecord(row.id, buildRecordFromRow(draft, row));
      onDone();
    } catch (err) {
      setMsg(recordProblem(err));
      setBusy(false);
    }
  };

  return (
    <tr>
      <td colSpan={6}>
        <div className="v3-chip v3-queueitem">
          <div className="v3-queuehead"><b>Editing the bill ending {longDate(draft.billing_period_end || row.bill_date)}</b></div>
          <div className="v3-billform">
            {BILL_FIELDS.map((f) => (
              <label key={f.key} className="v3-plantfield">
                <span>{f.label}</span>
                <input className="v3-field" type={f.type} step={f.type === 'number' ? 'any' : undefined} value={draft[f.key]} aria-invalid={errors[f.key] ? 'true' : undefined} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                {errors[f.key] && <span className="v3-hint" data-error="true">{errors[f.key]}</span>}
              </label>
            ))}
            <div className="v3-plantfield"><span>Rate this implies</span><div className="v3-num" style={{ height: 34, display: 'flex', alignItems: 'center' }}>{rate === null ? '—' : `LKR ${fmtNum(rate, 2)} / kWh`}</div></div>
          </div>
          {changes.length > 0 && <div className="v3-sub" style={{ margin: 0 }}>Changing: {changes.join(' · ')}</div>}
          {msg && <Note tone="bad">{msg}</Note>}
          <div className="v3-formrow">
            <button type="button" className="v3-btn primary" disabled={busy || changes.length === 0 || Object.keys(errors).length > 0} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="v3-btn" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function DeleteConfirm({ row, onDone, onCancel }) {
  const api = useAdminApi();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const remove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.deleteRecord(row.id);
      onDone();
    } catch (err) {
      setMsg(recordProblem(err));
      setBusy(false);
    }
  };
  return (
    <tr>
      <td colSpan={6}>
        <div className="v3-confirm">
          Permanently delete the bill ending {longDate(row.bill_date)} ({fmtNum(row.units_exported)} kWh, LKR {fmtNum(row.earnings)}) and its PDF? Every figure that uses it will change.
          <button type="button" className="v3-btn" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Yes, delete'}</button>
          <button type="button" className="v3-btn" disabled={busy} onClick={onCancel}>Keep</button>
        </div>
        {msg && <Note tone="bad">{msg}</Note>}
      </td>
    </tr>
  );
}

/** Saved bills, newest first. Edit corrects a bad approval; Delete removes a bill (behind a confirm). */
export function ApprovedBills({ onChanged }) {
  const api = useAdminApi();
  const list = useAdminLoad(() => api.listRecords());
  const [mode, setMode] = useState(null); // { id, kind: 'edit' | 'delete' }
  const [all, setAll] = useState(false);
  const [preview, setPreview] = useState(null); // { filePath, title }
  const records = list.data?.records ?? [];
  const rows = all ? records : records.slice(0, SHOWN);
  const done = () => { setMode(null); list.reload(); onChanged(); };

  return (
    <Glass card aria-label="Approved bills" style={{ gap: 12 }}>
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Approved bills</h2>
          <div className="v3-sub">Latest first · {list.data ? `${rows.length} of ${records.length}` : 'loading'}</div>
        </div>
        {records.length > SHOWN && <button type="button" className="v3-btn" onClick={() => setAll((v) => !v)}>{all ? 'Show latest only' : `Show all ${records.length}`}</button>}
      </div>
      {list.error && <Note tone="bad">Could not load bills ({list.error.code ?? 'error'}).</Note>}
      {list.loading && !list.data && <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" />}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="v3-table">
            <caption className="v3-sr">Approved CEB bills, latest first</caption>
            <thead><tr><th scope="col">Bill date</th><th scope="col">CEB kWh</th><th scope="col">Earnings</th><th scope="col">Rate</th><th scope="col">Status</th><th scope="col"><span className="v3-sr">Actions</span></th></tr></thead>
            <tbody>
              {rows.flatMap((r) => {
                const rate = Number(r.units_exported) > 0 ? Number(r.earnings) / Number(r.units_exported) : null;
                const line = (
                  <tr key={r.id}>
                    <th scope="row">{longDate(r.bill_date)}</th>
                    <td>{fmtNum(r.units_exported)}</td>
                    <td>{r.earnings === null || r.earnings === undefined ? '—' : `LKR ${fmtNum(r.earnings)}`}</td>
                    <td>{rate === null ? '—' : fmtNum(rate, 2)}</td>
                    <td><Pill tone="good">Approved</Pill></td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button type="button" className="v3-btn" style={{ height: 28, fontSize: 12 }} disabled={!r.file_path} title={r.file_path ? undefined : 'No PDF stored for this bill'} onClick={() => setPreview({ filePath: r.file_path, title: `Bill ending ${longDate(r.bill_date)}` })}>View</button>{' '}
                      <button type="button" className="v3-btn" style={{ height: 28, fontSize: 12 }} onClick={() => setMode({ id: r.id, kind: 'edit' })}>Edit</button>{' '}
                      <button type="button" className="v3-btn" style={{ height: 28, fontSize: 12 }} onClick={() => setMode({ id: r.id, kind: 'delete' })}>Delete</button>
                    </td>
                  </tr>
                );
                if (mode?.id !== r.id) return [line];
                return [line, mode.kind === 'edit'
                  ? <EditRow key={`${r.id}-e`} row={r} onDone={done} onCancel={() => setMode(null)} />
                  : <DeleteConfirm key={`${r.id}-d`} row={r} onDone={done} onCancel={() => setMode(null)} />];
              })}
            </tbody>
          </table>
        </div>
      )}
      {preview && <PdfModal filePath={preview.filePath} title={preview.title} onClose={() => setPreview(null)} />}
    </Glass>
  );
}
