/**
 * Admin User Management API
 * Manages user roles and dashboard access using Clerk
 */


// clerkClient now comes from the middleware, which builds it with @clerk/backend's
// createClerkClient. @clerk/clerk-sdk-node is deprecated by the vendor and carried a critical
// authorization-bypass advisory.
import { verifyAdminToken, clerkClient } from '../../_lib/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../../_lib/httpSecurity.js';
import { accessLevelFromMetadata, validateAccessPatch } from '../../../shared/domain/access.js';

export default async function handler(req, res) {
  // POST was listed here but never implemented (it fell through to 405); removed.
  if (handlePreflightAndMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return;

  try {
    // Verify admin session and role
    const adminUser = await verifyAdminToken(req, res);
    if (!adminUser) return; // Response already sent

    const { userId } = req.query;

    if (req.method === 'GET') {
      // GET /api/admin/users - List all users
      if (!userId) {
        const userList = await clerkClient.users.getUserList({
          limit: 100,
          orderBy: '-created_at'
        });

        const users = userList.data.map(user => ({
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.publicMetadata?.role || 'user',
          dashboardAccess: user.publicMetadata?.dashboardAccess || 'demo',
          accessLevel: accessLevelFromMetadata(user.publicMetadata),
          createdAt: user.createdAt
        }));

        return res.status(200).json({ users });
      }

      // GET /api/admin/users/[userId] - Get specific user
      const user = await clerkClient.users.getUser(userId);
      
      return res.status(200).json({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.publicMetadata?.role || 'user',
        dashboardAccess: user.publicMetadata?.dashboardAccess || 'demo',
        accessLevel: accessLevelFromMetadata(user.publicMetadata),
        createdAt: user.createdAt
      });
    }

    if (req.method === 'PATCH') {
      // PATCH /api/admin/users/[userId] - Update user metadata
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Only known role / dashboardAccess values pass, and an admin cannot strip their own admin
      // role (shared/domain/access.js). Unknown keys in the body are ignored, never merged.
      const check = validateAccessPatch(req.body, { actorId: adminUser.id, targetId: userId });
      if (!check.ok) {
        return res.status(check.status).json({ error: check.error });
      }

      // Merge into the current metadata; Clerk deletes a key whose value is null.
      const user = await clerkClient.users.getUser(userId);
      const updatedMetadata = { ...(user.publicMetadata || {}), ...check.patch };

      await clerkClient.users.updateUser(userId, {
        publicMetadata: updatedMetadata
      });

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        metadata: updatedMetadata,
        accessLevel: accessLevelFromMetadata(updatedMetadata)
      });
    }

    if (req.method === 'DELETE') {
      // DELETE /api/admin/users/[userId] - Delete user
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Prevent admin from deleting themselves
      if (userId === adminUser.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      // Delete user from Clerk
      await clerkClient.users.deleteUser(userId);

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    // Log the detail, return none of it: Clerk error text is not for the caller.
    console.error('Admin API Error:', error?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
