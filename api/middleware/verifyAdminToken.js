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

export async function verifyAdminToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('verifyAdminToken: missing bearer token');
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return null;
  }

  if (!CLERK_SECRET_KEY) {
    console.error('verifyAdminToken: CLERK_SECRET_KEY is not configured');
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
    console.warn('verifyAdminToken: token verification failed', err?.message);
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
    return null;
  }

  const userId = payload?.sub;
  if (!userId) {
    console.error('verifyAdminToken: verified token carried no subject');
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
    return null;
  }

  try {
    // Authorization is read from Clerk itself rather than from the token, so a role change
    // takes effect immediately instead of waiting for the client's token to refresh.
    const user = await clerkClient.users.getUser(userId);

    if (user.publicMetadata?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden - Admins only' });
      return null;
    }

    req.adminUser = user;
    return user;
  } catch (err) {
    console.error('verifyAdminToken: failed to load user', err?.message);
    res.status(401).json({ error: 'Unauthorized - Could not resolve user' });
    return null;
  }
}

export { clerkClient };
