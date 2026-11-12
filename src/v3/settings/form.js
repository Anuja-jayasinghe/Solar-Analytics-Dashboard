// src/v3/settings/form.js
//
// Plant settings: the four admin-editable numbers, how they map to `system_settings` names, and the
// pure draft logic (what changed, what is valid). The server validates again; this only gives a
// useful message before the request.
//
// A field with a `factor` is typed in a smaller unit than it is stored in: the inverter rating is entered in watts
// (41760) so it can be exact, and stored in kW (41.76), which is what the gauge and the API use.

export const PLANT_FIELDS = Object.freeze([
  { key: 'dailyTargetKwh', name: 'daily_generation_target', label: 'Daily target', unit: 'kWh', hint: 'The Today circle fills toward this.', step: '1' },
  { key: 'capacityKwp', name: 'capacity_kwp', label: 'Array size', unit: 'kWp (DC)', hint: 'Panel capacity, used for kWh per kWp.', step: '0.01' },
  { key: 'acRatedKw', name: 'solar_grid_capacity', label: 'Inverter rating', unit: 'W (AC)', hint: 'In watts, e.g. 41760 for 41.76 kW. The live gauge reads against this.', step: 'any', factor: 1000 },
  { key: 'ratePerKwh', name: 'rate_per_kwh', label: 'Reference tariff', unit: 'LKR / kWh', hint: 'Reference only; money figures use each bill’s own rate.', step: '0.01' }
]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const factorOf = (f) => f.factor ?? 1;

/** Settings from the API (numbers or null) -> text drafts for the inputs ('' = not set). 40 kW -> '40000' for a watts field. */
export function toDraft(settings) {
  const d = {};
  for (const f of PLANT_FIELDS) {
    const v = settings?.[f.key];
    d[f.key] = isNum(v) ? String(f.factor ? Math.round(v * f.factor * 1000) / 1000 : v) : '';
  }
  return d;
}

/** A field's draft text -> the value to store (kW for a watts field: '41760' -> 41.76), or null when not a valid number. */
export function storedValue(f, text) {
  const n = parseField(text);
  if (n === null) return null;
  // Rounded so 41760 W is exactly 41.76, not 41.760000000000005.
  return f.factor ? Math.round((n / factorOf(f)) * 1e6) / 1e6 : n;
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
    } else if (f.factor && parseField(text) > 0 && parseField(text) < f.factor) {
      // 41.76 typed into a watts field is almost certainly kW: say so instead of saving a 0.04 kW inverter.
      const n = parseField(text);
      errors[f.key] = `That looks like kW. Enter watts: ${Math.round(n * f.factor)} for ${n} kW.`;
    }
  }
  return errors;
}

/** The writes needed: only fields whose parsed value differs from what is stored. */
export function changedFields(settings, draft) {
  const out = [];
  for (const f of PLANT_FIELDS) {
    const next = storedValue(f, draft?.[f.key] ?? '');
    if (next === null) continue;
    const prev = isNum(settings?.[f.key]) ? settings[f.key] : null;
    if (next !== prev) out.push({ key: f.key, name: f.name, label: f.label, value: next });
  }
  return out;
}
