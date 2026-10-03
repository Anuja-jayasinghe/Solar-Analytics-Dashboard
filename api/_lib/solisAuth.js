import { createHash, createHmac } from 'node:crypto';

// ============================================================================
// SERVER-ONLY. Do not import this from anything under src/.
//
// This file used to live in src/lib/ and read its credentials with a computed key:
//
//   function getEnv(key) { ... import.meta.env[key] ... }
//
// Vite can only statically replace `import.meta.env.LITERAL`. Given a computed key it
// inlines the ENTIRE env object instead — so any client import of this module would have
// published every VITE_ value, including VITE_SOLIS_API_SECRET, into the browser bundle.
//
// Nothing in the client graph reached it (verified against the built bundle), but the only
// thing preventing it was that an old src/lib test helper — its sole src/ importer — happened
// to be dead code. Moving the file here removes the possibility rather than relying on that.
// ============================================================================

function getEnv(key) {
  return typeof process !== 'undefined' ? process.env[key] : undefined;
}

/**
 * Sign a SolisCloud request.
 *
 * Pure — the clock and the credentials are arguments — so it can be checked against known
 * vectors. Signature scheme (SolisCloud API v2.0.3): Content-MD5 is the base64 MD5 of the body,
 * and the signature is base64(HMAC-SHA1(secret, canonical string)) with
 * canonical = METHOD \n Content-MD5 \n Content-Type \n Date \n path.
 *
 * MD5 and SHA-1 are weak primitives, but they are what the vendor's gateway requires; nothing
 * here is a choice.
 */
export function signSolisRequest({ apiId, apiSecret, method = 'POST', path, bodyString = '', date }) {
  const contentType = 'application/json'; // match Postman exactly

  // Compute Content-MD5 only if body is not empty
  let contentMd5 = '';
  if (bodyString && bodyString !== '{}' && bodyString.trim() !== '') {
    contentMd5 = createHash('md5').update(bodyString, 'utf8').digest('base64');
  }

  const canonical = [method.toUpperCase(), contentMd5, contentType, date, path].join('\n');
  const base64Sign = createHmac('sha1', apiSecret).update(canonical, 'utf8').digest('base64');

  return {
    canonical,
    signature: base64Sign,
    headers: {
      'Content-MD5': contentMd5,
      'Content-Type': contentType,
      Date: date,
      Authorization: `API ${apiId}:${base64Sign}`,
    },
  };
}

/**
 * Build SolisCloud authentication headers
 * @param {string} apiPath - API endpoint path (e.g. '/v1/api/inverterList')
 * @param {object|string} body - Request body
 * @param {string} method - HTTP method (default POST)
 */
export async function buildSolisHeaders(apiPath, body = '', method = 'POST') {
  const apiId = getEnv('SOLIS_API_ID');
  const apiSecret = getEnv('SOLIS_API_SECRET');
  if (!apiId || !apiSecret) throw new Error('❌ Missing Solis API credentials.');

  const path = `/${apiPath.replace(/^\/+/, '')}`;
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body ?? '');

  const { canonical, signature, headers } = signSolisRequest({
    apiId,
    apiSecret,
    method,
    path,
    bodyString,
    date: new Date().toUTCString(),
  });

  const DEBUG = (process?.env?.NODE_ENV !== 'production') && ((typeof import.meta !== 'undefined' && import.meta?.env?.DEV) || (process?.env?.DEBUG === 'true'));
  if (DEBUG) {
    console.log('🧾 Canonical String:\n' + canonical);
    console.log('🔏 Signature:', signature);
  }

  return headers;
}

/**
 * Execute signed request to SolisCloud API
 * @param {string} apiPath - API endpoint path
 * @param {object} body - Request body
 * @param {string} method - HTTP method ('POST' | 'GET')
 */
export async function solisFetch(apiPath, body = {}, method = 'POST') {
  const apiUrl =
    getEnv('SOLIS_API_URL') ||
    'https://www.soliscloud.com:13333';

  const DEBUG = (process?.env?.NODE_ENV !== 'production') && ((typeof import.meta !== 'undefined' && import.meta?.env?.DEV) || (process?.env?.DEBUG === 'true'));

  const headers = await buildSolisHeaders(apiPath, body, method);

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/${apiPath.replace(/^\/+/, '')}`;
  if (DEBUG) console.log('🌍 Solis API Endpoint:', endpoint);

  const options = { method, headers };
  if (method === 'POST') options.body = JSON.stringify(body);

  const res = await fetch(endpoint, options);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('❌ Non-JSON response:', text);
    throw new Error(`Invalid response format: ${text}`);
  }

  if (!res.ok) {
    if (DEBUG) console.error('❌ Solis API Error:', data);
    throw new Error(`HTTP ${res.status}: ${data.msg || text}`);
  }
  if (DEBUG) console.log('✅ Solis API Response:', data);
  return data;
}
