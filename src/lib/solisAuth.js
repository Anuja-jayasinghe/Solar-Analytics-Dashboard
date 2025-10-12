import CryptoJS from 'crypto-js';

// ✅ Helper to read environment variables safely
function getEnv(key) {
  if (typeof process !== 'undefined' && process.env[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  return undefined;
}

/**
 * Build SolisCloud authentication headers
 * @param {string} apiPath - API endpoint path (e.g. '/v1/api/inverterList')
 * @param {object} body - Request body
 * @returns {object} Headers with MD5, Date, and HMAC signature
 */
export async function buildSolisHeaders(apiPath, body) {
  const apiId =
    getEnv('SOLIS_API_ID') || getEnv('VITE_SOLIS_API_ID');
  const apiSecret =
    getEnv('SOLIS_API_SECRET') || getEnv('VITE_SOLIS_API_SECRET');
  const apiUrl =
    getEnv('SOLIS_API_URL') || getEnv('VITE_SOLIS_API_URL') || 'https://www.soliscloud.com:13333';

  if (!apiId || !apiSecret) {
    throw new Error('❌ Missing Solis API credentials in environment variables.');
  }

  // Debug
  console.log('🔐 Using API URL:', apiUrl);
  console.log('🆔 Using API ID:', apiId ? 'Loaded ✅' : 'Missing ❌');

  // 1️⃣ Convert body to string
  const bodyString = JSON.stringify(body);

  // 2️⃣ Compute Content-MD5 → Base64(MD5(body))
  const md5Hash = CryptoJS.MD5(bodyString);
  const contentMd5 = CryptoJS.enc.Base64.stringify(md5Hash);

  // 3️⃣ Get current GMT date
  const date = new Date().toUTCString();

  // 4️⃣ Build canonical string for signing
  const canonical = `POST\n${contentMd5}\napplication/json;charset=UTF-8\n${date}\n${apiPath}`;

  // 5️⃣ Compute HMAC-SHA1 signature → Base64
  const signature = CryptoJS.HmacSHA1(canonical, apiSecret);
  const base64Sign = CryptoJS.enc.Base64.stringify(signature);

  // 6️⃣ Combine headers
  return {
    'Content-MD5': contentMd5,
    'Content-Type': 'application/json;charset=UTF-8',
    Date: date,
    Authorization: `API ${apiId}:${base64Sign}`,
  };
}

/**
 * Execute signed POST request to SolisCloud API
 * @param {string} apiPath - API endpoint path (e.g. '/v1/api/inverterList')
 * @param {object} body - Request body
 */
export async function solisFetch(apiPath, body) {
  const apiUrl =
    getEnv('SOLIS_API_URL') || getEnv('VITE_SOLIS_API_URL') || 'https://www.soliscloud.com:13333';
  const headers = await buildSolisHeaders(apiPath, body);

  console.log('🌍 Solis API Endpoint:', `${apiUrl}${apiPath}`);

// ✅ Ensure no double slashes in URL
const endpoint = `${apiUrl.replace(/\/+$/, '')}/${apiPath.replace(/^\/+/, '')}`;

console.log('🌍 Solis API Endpoint (clean):', endpoint);

const res = await fetch(endpoint, {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
});


  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ Solis API Response Error:', errText);
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  console.log('✅ Solis API Response:', data);
  return data;
}
