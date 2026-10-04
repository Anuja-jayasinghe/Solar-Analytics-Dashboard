import { useEffect, useState } from 'react';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { PLANT_FIELDS, changedFields, toDraft, validateDraft } from './form.js';

/**
 * Plant settings. Admins edit and save (one PUT per changed field, through the admin-only API); everyone
 * else sees the same values read-only. `onSave(changes)` resolves when every write has been accepted.
 */
export function PlantCard({ settings, loading, canEdit, onSave }) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const [state, setState] = useState({ status: 'idle', message: '' });

  // When the stored values change (first load, or after a save) the inputs follow them.
  useEffect(() => { setDraft(toDraft(settings)); }, [settings]);

  const errors = validateDraft(settings, draft);
  const changes = changedFields(settings, draft);
  const hasErrors = Object.keys(errors).length > 0;

  const save = async () => {
    setState({ status: 'saving', message: '' });
    try {
      await onSave(changes);
      setState({ status: 'saved', message: `Saved ${changes.map((c) => c.label.toLowerCase()).join(', ')}.` });
    } catch (err) {
      setState({ status: 'error', message: err?.status === 403 ? 'Only an admin can change these settings.' : `Could not save (${err?.code ?? 'error'}). Nothing was changed on the server for the failed field.` });
    }
  };

  return (
    <Glass card aria-label="Plant settings">
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Plant</h2>
          <div className="v3-sub">Used by the Today circle, the live gauge and kWh per kWp.</div>
        </div>
        <Pill tone={canEdit ? 'good' : undefined}>{canEdit ? 'You can edit' : 'Read only'}</Pill>
      </div>

      {loading && !settings ? <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" /> : (
        <form className="v3-plantform" onSubmit={(e) => { e.preventDefault(); if (canEdit && changes.length && !hasErrors) save(); }}>
          {PLANT_FIELDS.map((f) => (
            <label key={f.key} className="v3-plantfield">
              <span>{f.label} <span className="v3-mut">({f.unit})</span></span>
              <input
                className="v3-field"
                type="number"
                inputMode="decimal"
                min="0"
                step={f.step}
                value={draft[f.key] ?? ''}
                placeholder="not set"
                disabled={!canEdit}
                aria-invalid={errors[f.key] ? 'true' : undefined}
                aria-describedby={`hint-${f.key}`}
                onChange={(e) => { setState({ status: 'idle', message: '' }); setDraft((d) => ({ ...d, [f.key]: e.target.value })); }}
              />
              <span id={`hint-${f.key}`} className="v3-hint" data-error={errors[f.key] ? 'true' : undefined}>{errors[f.key] ?? f.hint}</span>
            </label>
          ))}
          {canEdit && (
            <div className="v3-formrow">
              <button type="submit" className="v3-btn primary" disabled={!changes.length || hasErrors || state.status === 'saving'}>{state.status === 'saving' ? 'Saving…' : 'Save'}</button>
              {changes.length > 0 && !hasErrors && <span className="v3-sub" style={{ margin: 0 }}>{changes.length} change{changes.length === 1 ? '' : 's'} to save</span>}
            </div>
          )}
        </form>
      )}
      {state.status === 'saved' && <Note>{state.message}</Note>}
      {state.status === 'error' && <Note tone="bad">{state.message}</Note>}
    </Glass>
  );
}
