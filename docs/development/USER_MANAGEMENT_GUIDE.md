# User Management Guide

## Overview

The User Access Management system provides comprehensive tools for managing users, their roles, and dashboard access permissions through the `/admin/dashboard` interface.

## Features

### 1. User List View
- **Search**: Find users by email, first name, or last name
- **Filters**: 
  - Role filter (All, Users Only, Admins Only)
  - Access filter (All, Demo Only, Real Only)
- **Stats Dashboard**: View total users, admins, real access, and demo access counts
- **Refresh**: Manually reload user data from Clerk

### 2. Individual User Management

#### Update Role
- **User**: Standard user with no admin privileges
- **Admin**: Full administrative access to the dashboard
- **Protection**: Cannot change your own role

#### Update Dashboard Access
- **Demo**: Access to demo dashboard with sample data only
- **Real**: Access to real dashboard with live solar data

#### Delete User
- Remove a user completely from the system
- **Protection**: Cannot delete your own account
- Requires confirmation before deletion

### 3. Bulk Actions
- **Select Multiple Users**: Use checkboxes to select users
- **Bulk Access Update**: Change dashboard access for multiple users at once
  - Set Demo Access for all selected users
  - Set Real Access for all selected users
- **Select All**: Checkbox in header to select/deselect all filtered users

## User Roles

### User Role
- Can access dashboards based on their `dashboardAccess` level
- Cannot access admin dashboard
- Cannot manage other users

### Admin Role
- Full access to all dashboards (real and demo)
- Can access `/admin/dashboard`
- Can manage all users (except their own role)
- Can update user roles and access levels
- Can delete users (except themselves)

## Dashboard Access Levels

### Demo Access
- Access to `/demodashbaard` (demo dashboard)
- Shows sample/mock data
- Safe for testing and exploration
- No real data modifications

### Real Access
- Access to `/dashboard` (real dashboard)
- Shows live solar panel data
- Real-time updates from API
- Can modify settings and configurations

## API Endpoints

### GET /api/admin/users
- Lists all users with their metadata
- Requires admin authentication
- Returns: user ID, email, name, role, access level, creation date

### GET /api/admin/users/[userId]
- Get specific user details
- Requires admin authentication

### PATCH /api/admin/users/[userId]
- Update user role or dashboard access
- Requires admin authentication
- Body: `{ role?: 'user' | 'admin', dashboardAccess?: 'demo' | 'real' }`

### DELETE /api/admin/users/[userId]
- Delete a user from the system
- Requires admin authentication
- Cannot delete yourself

## Security

### Authentication
All admin API endpoints are protected by:
1. **Clerk Session Verification**: Valid user session required
2. **Admin Role Check**: User must have `publicMetadata.role === 'admin'`
3. **Authorization Header**: Bearer token from Clerk required

### Self-Protection
- Admins cannot change their own role (prevents accidental demotion)
- Admins cannot delete their own account (prevents lockout)

### Error Handling
- **401 Unauthorized**: Not logged in → redirects to login
- **403 Forbidden**: Logged in but not admin → shows error
- **500 Internal Server Error**: Server-side error → shows error message

## Usage Examples

### Scenario 1: Grant Real Access to a User
1. Navigate to `/admin/dashboard`
2. Click "User Access" tab
3. Find the user in the list
4. Click the dropdown under "Dashboard Access"
5. Select "Real"
6. User will have real access on next login

### Scenario 2: Promote User to Admin
1. Navigate to `/admin/dashboard`
2. Click "User Access" tab
3. Find the user in the list
4. Click the dropdown under "Role"
5. Select "Admin"
6. User will have admin access on next login

### Scenario 3: Bulk Update Multiple Users
1. Navigate to `/admin/dashboard`
2. Click "User Access" tab
3. Use filters to narrow down users (e.g., "Demo Only")
4. Check the boxes for users you want to update
5. Click "Set Real Access" in the bulk actions bar
6. Confirm the action
7. All selected users updated at once

### Scenario 4: Find and Remove Inactive User
1. Navigate to `/admin/dashboard`
2. Click "User Access" tab
3. Search for user by email or name
4. Click the 🗑️ (delete) icon
5. Confirm deletion
6. User is permanently removed

## Best Practices

### User Management
- Regularly review user list and remove inactive accounts
- Use demo access for new users until they're verified
- Limit admin roles to trusted individuals only
- Document role changes in your own records

### Security
- Never share your admin credentials
- Log out when not using the admin dashboard
- Monitor the admin user list regularly
- Use strong passwords for admin accounts

### Access Control
- Start new users with demo access
- Upgrade to real access only after verification
- Revoke access immediately when no longer needed
- Use bulk actions for efficiency when managing many users

## Troubleshooting

### "Failed to fetch users"
- Check network connection
- Verify API endpoints are deployed
- Ensure `CLERK_SECRET_KEY` is set in environment variables
- Check browser console for detailed errors

### "You are not authorized"
- Verify your account has admin role
- Try logging out and back in
- Contact another admin if locked out

### Changes Not Reflecting
- Users must log out and back in for role/access changes to take effect
- Clerk caches user metadata until next session
- Refresh the user list to see latest data

### Cannot Update Own Role
- This is by design for security
- Ask another admin to update your role
- Or use Clerk dashboard directly

## Technical Details

### Data Storage
- User data stored in Clerk
- Roles and access in `publicMetadata`
- No Supabase integration needed for user management

### Metadata Structure
```json
{
  "role": "admin" | "user",
  "dashboardAccess": "real" | "demo"
}
```

### Frontend Component
- Location: `src/components/admin/UserAccessManagement.jsx`
- Uses Clerk React hooks (`useUser`)
- React state for local management
- Optimistic UI updates

### Backend API
- Location: `api/admin/users/[userId].js`
- Uses `@clerk/clerk-sdk-node`
- Middleware: `api/middleware/verifyAdminToken.js`
- Serverless function on Vercel

## Future Enhancements

Potential features for future development:
- [ ] User activity logs and audit trail
- [ ] Email notifications for role changes
- [ ] User profile editing (name, etc.)
- [ ] Export user list to CSV
- [ ] Advanced filtering (date ranges, last login)
- [ ] User statistics and analytics
- [ ] Batch user import
- [ ] Role-based permissions beyond admin/user
