import CryptoJS from 'crypto-js';

// Helper to read environment variables safely
function getEnv(key) {
  if (typeof process !== 'undefined' && process.env[key]) return process.env[key];
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
  return undefined;
}

/**
 * Build SolisCloud authentication headers
 * @param {string} apiPath - API endpoint path (e.g. '/v1/api/inverterList')
 * @param {object|string} body - Request body
 * @param {string} method - HTTP method (default POST)
 */
export async function buildSolisHeaders(apiPath, body = '', method = 'POST') {
  const apiId = getEnv('SOLIS_API_ID') || getEnv('VITE_SOLIS_API_ID');
  const apiSecret = getEnv('SOLIS_API_SECRET') || getEnv('VITE_SOLIS_API_SECRET');
  if (!apiId || !apiSecret) throw new Error('❌ Missing Solis API credentials.');

  const path = `/${apiPath.replace(/^\/+/, '')}`;
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  const contentType = 'application/json'; // match Postman exactly

  // Compute Content-MD5 only if body is not empty
  let contentMd5 = '';
  if (bodyString && bodyString !== '{}' && bodyString.trim() !== '') {
    const md5Hash = CryptoJS.MD5(bodyString);
    contentMd5 = CryptoJS.enc.Base64.stringify(md5Hash);
  }

  const date = new Date().toUTCString();

  // Build canonical string
  const canonical = [method.toUpperCase(), contentMd5, contentType, date, path].join('\n');

  // Sign with HMAC-SHA1 (string directly, not UTF8 parsed)
  const signature = CryptoJS.HmacSHA1(canonical, apiSecret);
  const base64Sign = CryptoJS.enc.Base64.stringify(signature);

  const DEBUG = (process?.env?.NODE_ENV !== 'production') && ((typeof import.meta !== 'undefined' && import.meta?.env?.DEV) || (process?.env?.DEBUG === 'true'));
  if (DEBUG) {
    console.log('🧾 Canonical String:\n' + canonical);
    console.log('🔏 Signature:', base64Sign);
  }

  return {
    'Content-MD5': contentMd5,
    'Content-Type': contentType,
    Date: date,
    Authorization: `API ${apiId}:${base64Sign}`,
  };
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
    getEnv('VITE_SOLIS_API_URL') ||
    'https://www.soliscloud.com:13333';

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
