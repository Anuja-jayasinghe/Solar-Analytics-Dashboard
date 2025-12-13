/**
 * Admin User List API
 * Get all users for admin management
 */


import { clerkClient } from '@clerk/clerk-sdk-node';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin session and role
    const adminUser = await verifyAdminToken(req, res);
    if (!adminUser) return; // Response already sent

    // Get all users from Clerk
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
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt
    }));

    return res.status(200).json({ users, total: users.length });
  } catch (error) {
    console.error('Admin API Error:', {
      message: error?.message,
      stack: error?.stack
    });

    // Surface detailed debug info to help diagnose 500s (do not include secrets)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      debug: {
        hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
        clerkTemplate: process.env.CLERK_JWT_TEMPLATE_NAME || null
      }
    });
  }
}
