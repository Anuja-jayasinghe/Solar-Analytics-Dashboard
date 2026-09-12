// SECURITY: this endpoint previously had no authentication and no method check. It runs with
// the Supabase service-role key and calls the SolisCloud API, so anyone on the internet could
// invoke it repeatedly to burn our Solis quota and Vercel execution time. It has no callers
// anywhere in the repo — it is operator-triggered only — so it is now admin-gated.
// Vercel Serverless Function: Update total_generation metric from Solis
import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js';
import { verifyAdminToken } from './middleware/verifyAdminToken.js';
import { handlePreflightAndMethod } from './_lib/httpSecurity.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return; // verifyAdminToken has already sent 401/403

  try {
    const response = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
    if (!response?.success || response?.code !== '0' || !response?.data?.page?.records?.length) {
      throw new Error(`Failed to fetch inverter list: ${response?.msg || 'Invalid response'}`);
    }
    const inverter = response.data.page.records[0];
    const total = Number(inverter.etotal || 0);

    const { error } = await supabase.from('system_metrics').upsert(
      { metric_name: 'total_generation', metric_value: total, updated_at: new Date().toISOString() },
      { onConflict: 'metric_name' }
    );
    if (error) throw new Error(`Supabase update failed: ${error.message}`);

    res.status(200).json({ ok: true, total });
  } catch (err) {
    console.error('update-total-generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
