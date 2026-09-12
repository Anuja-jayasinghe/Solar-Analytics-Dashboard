// api/settings.js
//
// Admin-authenticated writes to `system_settings`.
//
// Why this exists: the Settings page previously wrote to Supabase directly from the browser
// using the public anon key, which forced `system_settings` to carry an
// `UPDATE ... USING (true)` policy for `anon`. Since the anon key ships in the JS bundle,
// that meant any visitor could change `rate_per_kwh` — and every earnings figure on the
// dashboard is derived from it.
//
// Writes now go through here with the service-role key, so the anon write policies can be
// dropped. Reads stay client-side and public; it is a public dashboard.
//
// PUT   { id, setting_value }  -> update one setting
// POST  { settings: [...] }    -> insert defaults (used by the "add default settings" action)

import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from './middleware/verifyAdminToken.js';
import { handlePreflightAndMethod } from './_lib/httpSecurity.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

// Only these may be written through this endpoint. An allowlist keeps a compromised admin
// session from introducing arbitrary rows into a table the dashboard trusts.
const ALLOWED_SETTINGS = new Set([
  'theme',
  'rate_per_kwh',
  'solar_grid_capacity',
  'daily_generation_target'
]);

function isValidValue(name, value) {
  if (value === null || value === undefined || String(value).trim() === '') return false;

  // Numeric settings must actually be numeric and non-negative — a non-numeric rate would
  // silently turn every earnings figure into NaN.
  if (['rate_per_kwh', 'solar_grid_capacity', 'daily_generation_target'].includes(name)) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
  }

  if (name === 'theme') return ['dark', 'light', 'orange'].includes(String(value));

  return String(value).length <= 200;
}

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['PUT', 'POST'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return; // verifyAdminToken has already sent 401/403

  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    res.status(500).json({
      error: 'Missing Supabase server configuration',
      details: 'Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
    });
    return;
  }

  try {
    if (req.method === 'PUT') {
      const { id, setting_value } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'Missing setting id' });
      }

      // Resolve the row first so we can validate against its name rather than trusting the
      // client to tell us which setting this is.
      const { data: existing, error: lookupError } = await supabase
        .from('system_settings')
        .select('id, setting_name')
        .eq('id', id)
        .maybeSingle();

      if (lookupError) throw new Error(`Setting lookup failed: ${lookupError.message}`);
      if (!existing) return res.status(404).json({ error: 'Setting not found' });

      if (!ALLOWED_SETTINGS.has(existing.setting_name)) {
        return res.status(403).json({
          error: `Setting '${existing.setting_name}' is not writable through this endpoint`
        });
      }

      if (!isValidValue(existing.setting_name, setting_value)) {
        return res.status(400).json({
          error: `Invalid value for ${existing.setting_name}`,
          details:
            existing.setting_name === 'theme'
              ? 'Expected one of: dark, light, orange'
              : 'Expected a non-negative number'
        });
      }

      const { data, error } = await supabase
        .from('system_settings')
        .update({ setting_value: String(setting_value), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Setting update failed: ${error.message}`);

      console.log('system_settings updated', {
        settingName: existing.setting_name,
        by: adminUser?.emailAddresses?.[0]?.emailAddress || adminUser?.id
      });

      return res.status(200).json({ setting: data });
    }

    // POST — seed default settings
    const { settings } = req.body || {};
    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ error: 'Expected a non-empty `settings` array' });
    }

    const invalid = settings.find(
      (s) => !ALLOWED_SETTINGS.has(s?.setting_name) || !isValidValue(s?.setting_name, s?.setting_value)
    );
    if (invalid) {
      return res.status(400).json({
        error: `Rejected setting '${invalid?.setting_name ?? 'unknown'}'`,
        details: 'Name must be allowlisted and the value must be valid'
      });
    }

    const { data, error } = await supabase
      .from('system_settings')
      .insert(
        settings.map((s) => ({
          setting_name: s.setting_name,
          setting_value: String(s.setting_value),
          description: s.description || null
        }))
      )
      .select();

    if (error) throw new Error(`Setting insert failed: ${error.message}`);

    return res.status(201).json({ settings: data });
  } catch (error) {
    console.error('Settings write failed', { message: error?.message });
    return res.status(500).json({ error: 'Failed to write settings', details: error?.message });
  }
}
