/**
 * Admin User Management API
 * Manages user roles and dashboard access using Clerk
 */


// clerkClient now comes from the middleware, which builds it with @clerk/backend's
// createClerkClient. @clerk/clerk-sdk-node is deprecated by the vendor and carried a critical
// authorization-bypass advisory.
import { verifyAdminToken, clerkClient } from '../../_lib/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../../_lib/httpSecurity.js';
import { validateUserPatch } from '../../_lib/userMetadataRules.js';

// Clerk returns at most 100 users per call. Page through them rather than silently dropping the rest.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function toUserSummary(user) {
  return {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.publicMetadata?.role || 'user',
    dashboardAccess: user.publicMetadata?.dashboardAccess || 'demo',
    createdAt: user.createdAt
  };
}

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return;

  try {
    // Verify admin session and role
    const adminUser = await verifyAdminToken(req, res);
    if (!adminUser) return; // Response already sent

    const { userId } = req.query;

    if (req.method === 'GET') {
      // GET /api/admin/users - List all users
      if (!userId) {
        const users = [];
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const { data, totalCount } = await clerkClient.users.getUserList({
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            orderBy: '-created_at'
          });
          users.push(...data.map(toUserSummary));
          if (data.length < PAGE_SIZE || users.length >= totalCount) break;
        }

        return res.status(200).json({ users });
      }

      // GET /api/admin/users/[userId] - Get specific user
      const user = await clerkClient.users.getUser(userId);

      return res.status(200).json(toUserSummary(user));
    }

    if (req.method === 'PATCH') {
      // PATCH /api/admin/users/[userId] - Update user metadata
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const validation = validateUserPatch(req.body, {
        targetUserId: userId,
        actingUserId: adminUser.id
      });
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      // Merge into the existing metadata so unrelated keys (e.g. accessGrantedDate) survive.
      const user = await clerkClient.users.getUser(userId);
      const updatedMetadata = { ...(user.publicMetadata || {}), ...validation.updates };

      // Update user in Clerk
      await clerkClient.users.updateUser(userId, {
        publicMetadata: updatedMetadata
      });

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        metadata: updatedMetadata
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
    console.error('Admin API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
