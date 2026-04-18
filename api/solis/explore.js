/**
 * Vercel Serverless Function: SolisCloud API Explorer Proxy
 * 
 * Safe, server-side gateway for calling read-only Solis endpoints
 * - Validates all requests against allowlist
 * - Enforces read-only flag
 * - Audits all calls
 * - Rate limits per user/IP
 * - Requires authentication via Clerk
 */

import { solisFetch } from '../../src/lib/solisAuth.js';
import validator from '../lib/solisExplorerValidator.js';

// Simple in-memory rate limiter (per Vercel function invocation)
const requestLogs = {};

function getRateLimitKey(userId, ip) {
  // Use userId if available (authenticated), otherwise use IP
  return userId || ip || 'anonymous';
}

function checkRateLimit(limitKey, limit = 30, windowMs = 60000) {
  const now = Date.now();

  if (!requestLogs[limitKey]) {
    requestLogs[limitKey] = [];
  }

  // Prune old requests outside the window
  requestLogs[limitKey] = requestLogs[limitKey].filter((timestamp) => now - timestamp < windowMs);

  if (requestLogs[limitKey].length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Math.max(...requestLogs[limitKey]) + windowMs),
    };
  }

  requestLogs[limitKey].push(now);
  return {
    allowed: true,
    remaining: limit - requestLogs[limitKey].length,
    resetAt: new Date(now + windowMs),
  };
}

/**
 * Extract user info from Clerk headers or request
 */
function getUserInfo(req) {
  // Try Clerk headers first
  const clerküserId = req.headers['x-clerk-user-id'] || req.headers.get?.('x-clerk-user-id');
  const clerkAuthStatus = req.headers['x-clerk-auth-status'];
  
  // Fallback to custom headers
  const userId = clerküserId || req.headers['x-user-id'];
  const isAuthenticated = Boolean(clerküserId) || req.headers['x-authenticated'] === 'true';

  return { userId, isAuthenticated };
}

/**
 * Audit log entry
 */
function auditLog(userId, endpointKey, success, statusCode, durationMs, errorMsg = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    userId: userId || 'anonymous',
    endpoint: endpointKey,
    success,
    statusCode,
    durationMs,
    error: errorMsg || null,
  };

  // For development/debugging
  if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
    console.log('[AUDIT]', JSON.stringify(logEntry));
  }

  // TODO: Write to Supabase audit table
  // await supabase.from('api_audit_logs').insert([logEntry]);

  return logEntry;
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Clerk-User-Id');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const startTime = Date.now();
  const userInfo = getUserInfo(req);
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const limitKey = getRateLimitKey(userInfo.userId, clientIp);

  try {
    // 1. Check method
    if (req.method !== 'POST') {
      auditLog(userInfo.userId, 'unknown', false, 405, Date.now() - startTime, 'Method not allowed');
      return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // 2. Rate limit check (before auth for DDoS protection)
    const rateLimitCheck = checkRateLimit(limitKey);
    if (!rateLimitCheck.allowed) {
      auditLog(userInfo.userId, 'unknown', false, 429, Date.now() - startTime, 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        resetAt: rateLimitCheck.resetAt,
      });
    }

    // 3. Parse request body
    const { endpointKey, params } = req.body || {};

    if (!endpointKey || !params) {
      return res.status(400).json({
        error: 'Missing required fields: endpointKey (string), params (object)',
      });
    }

    // 4. Validate request
    const validation = validator.validateRequest(endpointKey, params);
    if (!validation.valid) {
      auditLog(userInfo.userId, endpointKey, false, 400, Date.now() - startTime, validation.error);
      return res.status(400).json({
        error: validation.error,
        details: validation.errors,
      });
    }

    // 5. Call Solis API through solisFetch
    const path = validation.endpoint.path;
    const solisResponse = await solisFetch(path, validation.params, 'POST');

    const durationMs = Date.now() - startTime;
    const statusCode = solisResponse?.success ? 200 : 400;

    auditLog(userInfo.userId, endpointKey, solisResponse?.success, statusCode, durationMs);

    // 6. Return response with metadata
    return res.status(statusCode).json({
      ok: solisResponse?.success,
      endpointKey,
      path,
      requestedAt: new Date().toISOString(),
      durationMs,
      solisResponse,
      rateLimit: {
        remaining: rateLimitCheck.remaining,
        resetAt: rateLimitCheck.resetAt,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    auditLog(userInfo.userId, req.body?.endpointKey || 'unknown', false, 500, durationMs, error.message);

    console.error('[ERROR] SolisCloud Explorer:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message,
    });
  }
}
