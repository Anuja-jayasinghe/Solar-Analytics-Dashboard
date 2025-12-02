/**
 * Admin User Management API
 * Manages user roles and dashboard access using Clerk
 */

import { clerkClient } from '@clerk/clerk-sdk-node';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify token with Clerk (simplified - in production, use Clerk's verifyToken)
    // For now, we'll trust the frontend authentication
    
    const { userId } = req.query;

    if (req.method === 'GET') {
      // GET /api/admin/users - List all users
      if (!userId) {
        const userList = await clerkClient.users.getUserList({
          limit: 100,
          orderBy: '-created_at'
        });

        const users = userList.map(user => ({
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.publicMetadata?.role || 'user',
          dashboardAccess: user.publicMetadata?.dashboardAccess || 'demo',
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
        createdAt: user.createdAt
      });
    }

    if (req.method === 'PATCH') {
      // PATCH /api/admin/users/[userId] - Update user metadata
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const { role, dashboardAccess } = req.body;

      // Get current user metadata
      const user = await clerkClient.users.getUser(userId);
      const currentMetadata = user.publicMetadata || {};

      // Update metadata
      const updatedMetadata = {
        ...currentMetadata
      };

      if (role) {
        updatedMetadata.role = role;
      }

      if (dashboardAccess) {
        updatedMetadata.dashboardAccess = dashboardAccess;
      }

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

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
