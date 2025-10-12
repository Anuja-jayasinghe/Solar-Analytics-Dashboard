import CryptoJS from 'crypto-js';

/**
 * Build SolisCloud authentication headers
 * @param {string} apiPath - API endpoint path (e.g. '/v1/api/inverterList')
 * @param {object} body - Request body
 * @returns {object} Headers with MD5, Date, and HMAC signature
 */
export async function buildSolisHeaders(apiPath, body) {
  const apiId = import.meta.env.VITE_SOLIS_API_ID;
  const apiSecret = import.meta.env.VITE_SOLIS_API_SECRET;
  const apiUrl = import.meta.env.VITE_SOLIS_API_URL || 'https://www.soliscloud.com:13333';

  // 1️⃣ Convert body to string
  const bodyString = JSON.stringify(body);

  // 2️⃣ Compute Content-MD5 → Base64(MD5(body))
  const md5Hash = CryptoJS.MD5(bodyString);
  const contentMd5 = CryptoJS.enc.Base64.stringify(md5Hash);

  // 3️⃣ Get current GMT date (format: EEE, d MMM yyyy HH:mm:ss GMT)
  const date = new Date().toUTCString();

  // 4️⃣ Build Canonicalized string for signing
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
  const apiUrl = import.meta.env.VITE_SOLIS_API_URL || 'https://www.soliscloud.com:13333';
  const headers = await buildSolisHeaders(apiPath, body);

  const res = await fetch(`${apiUrl}${apiPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data;
}
