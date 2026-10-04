// api/_lib/settingsRules.js
//
// What may be written to `system_settings`, and what a valid value looks like. Pure, so it is unit
// tested (tests/settingsRules.test.js) and shared by the endpoint (api/settings.js).
//
// An allowlist keeps a compromised admin session from introducing arbitrary rows into a table the
// whole dashboard trusts; numeric validation keeps a bad rate from turning every figure into NaN.

export const ALLOWED_SETTINGS = Object.freeze(['theme', 'rate_per_kwh', 'solar_grid_capacity', 'daily_generation_target', 'capacity_kwp']);
const NUMERIC = new Set(['rate_per_kwh', 'solar_grid_capacity', 'daily_generation_target', 'capacity_kwp']);
const THEMES = ['dark', 'light', 'orange'];

export function isAllowedSetting(name) {
  return ALLOWED_SETTINGS.includes(name);
}

export function isValidSettingValue(name, value) {
  if (value === null || value === undefined || String(value).trim() === '') return false;
  if (NUMERIC.has(name)) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
  }
  if (name === 'theme') return THEMES.includes(String(value));
  return String(value).length <= 200;
}

export function settingProblem(name) {
  return name === 'theme' ? 'Expected one of: dark, light, orange' : 'Expected a non-negative number';
}

/**
 * Which setting does a PUT body target? Either the row `id` (v1) or the setting's `setting_name`
 * (v3, which has no row ids). Exactly one is needed; a name must be allowlisted.
 * @returns {{by:'id', id:any} | {by:'name', name:string} | {error:string, status:number}}
 */
export function resolveTarget(body) {
  const { id, setting_name: name } = body ?? {};
  if (name !== undefined && name !== null && name !== '') {
    if (!isAllowedSetting(name)) return { error: `Setting '${name}' is not writable through this endpoint`, status: 403 };
    return { by: 'name', name: String(name) };
  }
  if (id !== undefined && id !== null && id !== '') return { by: 'id', id };
  return { error: 'Missing setting id or setting_name', status: 400 };
}
