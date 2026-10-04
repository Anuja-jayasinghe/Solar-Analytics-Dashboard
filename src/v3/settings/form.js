// src/v3/settings/form.js
//
// Plant settings: the four admin-editable numbers, how they map to `system_settings` names, and the
// pure draft logic (what changed, what is valid). The server validates again; this only gives a
// useful message before the request.

export const PLANT_FIELDS = Object.freeze([
  { key: 'dailyTargetKwh', name: 'daily_generation_target', label: 'Daily target', unit: 'kWh', hint: 'The Today circle fills toward this.', step: '1' },
  { key: 'capacityKwp', name: 'capacity_kwp', label: 'Array size', unit: 'kWp (DC)', hint: 'Panel capacity, used for kWh per kWp.', step: '0.01' },
  { key: 'acRatedKw', name: 'solar_grid_capacity', label: 'Inverter rating', unit: 'kW (AC)', hint: 'The live gauge reads against this.', step: '1' },
  { key: 'ratePerKwh', name: 'rate_per_kwh', label: 'Reference tariff', unit: 'LKR / kWh', hint: 'Reference only; money figures use each bill’s own rate.', step: '0.01' }
]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Settings from the API (numbers or null) -> text drafts for the inputs ('' = not set). */
export function toDraft(settings) {
  const d = {};
  for (const f of PLANT_FIELDS) d[f.key] = isNum(settings?.[f.key]) ? String(settings[f.key]) : '';
  return d;
}

/** The text of an input -> a number, or null if it is not a valid non-negative number. */
export function parseField(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Problems with the draft, keyed by field. A blank field is allowed only if it was blank before (unset stays unset). */
export function validateDraft(settings, draft) {
  const errors = {};
  for (const f of PLANT_FIELDS) {
    const text = draft?.[f.key] ?? '';
    const was = isNum(settings?.[f.key]);
    if (text.trim() === '') {
      if (was) errors[f.key] = 'Enter a number, or leave the old value.';
    } else if (parseField(text) === null) {
      errors[f.key] = 'Must be a number, zero or more.';
    }
  }
  return errors;
}

/** The writes needed: only fields whose parsed value differs from what is stored. */
export function changedFields(settings, draft) {
  const out = [];
  for (const f of PLANT_FIELDS) {
    const next = parseField(draft?.[f.key] ?? '');
    if (next === null) continue;
    const prev = isNum(settings?.[f.key]) ? settings[f.key] : null;
    if (next !== prev) out.push({ key: f.key, name: f.name, label: f.label, value: next });
  }
  return out;
}
