// Clerk admin verification middleware
import { clerkClient } from '@clerk/clerk-sdk-node';

export async function verifyAdminToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      // ignore and fall through to JWT verify
    }

    // 2) Try verifying as a JWT (e.g., template token)
    if (!userId) {
      try {
        const verified = await clerkClient.verifyToken(token, {
          template: process.env.CLERK_JWT_TEMPLATE_NAME || undefined
        });
        userId = verified.sub;
      } catch (e) {
        // still invalid
      }
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized - Invalid token' });
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
