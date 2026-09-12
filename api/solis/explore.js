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
import validator from '../_lib/solisExplorerValidator.js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';

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
 * Identify the caller from a *verified* Clerk user.
 *
 * This previously read `x-clerk-user-id` / `x-user-id` / `x-authenticated` straight off the
 * request and derived an `isAuthenticated` flag that was then never checked — so the endpoint
 * was an open proxy to SolisCloud on our API credentials, and the rate limiter (keyed on that
 * same spoofable id) could be reset at will by rotating a header.
 *
 * The user object now comes from verifyAdminToken, which validates the Clerk session/JWT and
 * confirms the admin role, so the id cannot be forged.
 */
function getUserInfo(adminUser) {
  return {
    userId: adminUser?.id || 'unknown_admin',
    email: adminUser?.emailAddresses?.[0]?.emailAddress || null
  };
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
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  const startTime = Date.now();
  // Hoisted so the catch block can still attribute an audit entry if we fail before or
  // during authentication.
  let userInfo = { userId: 'unauthenticated', email: null };

  try {
    // 1. Authenticate FIRST. Everything downstream — the Solis call, the rate-limit identity,
    //    the audit trail — depends on knowing who this actually is.
    const adminUser = await verifyAdminToken(req, res);
    if (!adminUser) return; // verifyAdminToken has already sent 401/403

    userInfo = getUserInfo(adminUser);
    const clientIp =
      req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    const limitKey = getRateLimitKey(userInfo.userId, clientIp);

    // 2. Rate limit, now keyed on a verified identity rather than a spoofable header.
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
