# User Access Management Setup Guide

## Overview

The User Access Management system allows admins to control:
- **User Roles**: `admin` or `user`
- **Dashboard Access**: `real` (real dashboard) or `demo` (demo dashboard only)

## Features Implemented

### 1. Admin Dashboard - User Access Tab
- View all registered users
- Search by email or name
- Statistics dashboard (Total, Admins, Real Access, Demo Access)
- Inline editing of roles and access levels
- Real-time updates

### 2. Backend API Endpoints

#### `GET /api/admin/users`
Fetch all users from Clerk with metadata

#### `GET /api/admin/users/[userId]`
Get specific user details

#### `PATCH /api/admin/users/[userId]`
Update user metadata:
```json
{
  "role": "admin" | "user",
  "dashboardAccess": "real" | "demo"
}
```

## Setup Instructions

### 1. Configure Clerk Public Metadata Schema

In your Clerk Dashboard:

1. Go to **Configure** → **Sessions** → **Customize session token**

2. Add these fields to **Public Metadata**:

```json
{
  "role": "{{user.public_metadata.role}}",
  "dashboardAccess": "{{user.public_metadata.dashboardAccess}}"
}
```

3. Set default values for new users:
   - Go to **Configure** → **Email & SMS** → **Email verification**
   - Enable "Email verification required"
   - After sign-up, default metadata:
     ```json
     {
       "role": "user",
       "dashboardAccess": "demo"
     }
     ```

### 2. Set Up Clerk Webhook (Optional)

To automatically set default metadata on user creation:

1. Go to **Configure** → **Webhooks** → **Add Endpoint**

2. Endpoint URL: `https://your-domain.vercel.app/api/webhooks/clerk`

3. Subscribe to: `user.created`

4. Create webhook handler:

```javascript
// api/webhooks/clerk.js
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/clerk-sdk-node';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  const wh = new Webhook(WEBHOOK_SECRET);
  
  let evt;
  try {
    evt = wh.verify(JSON.stringify(req.body), {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature
    });
  } catch (err) {
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  if (evt.type === 'user.created') {
    const userId = evt.data.id;
    
    // Set default metadata for new users
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        role: 'user',
        dashboardAccess: 'demo'
      }
    });
  }

  res.status(200).json({ received: true });
}
```

### 3. Environment Variables

Add to your `.env` file:

```env
# Clerk (already exists)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_USE_CLERK_AUTH=true

# Clerk Webhook (optional)
CLERK_WEBHOOK_SECRET=whsec_...
```

### 4. Deploy API Endpoints

The API files are in `/api/admin/`:
- `users.js` - List all users
- `users/[userId].js` - Get/Update specific user

Deploy to Vercel (auto-deployed with your project).

## Usage

### For Admins:

1. **Access User Management**:
   - Go to Admin Dashboard (`/admin/dashboard`)
   - Click "User Access" tab

2. **View All Users**:
   - See list of all registered users
   - Search by email or name
   - View statistics

3. **Grant Real Dashboard Access**:
   - Find user in list
   - Change "Dashboard Access" dropdown from "Demo" to "Real"
   - User can now access real dashboard

4. **Promote to Admin**:
   - Find user in list
   - Change "Role" dropdown from "User" to "Admin"
   - User can now access admin panel

### For Users:

**Demo User Flow:**
1. Sign up at `/signup`
2. Auto-assigned `role: user`, `dashboardAccess: demo`
3. Redirected to demo dashboard
4. Can request real access via banner button

**After Admin Grants Real Access:**
1. Login redirects to real dashboard
2. Can access live data and settings
3. Logout button available in sidebar

## Testing

### 1. Test with Mock Data

Currently, the UserAccessManagement component shows mock data if API is not available. This allows you to:
- See the UI and layout
- Test search functionality
- Understand the workflow

### 2. Test with Real Clerk API

Once deployed:
1. Create test users in Clerk Dashboard
2. Manually set public metadata
3. Test in admin panel

### 3. Verify Access Levels

**Test Demo User:**
```bash
# Create user in Clerk with metadata:
{
  "role": "user",
  "dashboardAccess": "demo"
}
# Login → Should redirect to /access
```

**Test Real User:**
```bash
# Update user metadata in admin panel
# Login → Should redirect to /dashboard
```

**Test Admin User:**
```bash
# Update user metadata:
{
  "role": "admin",
  "dashboardAccess": "real"
}
# Login → Should redirect to /admin/dashboard
```

## Security Notes

1. **Admin Verification**: The API currently trusts the Bearer token. In production, add proper admin role verification:

```javascript
// Verify admin status
const sessionClaims = await clerkClient.sessions.verifyToken(token);
const user = await clerkClient.users.getUser(sessionClaims.sub);

if (user.publicMetadata?.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden - Admin access required' });
}
```

2. **Rate Limiting**: Add rate limiting to admin endpoints

3. **Audit Logging**: Log all user access changes

## Troubleshooting

### Issue: "Failed to fetch users"
- **Solution**: Check Clerk API keys in `.env`
- Verify `CLERK_SECRET_KEY` is set
- Check API endpoint is deployed

### Issue: "Failed to update user access"
- **Solution**: Verify user has admin role
- Check network tab for API errors
- Ensure publicMetadata is enabled in Clerk

### Issue: Changes not reflecting
- **Solution**: Clerk metadata updates are near-instant but may need page refresh
- User should logout and login again to see new access level
- Check AuthContext is reading publicMetadata correctly

## Future Enhancements

- [ ] Bulk user operations (grant access to multiple users)
- [ ] User activity logs
- [ ] Email notifications when access is granted
- [ ] Custom access levels (viewer, editor, admin)
- [ ] Time-limited access (trial periods)
- [ ] User invitation system
- [ ] Access request approval workflow

## API Response Examples

### List Users Response:
```json
{
  "users": [
    {
      "id": "user_123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "dashboardAccess": "demo",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### Update User Response:
```json
{
  "success": true,
  "message": "User updated successfully",
  "metadata": {
    "role": "user",
    "dashboardAccess": "real"
  }
}
```
