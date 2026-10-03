// api/ceb-bills/signed-url.js
//
// POST { filePath } -> { signedUrl, expiresIn }
//
// Admin-authenticated short-lived link to one bill PDF.
//
// Why this exists: the browser used to call `supabase.storage.createSignedUrl` itself with the
// public anon key. That only works if `anon` may SELECT from the private `ceb_bills` bucket —
// which meant anyone holding the (public) anon key could list and download every bill, each of
// which carries the account holder's name, address, phone number and account number. Signing now
// happens here with the service-role key, so the bucket can be closed to `anon` entirely.
//
// The path must belong to a known ingestion. Signing whatever path the caller names would turn
// this endpoint into a way to read any object in the bucket.

import { verifyAdminToken } from '../_lib/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';
const EXPIRES_IN_SECONDS = 300;
const MAX_PATH_LENGTH = 512;

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return;

  if (blockOnConfigProblem(res)) return;

  try {
    const { filePath } = req.body || {};

    if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > MAX_PATH_LENGTH) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const { data: ingestion, error: lookupError } = await supabase
      .from('ceb_bill_ingestions')
      .select('id')
      .eq('file_path', filePath)
      .limit(1)
      .maybeSingle();

    if (lookupError) throw new Error(`Ingestion lookup failed: ${lookupError.message}`);
    if (!ingestion) return res.status(404).json({ error: 'No bill is stored at that path' });

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, EXPIRES_IN_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error(`Signing failed: ${error?.message || 'no URL returned'}`);
    }

    return res.status(200).json({ signedUrl: data.signedUrl, expiresIn: EXPIRES_IN_SECONDS });
  } catch (error) {
    console.error('CEB signed-url failed', { message: error?.message });
    return res.status(500).json({ error: 'Failed to create a preview link' });
  }
}
