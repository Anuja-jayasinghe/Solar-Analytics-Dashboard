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
    // Verify the session token with Clerk
    const session = await clerkClient.sessions.verifySession(token);
    if (!session || !session.userId) {
      res.status(401).json({ error: 'Unauthorized - Invalid session' });
      return null;
    }
    // Fetch the user and check admin role
    const user = await clerkClient.users.getUser(session.userId);
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
