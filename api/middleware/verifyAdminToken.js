// Clerk admin verification middleware
import { clerkClient } from '@clerk/clerk-sdk-node';

export async function verifyAdminToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('verifyAdminToken: missing bearer token');
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return null;
  }
  const token = authHeader.substring(7);
  try {
    let userId = null;

    // 1) Try verifying as a session token
    try {
      const session = await clerkClient.sessions.verifySession(token);
      userId = session?.userId;
    } catch (e) {
      console.warn('verifyAdminToken: session verify failed, will try JWT', e?.message);
    }

    // 2) Try verifying as a JWT (e.g., template token) if a template name is configured
    const templateName = process.env.CLERK_JWT_TEMPLATE_NAME;
    if (!userId && templateName) {
      try {
        const verified = await clerkClient.verifyToken(token, {
          template: templateName
        });
        userId = verified.sub;
      } catch (e) {
        console.warn('verifyAdminToken: JWT verify (template) failed', e?.message);
      }
    }

    // 3) Try verifying as a standard session JWT (no template)
    if (!userId) {
      try {
        const verified = await clerkClient.verifyToken(token);
        userId = verified.sub;
      } catch (e) {
        console.warn('verifyAdminToken: JWT verify (default) failed', e?.message);
      }
    }

    if (!userId) {
      console.error('verifyAdminToken: unable to verify token');
      res.status(401).json({
        error: 'Unauthorized - Invalid token',
        debug: {
          hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
          template: process.env.CLERK_JWT_TEMPLATE_NAME || null,
          message: 'Token could not be verified as session or JWT'
        }
      });
      return null;
    }

    // Fetch the user and check admin role
    const user = await clerkClient.users.getUser(userId);
    if (user.publicMetadata?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden - Admins only' });
      return null;
    }
    // Attach user info for downstream use
    req.adminUser = user;
    return user;
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized - Invalid token', details: err.message });
    return null;
  }
}
