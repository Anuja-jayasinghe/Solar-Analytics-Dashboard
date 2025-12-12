# Local Auth Dev Tools - Quick Start Guide

## 🚀 Installation (2 minutes)

### Step 1: Add Import to App.jsx
```jsx
import LocalAuthDevTools from './components/LocalAuthDevTools';
```

### Step 2: Add Component to Your App
In `src/App.jsx`, add this line to your main render (at the end before closing tags):

```jsx
export default function App() {
  return (
    <>
      {/* ... existing routes and content ... */}
      
      {/* Add this line - only appears in development */}
      <LocalAuthDevTools />
    </>
  );
}
```

### Step 3: Start Development Server
```bash
npm run dev
```

## ✨ What You Get

### 🔧 Dev Tools Panel (Bottom Right)
- Green button labeled "🔧 Local Auth"
- Click to expand/collapse
- Gradient purple panel with controls

### 📊 Current State Display
Shows your current login state:
- Email
- Role (admin/user) - color coded
- Access level (real/demo) - color coded

### 👥 Role Management
Two buttons:
- **👑 Admin** - Switch to admin role
- **👤 User** - Switch to user role

### 📊 Dashboard Access
Two buttons:
- **✅ Real** - Grant real data access
- **🧪 Demo** - Switch to demo mode

### ⚡ Quick Test Users
Pre-configured users for fast testing:
- **👑 Admin (Real)** - Admin with real data access
- **👤 User (Real)** - Regular user with real data access
- **🧪 User (Demo)** - Regular user with demo access
- **👑 Admin (Demo)** - Admin with demo access

### 🛠️ Utilities
- **🐛 Debug Console** - Logs auth state to browser console
- **🔄 Reset Auth** - Clears all local auth and reloads

---

## 💡 Console Access (Advanced)

In browser console (F12), access auth tools directly:

```javascript
// Check current auth state
window.__LOCAL_AUTH__.state()

// Quick role changes
window.__LOCAL_AUTH__.setRole('admin')
window.__LOCAL_AUTH__.setRole('user')

// Quick access changes
window.__LOCAL_AUTH__.setAccess('real')
window.__LOCAL_AUTH__.setAccess('demo')

// Create custom test users
window.__LOCAL_AUTH__.createTestUser({
  email: 'custom@example.com',
  firstName: 'Custom',
  lastName: 'User',
  role: 'admin',
  dashboardAccess: 'real'
})

// Pre-configured users
window.__LOCAL_AUTH__.TEST_USERS.ADMIN_REAL()
window.__LOCAL_AUTH__.TEST_USERS.USER_DEMO()

// Clear everything
window.__LOCAL_AUTH__.clear()

// Debug info
window.__LOCAL_AUTH__.debug()
```

---

## 🧪 Testing Scenarios

### Test 1: Admin Dashboard Access
1. Click **👑 Admin (Real)** in Dev Tools
2. Navigate to `/admin` or `/admin-dashboard`
3. Verify admin features are visible
4. Click **👤 User** to demote
5. Verify admin features are hidden

### Test 2: Demo vs Real Access
1. Click **✅ Real** button
2. Verify you can see real dashboard data
3. Click **🧪 Demo** button
4. Verify demo banners appear

### Test 3: Admin Role Management
1. Click **👑 Admin (Real)**
2. Navigate to admin dashboard → Admin Roles tab
3. Verify admin controls are visible
4. Search and filter users
5. Test promote/demote functionality

### Test 4: User Access Management
1. Click **👑 Admin (Real)**
2. Navigate to admin dashboard → User Access tab
3. Verify user list appears
4. Test individual access toggles
5. Test bulk operations

### Test 5: Role/Access Combinations
Test all 4 combinations:
- Admin + Real: Full access to everything
- Admin + Demo: Admin controls with demo data only
- User + Real: Dashboard only with real data
- User + Demo: Dashboard only with demo data

---

## 🔄 Development Workflow

### Your New Workflow
```
1. npm run dev → Vite starts on localhost:5173
2. Open http://localhost:5173 in browser
3. Dev Tools Panel visible in bottom-right
4. Click "🔧 Local Auth" to expand
5. Use buttons to test different user scenarios
6. Make code changes
7. Browser auto-reloads
8. Test continues with same user role/access
9. Repeat steps 5-8 as needed
10. NO DEPLOYMENT NEEDED ✅
```

### Before (Old Way)
```
Make changes → Deploy to Vercel → Wait 2-3 min → Test → Repeat
```

### After (New Way)
```
Make changes → Auto-reload → Test instantly → Repeat
```

---

## 🎯 Testing Admin Dashboard Refactoring

Perfect for testing your newly refactored admin components!

### User Access Management Tab
1. Set role to **👑 Admin (Real)**
2. Go to Admin Dashboard → User Access tab
3. Test the new features:
   - ✅ Search by email/name
   - ✅ Filter by role and access level
   - ✅ Individual access toggles
   - ✅ Multi-select checkboxes
   - ✅ Bulk operations

### Admin Roles Tab
1. Click **👑 Admin (Real)**
2. Go to Admin Dashboard → Admin Roles tab
3. Test the new features:
   - ✅ Separate admin/user sections
   - ✅ Promote/demote functionality
   - ✅ Search and filtering
   - ✅ Real-time stats

### Test Multiple Roles
1. Click **👤 User** to become regular user
2. Verify admin tabs are hidden/disabled
3. Click **👑 Admin** to restore access
4. Verify admin tabs are visible again

---

## ⚙️ How It Works

### Local Auth System
- **Storage:** Browser localStorage (key: `__LOCAL_AUTH__`)
- **Persistence:** Survives page reloads (until you click Reset)
- **Scope:** Development mode only (`import.meta.env.MODE === 'development'`)
- **Events:** Dispatches `local-auth-change` event when auth updates

### No Real Clerk Calls
- All authentication is simulated locally
- No real tokens generated
- No API calls to Clerk servers
- Useful for UI/UX testing only

### Integration Points
- Dev Tools Panel is completely isolated
- Doesn't interfere with actual Clerk integration
- Only active when `VITE_USE_CLERK_AUTH=true` AND in development

---

## 🔒 Security Notes

⚠️ **This is development-only!**
- Dev Tools Panel only visible when `import.meta.env.MODE === 'development'`
- Cannot be used in production builds
- localStorage is browser-specific (not synced)
- Sessions don't persist across browser tabs

---

## 📋 Troubleshooting

### Panel Not Showing?
```
1. Verify npm run dev is running
2. Check browser console for errors: F12
3. Ensure App.jsx imports LocalAuthDevTools
4. Check that IS_LOCAL_DEV = true in console
```

### Buttons Not Working?
```
1. Open browser console: F12
2. Check for JavaScript errors
3. Type: window.__LOCAL_AUTH__ 
4. Should see object with methods
5. If undefined, Dev Tools not loaded properly
```

### Changes Not Persisting?
```
1. Check localStorage: F12 → Application → Storage
2. Look for __LOCAL_AUTH__ key
3. Should contain user data
4. If empty, refresh page
```

### Need to Debug?
```
Press F12 to open console, then:
  window.__LOCAL_AUTH__.debug()
  
This logs full auth state to console.
```

---

## 🎨 Customization

### Change Default User
Edit `src/lib/localAuth.js`:

```javascript
const DEFAULT_MOCK_USER = {
  id: 'user_local_dev_' + Math.random().toString(36).substr(2, 9),
  primaryEmailAddress: { emailAddress: 'YOUR_EMAIL@example.com' },  // ← Change this
  firstName: 'YOUR',  // ← Change this
  lastName: 'NAME',   // ← Change this
  publicMetadata: {
    role: 'admin',           // ← Change this (admin/user)
    dashboardAccess: 'real'  // ← Change this (real/demo)
  }
};
```

### Add Custom Test User
In `src/lib/localAuth.js`, add to TEST_USERS:

```javascript
export const TEST_USERS = {
  // ... existing users ...
  
  CUSTOM_USER: () => createTestUser({
    email: 'custom@example.com',
    firstName: 'Custom',
    lastName: 'User',
    role: 'admin',
    dashboardAccess: 'real'
  })
};
```

Then use in panel or console:
```javascript
window.__LOCAL_AUTH__.TEST_USERS.CUSTOM_USER()
```

---

## ✅ Next Steps

1. **Integrate Now:** Add `<LocalAuthDevTools />` to App.jsx
2. **Test the Panel:** Run `npm run dev` and verify panel appears
3. **Test Admin Dashboard:** Use pre-configured test users to test your refactored components
4. **Iterate Fast:** Make changes and test instantly without deployments
5. **When Ready:** Test with Option 1 (Ngrok) for real Clerk authentication

---

## 📚 Related Documentation

- `LOCAL_CLERK_DEVELOPMENT.md` - Full guide with all 3 options
- `ADMIN_DASHBOARD_REFACTORING.md` - What changed in admin dashboard
- `ADMIN_DASHBOARD_QUICK_GUIDE.md` - How to use the new admin dashboard

---

**Happy testing! 🎉 No more deployments for auth testing!**
