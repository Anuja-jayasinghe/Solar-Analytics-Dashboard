// ./src/lib/solisAuth.js
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const SOLIS_API_ID = process.env.SOLIS_API_ID;
const SOLIS_API_SECRET = process.env.SOLIS_API_SECRET;
const SOLIS_BASE_URL = 'https://www.soliscloud.com:13333';

if (!SOLIS_API_ID || !SOLIS_API_SECRET) {
  throw new Error('Missing SOLIS_API_ID or SOLIS_API_SECRET environment variable.');
}

/**
 * Builds the correct SolisCloud authentication headers.
 */
function buildSolisHeaders(method, path, body = '') {
  const contentType = 'application/json';
  const contentMd5 = body ? crypto.createHash('md5').update(body).digest('base64') : '';
  const date = new Date().toUTCString();

  // Canonical string to sign
  const canonicalString = [method, contentMd5, contentType, date, path].join('\n');

  // Sign with HMAC-SHA1 using API secret
  const signature = crypto.createHmac('sha1', SOLIS_API_SECRET).update(canonicalString).digest('base64');
  const authorization = `API ${SOLIS_API_ID}:${signature}`;

  return {
    'Content-MD5': contentMd5,
    'Content-Type': contentType,
    'Date': date,
    'Authorization': authorization,
  };
}

/**
 * Wrapper around fetch with SolisCloud signing.
 */
export async function solisFetch(endpoint, bodyData = {}, method = 'POST') {
  const path = `/v1/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const body = method === 'GET' ? '' : JSON.stringify(bodyData);
  const headers = buildSolisHeaders(method, path, body);

  const response = await fetch(`${SOLIS_BASE_URL}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : body,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('❌ Solis API Error:', json);
    throw new Error(`Solis API request failed with status ${response.status}`);
  }

  return json;
}
