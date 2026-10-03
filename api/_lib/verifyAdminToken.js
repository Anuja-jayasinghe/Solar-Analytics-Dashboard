// Clerk admin verification middleware
//
// Migrated from @clerk/clerk-sdk-node (deprecated by the vendor, and subject to a critical
// authorization-bypass advisory) to @clerk/backend. This is the single most load-bearing
// dependency in the project: every API endpoint authorizes through this function.
//
// The old implementation tried three strategies in sequence — sessions.verifySession(), then
// verifyToken() with a template, then verifyToken() without — swallowing each failure. That
// made a genuine verification failure indistinguishable from a misconfiguration, and the
// legacy verifySession() path is no longer part of the supported surface.
//
// This verifies the token once, with `authorizedParties` set so a token minted for another
// origin cannot be replayed against this API.

import { createClerkClient, verifyToken } from '@clerk/backend';
import { accessLevelFromMetadata, satisfiesLevel } from '../../shared/domain/access.js';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

/**
 * Origins permitted to mint tokens accepted by this API. Without this, a token issued for a
 * different Clerk application origin could be replayed here.
 */
function getAuthorizedParties() {
  const fromEnv = (process.env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  return [
    'https://solaredge.anujajay.com',
    'http://localhost:5173',
    'http://localhost:4173'
  ];
}

/**
 * Verify the bearer token and load the Clerk user. The ONE place tokens are checked: admin and
 * viewer endpoints both go through it, so a fix or a hardening here applies to every endpoint.
 *
 * On failure it has already sent the response and returns null.
 */
export async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('authenticate: missing bearer token');
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return null;
  }

  if (!CLERK_SECRET_KEY) {
    console.error('authenticate: CLERK_SECRET_KEY is not configured');
    res.status(500).json({ error: 'Server auth is not configured' });
    return null;
  }

  const token = authHeader.substring(7);

  let payload;
  try {
    payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties: getAuthorizedParties()
    });
  } catch (err) {
    // A failure here is a failure — do not fall through to a weaker check.
    console.warn('authenticate: token verification failed', err?.message);
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
    return null;
  }

  const userId = payload?.sub;
  if (!userId) {
    console.error('authenticate: verified token carried no subject');
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
    return null;
  }

  try {
    // Authorization is read from Clerk itself rather than from the token, so a role change
    // takes effect immediately instead of waiting for the client's token to refresh.
    return await clerkClient.users.getUser(userId);
  } catch (err) {
    console.error('authenticate: failed to load user', err?.message);
    res.status(401).json({ error: 'Unauthorized - Could not resolve user' });
    return null;
  }
}

/**
 * Require at least `required` access ('viewer' | 'admin'). Returns the user, or null after
 * sending a 401/403. Sets req.accessLevel for the handler.
 */
export async function verifyAccess(req, res, required = 'viewer') {
  const user = await authenticate(req, res);
  if (!user) return null;

  const level = accessLevelFromMetadata(user.publicMetadata);
  if (!satisfiesLevel(level, required)) {
    res.status(403).json({ error: required === 'admin' ? 'Forbidden - Admins only' : 'Forbidden - Dashboard access required' });
    return null;
  }

  req.accessLevel = level;
  req.authUser = user;
  return user;
}

/** Admin-only gate. Behaviour is unchanged for every existing admin endpoint. */
export async function verifyAdminToken(req, res) {
  const user = await verifyAccess(req, res, 'admin');
  if (user) req.adminUser = user;
  return user;
}

export { clerkClient };
