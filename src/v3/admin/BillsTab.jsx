import { useRef, useState } from 'react';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { useResource } from '../data/context.js';
import { fmtNum, longDate } from '../overview/format.js';
import { BILL_FIELDS, buildRecord, impliedRate, queueItems, toBillDraft, uploadProblem, validateBillDraft } from './billForm.js';
import { ApprovedBills } from './ApprovedBills.jsx';
import { useAdminApi, useAdminLoad } from './useAdmin.js';

function UploadCard({ onUploaded }) {
  const api = useAdminApi();
  const input = useRef(null);
  const [state, setState] = useState({ status: 'idle', message: '' });

  const upload = async (file) => {
    if (!file) return;
    setState({ status: 'working', message: `Uploading ${file.name}…` });
    let up = null;
    try {
      up = await api.uploadBill(file);
    } catch (err) {
      setState({ status: 'error', message: uploadProblem(err) });
    }
    if (up) {
      setState({ status: 'working', message: 'Reading the bill…' });
      try {
        await api.extract(up.ingestionId);
        setState({ status: 'done', message: 'Uploaded and read. Check the figures below, then approve.' });
      } catch {
        // The file is stored; only the reading failed. It sits in the queue below to retry or discard.
        setState({ status: 'error', message: 'Uploaded, but the file could not be read as a CEB bill. Try reading it again or discard it below.' });
      }
    }
    onUploaded();
    if (input.current) input.current.value = '';
  };

  return (
    <Glass card aria-label="Upload a CEB bill" style={{ gap: 14 }}>
      <div>
        <h2 className="v3-h2">Upload a CEB bill</h2>
        <div className="v3-sub">PDF, then a duplicate check, then read by the extractor, then you confirm</div>
      </div>
      <label className="v3-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}>
        <span aria-hidden="true" style={{ fontSize: 26, color: 'var(--gen)' }}>↑</span>
        <span>Drop a bill PDF here or <b style={{ color: 'var(--gen)' }}>browse</b></span>
        <input ref={input} className="v3-sr" type="file" accept="application/pdf" disabled={state.status === 'working'} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {state.message && <Note tone={state.status === 'error' ? 'bad' : undefined}>{state.message}</Note>}
    </Glass>
  );
}

function QueueItem({ item, onDone }) {
  const api = useAdminApi();
  const [draft, setDraft] = useState(() => toBillDraft(item.extraction));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState(null);
  const errors = validateBillDraft(draft);
  const rate = impliedRate(draft);
  const e = item.extraction;
  const filePath = e?.ceb_bill_ingestions?.file_path ?? item.filePath ?? null;

  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (err) { setMsg(err?.message || 'That did not work.'); }
    setBusy(false);
  };
  const approve = () => run(async () => {
    await api.approve({ extractionId: item.id, ingestionId: item.ingestionId, record: buildRecord(draft, e) });
    onDone(true);
  });
  const discard = () => run(async () => { await api.discard(item.ingestionId); onDone(false); });
  const retry = () => run(async () => { await api.extract(item.ingestionId); onDone(false); });
  const openPdf = () => run(async () => { const { signedUrl } = await api.signedUrl(filePath); window.open(signedUrl, '_blank', 'noopener'); });

  return (
    <div className="v3-chip v3-queueitem">
      <div className="v3-queuehead">
        <b>{item.kind === 'failed' ? 'Upload could not be read' : `Bill ending ${longDate(draft.billing_period_end)}`}</b>
        <Pill tone={item.status === 'auto_approved' ? 'good' : 'warn'}>{item.status.replace(/_/g, ' ')}</Pill>
        {filePath && <button type="button" className="v3-btn" disabled={busy} onClick={openPdf}>Open PDF</button>}
      </div>
      {item.problems.length > 0 && <Note tone="bad">{item.problems.join(' · ')}</Note>}
      {item.kind === 'extraction' && (
        <div className="v3-billform">
          {BILL_FIELDS.map((f) => (
            <label key={f.key} className="v3-plantfield">
              <span>{f.label}</span>
              <input className="v3-field" type={f.type} step={f.type === 'number' ? 'any' : undefined} value={draft[f.key]} aria-invalid={errors[f.key] ? 'true' : undefined} onChange={(ev) => setDraft((d) => ({ ...d, [f.key]: ev.target.value }))} />
              {errors[f.key] && <span className="v3-hint" data-error="true">{errors[f.key]}</span>}
            </label>
          ))}
          <div className="v3-plantfield"><span>Rate this implies</span><div className="v3-num" style={{ height: 34, display: 'flex', alignItems: 'center' }}>{rate === null ? '—' : `LKR ${fmtNum(rate, 2)} / kWh`}</div></div>
        </div>
      )}
      {msg && <Note tone="bad">{msg}</Note>}
      <div className="v3-formrow">
        {item.kind === 'extraction' && <button type="button" className="v3-btn primary" disabled={busy || Object.keys(errors).length > 0} onClick={approve}>{busy ? 'Working…' : 'Approve'}</button>}
        {item.kind === 'failed' && <button type="button" className="v3-btn primary" disabled={busy} onClick={retry}>Try reading again</button>}
        {!confirming
          ? <button type="button" className="v3-btn" disabled={busy} onClick={() => setConfirming(true)}>{item.kind === 'failed' ? 'Discard' : 'Reject'}</button>
          : <span className="v3-confirm">Permanently delete this upload and its file? <button type="button" className="v3-btn" disabled={busy} onClick={discard}>{busy ? 'Deleting…' : 'Yes, delete'}</button> <button type="button" className="v3-btn" onClick={() => setConfirming(false)}>Keep</button></span>}
      </div>
    </div>
  );
}

function QueueCard({ queue }) {
  const items = queueItems(queue.data);
  return (
    <Glass card aria-label="Needs your check" style={{ gap: 12 }}>
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Needs your check</h2>
          <div className="v3-sub">Extracted values you confirm or correct. Nothing counts until you approve.</div>
        </div>
        {queue.data && <Pill tone={items.length ? 'warn' : 'good'}>{items.length ? `${items.length} waiting` : 'All clear'}</Pill>}
      </div>
      {queue.error && <Note tone="bad">Could not load the queue ({queue.error.code ?? 'error'}).</Note>}
      {queue.loading && !queue.data && <div className="v3-skeleton" style={{ height: 80 }} aria-busy="true" aria-label="Loading" />}
      {queue.data && items.length === 0 && <Note>No bills are waiting for review.</Note>}
      {items.map((it) => <QueueItem key={it.id} item={it} onDone={(approved) => queue.onChanged(approved)} />)}
    </Glass>
  );
}

/** Bills: upload, review the extraction, approve. Approving refreshes the bill list everywhere. */
export function BillsTab() {
  const api = useAdminApi();
  const queue = useAdminLoad(() => api.listQueue());
  const bills = useResource('bills');
  const onChanged = (approved) => { queue.reload(); if (approved) bills.refresh(); };
  return (
    <>
      <section className="v3-twocol">
        <UploadCard onUploaded={() => queue.reload()} />
        <QueueCard queue={{ ...queue, onChanged }} />
      </section>
      <ApprovedBills onChanged={() => bills.refresh()} />
    </>
  );
}
