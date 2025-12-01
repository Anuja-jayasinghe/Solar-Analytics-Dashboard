# Clerk Migration Preparation Checklist

**Created:** November 30, 2025  
**Status:** Pre-Migration Planning  
**Goal:** Ensure seamless transition from Supabase Auth to Clerk

---

## 📋 Table of Contents
1. [Phase 0: Infrastructure Setup (No Code Changes)](#phase-0-infrastructure-setup)
2. [Phase 1: Data Audit & Backup](#phase-1-data-audit--backup)
3. [Phase 2: Parallel Implementation](#phase-2-parallel-implementation)
4. [Phase 3: Feature Parity Verification](#phase-3-feature-parity-verification)
5. [Phase 4: Migration Scripts & Testing](#phase-4-migration-scripts--testing)
6. [Phase 5: Cutover Strategy](#phase-5-cutover-strategy)
7. [Rollback Plan](#rollback-plan)

---

## Phase 0: Infrastructure Setup (No Code Changes)

### ✅ Already Completed
- [x] Clerk packages installed in `package.json`:
  - `@clerk/clerk-react`: ^5.56.0
  - `@clerk/clerk-sdk-node`: ^5.1.6

### 🎯 Clerk Account Configuration

#### Step 1: Create Clerk Application
- [ ] Sign up at https://clerk.com
- [ ] Create application: "Solar Analytics Dashboard"
- [ ] Select application type: **Production** (or Development for testing)

#### Step 2: Configure Authentication Methods
Enable in Clerk Dashboard → User & Authentication → Email, Phone, Username:
- [x] **Email address** (Required)
- [x] **Password** (Optional but recommended for migration parity)
- [ ] **Email verification** (Recommended: Verification code)
- [ ] **Magic links** (Optional: Better UX, no password needed)
- [ ] **Social OAuth** (Optional):
  - [ ] Google
  - [ ] GitHub
  - [ ] Microsoft

**Recommended Configuration:**
```
Primary: Email + Password (for existing users)
Alternative: Email Magic Links (for new users, better UX)
Verification: Email verification code (faster than link)
```

#### Step 3: Configure Session Settings
In Clerk Dashboard → Sessions:
```
Session lifetime: 30 days (2592000 seconds)
Inactivity timeout: 30 days (2592000 seconds)
Multi-session handling: Single session per user
Require re-authentication for sensitive actions: Enabled
```

#### Step 4: Set Up User Metadata Schema
In Clerk Dashboard → Customization → User Metadata:

**Public Metadata** (accessible to frontend):
```json
{
  "dashboardAccess": "demo" | "real",
  "role": "user" | "admin",
  "accessGrantedDate": "ISO-8601 date string",
  "migratedFromSupabase": true
}
```

**Private Metadata** (backend-only):
```json
{
  "supabaseUserId": "original UUID from auth.users",
  "originalSignupDate": "ISO-8601 date string",
  "lastAccessUpgrade": "ISO-8601 date string",
  "migrationNotes": "any special migration info"
}
```

**Unsafe Metadata** (can be updated from frontend with proper permissions):
```json
{
  "preferences": {
    "theme": "dark" | "light",
    "notifications": true | false
  }
}
```

#### Step 5: Configure Paths & Redirects
In Clerk Dashboard → Paths:
```
Sign-in URL: /login
Sign-up URL: /signup
Home URL: / (landing page)
After sign-in redirect: Dynamic (controlled by code)
After sign-up redirect: /welcome
User profile URL: /settings
```

#### Step 6: Set Up Environment Variables
Create `.env.clerk` file (don't commit):
```bash
# Clerk API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Clerk Frontend API
VITE_CLERK_FRONTEND_API=clerk.your-domain.com

# Optional: Clerk JWT Template Name (for API auth)
CLERK_JWT_TEMPLATE_NAME=supabase
```

Add to `.env`:
```bash
# Keep Supabase for now (parallel operation)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx

# Add Clerk keys
VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY}

# Feature flag for migration
VITE_USE_CLERK_AUTH=false  # Will flip to true during migration
```

#### Step 7: Configure Clerk Webhooks (for sync)
In Clerk Dashboard → Webhooks:
- [ ] Create webhook endpoint: `https://your-domain.com/api/clerk-webhook`
- [ ] Subscribe to events:
  - [x] `user.created`
  - [x] `user.updated`
  - [x] `user.deleted`
  - [x] `session.created`
  - [x] `session.ended`
- [ ] Set signing secret in `.env`: `CLERK_WEBHOOK_SECRET=whsec_xxxxx`

---

## Phase 1: Data Audit & Backup

### 🔍 Current System Analysis

#### Inventory Current Auth Implementation
- [x] **Auth Context:** `src/contexts/AuthContext.jsx`
  - Uses Supabase `auth.getSession()`
  - Custom `checkAdmin()` function with retry logic
  - Admin cache (Map) for 5-minute TTL
  - Visibility change handler for tab refresh
  
- [x] **Auth Usage:** Found in 20+ files
  - `src/App.jsx`: Route protection with `RequireAdmin`
  - `src/pages/AdminLogin.jsx`: OAuth login flow
  - `src/pages/AdminDashboard.jsx`: Admin-only page
  - API routes (need to audit)

- [x] **Protected Routes:**
  - `/admin` - Admin login page
  - `/admin/dashboard` - Admin dashboard (requires admin role)
  - `/dashboard` - Main dashboard (requires any auth)
  - `/settings` - User settings (requires any auth)

#### Database Schema Audit

**Tables to Export:**
```sql
-- 1. Export all users from Supabase auth
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at;
-- Save as: supabase_users_export_YYYYMMDD.csv

-- 2. Export admin users list
SELECT 
  id,
  email,
  created_at,
  updated_at
FROM admin_users
ORDER BY created_at;
-- Save as: admin_users_export_YYYYMMDD.csv

-- 3. Check for any user preferences/settings
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%user%' 
  OR table_name LIKE '%profile%';
-- Document any additional user-related tables
```

**API Logs/Audit Trail:**
```sql
-- Export recent API logs for baseline
SELECT *
FROM api_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
-- Save as: api_logs_baseline_YYYYMMDD.csv
```

### 📦 Create Backups

#### Step 1: Export User Data
```bash
# Run from project root
node scripts/export-users.js

# This should create:
# - backups/supabase_users_YYYYMMDD.json
# - backups/admin_users_YYYYMMDD.json
# - backups/user_metadata_YYYYMMDD.json
```

#### Step 2: Backup Current Authentication Code
```bash
# Create backup branch
git checkout -b backup/supabase-auth
git add .
git commit -m "Backup: Supabase auth before Clerk migration"
git push origin backup/supabase-auth

# Return to main branch
git checkout main
```

#### Step 3: Document Current User Counts
```sql
-- Record baseline metrics
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as confirmed_users,
  COUNT(*) FILTER (WHERE last_sign_in_at >= NOW() - INTERVAL '30 days') as active_30d,
  COUNT(*) FILTER (WHERE last_sign_in_at >= NOW() - INTERVAL '7 days') as active_7d
FROM auth.users;

-- Record admin count
SELECT COUNT(*) as admin_count FROM admin_users;
```

**Save to:** `docs/migration/USER_COUNTS_BASELINE.md`

#### Step 4: Test Data Restoration
- [ ] Verify exported JSON files are valid
- [ ] Test import script on development Supabase instance
- [ ] Confirm data integrity (all emails, dates preserved)

---

## Phase 2: Parallel Implementation

### 🏗️ Create Abstraction Layer

**Goal:** Abstract authentication so we can switch between Supabase and Clerk with a feature flag.

#### Step 1: Create Auth Adapter Interface
**File:** `src/lib/auth/AuthAdapter.js`

```javascript
/**
 * Abstract auth interface
 * Implementations: SupabaseAuthAdapter, ClerkAuthAdapter
 */
export class AuthAdapter {
  async getCurrentUser() { throw new Error('Not implemented'); }
  async signIn(email, password) { throw new Error('Not implemented'); }
  async signUp(email, password) { throw new Error('Not implemented'); }
  async signOut() { throw new Error('Not implemented'); }
  async getSession() { throw new Error('Not implemented'); }
  async checkIsAdmin(user) { throw new Error('Not implemented'); }
  async refreshSession() { throw new Error('Not implemented'); }
  onAuthStateChange(callback) { throw new Error('Not implemented'); }
}
```

#### Step 2: Implement Supabase Adapter
**File:** `src/lib/auth/SupabaseAuthAdapter.js`

- [ ] Wrap existing Supabase auth logic
- [ ] Keep all current retry/caching logic
- [ ] Ensure 100% feature parity with current `AuthContext`

#### Step 3: Implement Clerk Adapter
**File:** `src/lib/auth/ClerkAuthAdapter.js`

- [ ] Implement using `@clerk/clerk-react` hooks
- [ ] Map Clerk user metadata to match Supabase structure
- [ ] Handle admin check via public metadata
- [ ] Implement session refresh (automatic with Clerk)

#### Step 4: Create Auth Factory
**File:** `src/lib/auth/AuthFactory.js`

```javascript
import { SupabaseAuthAdapter } from './SupabaseAuthAdapter';
import { ClerkAuthAdapter } from './ClerkAuthAdapter';

export function createAuthAdapter() {
  const useClerk = import.meta.env.VITE_USE_CLERK_AUTH === 'true';
  return useClerk ? new ClerkAuthAdapter() : new SupabaseAuthAdapter();
}
```

#### Step 5: Update AuthContext to Use Adapter
**File:** `src/contexts/AuthContext.jsx`

- [ ] Import `createAuthAdapter()`
- [ ] Replace direct Supabase calls with adapter methods
- [ ] Keep same API surface (no changes for consumers)
- [ ] Add feature flag check

### 🔒 Implement Route Guards

#### Guard 1: PublicRoute
**File:** `src/components/guards/PublicRoute.jsx`

```javascript
/**
 * Redirects authenticated real-access users away from public pages
 * Usage: Landing page, login, signup
 */
```

- [ ] Check if user is authenticated
- [ ] Check if `dashboardAccess === "real"`
- [ ] Redirect to `/dashboard` if both true
- [ ] Otherwise render children

#### Guard 2: AuthRequired
**File:** `src/components/guards/AuthRequired.jsx`

```javascript
/**
 * Requires any authenticated user
 * Usage: Welcome page, settings
 */
```

- [ ] Check if user is authenticated
- [ ] Redirect to `/login` if not
- [ ] Otherwise render children

#### Guard 3: RealDashboardRoute
**File:** `src/components/guards/RealDashboardRoute.jsx`

```javascript
/**
 * Requires dashboardAccess === "real"
 * Usage: Main dashboard with real data
 */
```

- [ ] Check if user is authenticated
- [ ] Check if `dashboardAccess === "real"`
- [ ] Redirect demo users to `/demo-dashboard`
- [ ] Redirect unauthenticated to `/login`

#### Guard 4: AdminRoute
**File:** `src/components/guards/AdminRoute.jsx`

```javascript
/**
 * Requires role === "admin"
 * Usage: Admin dashboard
 */
```

- [ ] Check if user is authenticated
- [ ] Check if `role === "admin"`
- [ ] Redirect non-admins to `/dashboard` with 403 message
- [ ] Redirect unauthenticated to `/login`

### 🔐 Secure API Routes

#### For Each API Function:
**Files:** `api/*.js`, `functions/*/index.js`

**Pattern:**
```javascript
import { clerkClient } from '@clerk/clerk-sdk-node';

export default async function handler(req, res) {
  // 1. Extract session token from header
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  // 2. Verify token with Clerk
  try {
    const session = await clerkClient.sessions.verifySession(sessionToken);
    const user = await clerkClient.users.getUser(session.userId);
    
    // 3. Check permissions
    const isAdmin = user.publicMetadata.role === 'admin';
    const hasRealAccess = user.publicMetadata.dashboardAccess === 'real';
    
    // 4. Authorize request
    if (!hasRealAccess) {
      return res.status(403).json({ error: 'Real dashboard access required' });
    }
    
    // 5. Process request
    // ... your existing logic
    
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
```

**API Routes to Secure:**
- [ ] `api/fetch-inverter-data.js`
- [ ] `api/generate-monthly-summaries.js`
- [ ] `api/update-total-generation.js`
- [ ] `functions/fetch_live_data/index.js`
- [ ] `functions/generate_daily_summary/index.js`

---

## Phase 3: Feature Parity Verification

### ✅ Feature Checklist

#### Authentication Features
- [ ] **Email/Password Login**
  - [ ] Supabase implementation working
  - [ ] Clerk implementation tested
  - [ ] Error messages match
  - [ ] Loading states identical

- [ ] **Session Persistence**
  - [ ] Supabase: 30-day session
  - [ ] Clerk: 30-day session configured
  - [ ] Test tab close/reopen
  - [ ] Test browser restart

- [ ] **Admin Check**
  - [ ] Supabase: `admin_users` table query
  - [ ] Clerk: `publicMetadata.role === 'admin'`
  - [ ] Caching behavior matches
  - [ ] Retry logic matches

- [ ] **Session Refresh**
  - [ ] Supabase: Manual refresh on visibility
  - [ ] Clerk: Automatic token refresh
  - [ ] No unexpected logouts

- [ ] **Sign Out**
  - [ ] Supabase: Clear session, cache, state
  - [ ] Clerk: Clear session, cache, state
  - [ ] Redirect behavior matches

#### User Experience Parity
- [ ] **Loading States:** Same duration and styling
- [ ] **Error Messages:** Identical wording
- [ ] **Redirect Logic:** Same paths and conditions
- [ ] **UI Elements:** No visual differences
- [ ] **Performance:** Response times within 10% of baseline

#### Admin Features
- [ ] **Admin Detection:** Works on load and tab change
- [ ] **Admin Cache:** 5-minute TTL maintained
- [ ] **Admin Dashboard Access:** Properly blocked for non-admins
- [ ] **Admin User Management:** (New feature with Clerk)

---

## Phase 4: Migration Scripts & Testing

### 📝 User Migration Script

**File:** `scripts/migrate-users-to-clerk.js`

**Functionality:**
```javascript
// 1. Read exported user data
// 2. For each user:
//    - Create Clerk user with same email
//    - Set password (send reset email)
//    - Map metadata:
//      * Admin status → publicMetadata.role
//      * Default → publicMetadata.dashboardAccess = "demo"
//      * Store original Supabase ID in privateMetadata
//    - Handle errors (email already exists, invalid data)
// 3. Log results
// 4. Create reconciliation report
```

**Run in batches:**
- Batch 1: 1-10 users (test run)
- Batch 2: 11-50 users
- Batch 3: All remaining users

**Dry Run Mode:**
- [ ] Implement `--dry-run` flag
- [ ] Validate all users before creating
- [ ] Generate preview report

### 🧪 Testing Strategy

#### Unit Tests
**File:** `src/lib/auth/__tests__/ClerkAuthAdapter.test.js`

- [ ] Test `getCurrentUser()`
- [ ] Test `signIn()` success and failure
- [ ] Test `signOut()` cleanup
- [ ] Test `checkIsAdmin()` with different roles
- [ ] Test session refresh
- [ ] Mock Clerk SDK responses

#### Integration Tests
**File:** `tests/integration/auth-migration.test.js`

- [ ] Test full login flow (Clerk)
- [ ] Test admin dashboard access (Clerk)
- [ ] Test session persistence across page reloads
- [ ] Test parallel operation (both adapters work)
- [ ] Test feature flag switching

#### Manual Test Cases
**File:** `docs/testing/MANUAL_TEST_CASES.md`

1. **New User Signup:**
   - [ ] Sign up with email/password
   - [ ] Receive verification email
   - [ ] Verify email
   - [ ] Redirect to welcome page
   - [ ] Check default metadata (`dashboardAccess: "demo"`)

2. **Migrated User Login:**
   - [ ] Login with original email
   - [ ] Session persists after browser restart
   - [ ] Admin status preserved
   - [ ] No data loss

3. **Admin Access:**
   - [ ] Admin can access admin dashboard
   - [ ] Regular user cannot access admin dashboard
   - [ ] Proper 403 error for unauthorized

4. **Session Expiry:**
   - [ ] Session lasts 30 days
   - [ ] Automatic refresh before expiry
   - [ ] Graceful logout on hard expiry

5. **Error Handling:**
   - [ ] Network error during login
   - [ ] Invalid credentials
   - [ ] Rate limiting
   - [ ] Session expired

### 📊 Create Monitoring Dashboard

**File:** `docs/migration/MIGRATION_METRICS.md`

**Track:**
- Users migrated successfully
- Users requiring manual intervention
- Failed login attempts (Clerk vs Supabase)
- Session duration average
- Admin dashboard access errors
- API authentication errors

---

## Phase 5: Cutover Strategy

### 🚀 Migration Day Checklist

#### T-7 Days: Final Preparation
- [ ] Complete all testing
- [ ] Notify users of upcoming maintenance
- [ ] Prepare rollback plan
- [ ] Set up monitoring alerts
- [ ] Schedule migration window (low traffic time)

#### T-1 Day: Pre-Migration
- [ ] Run final data export
- [ ] Verify backup integrity
- [ ] Test migration script on staging
- [ ] Confirm Clerk webhooks working
- [ ] Alert team to be on standby

#### T-0 Hour: Migration Start
**Time Estimate: 2-4 hours**

**Step 1: Enable Maintenance Mode** (0:00-0:05)
```bash
# Update .env or deploy maintenance page
VITE_MAINTENANCE_MODE=true
```

**Step 2: Final Supabase Data Export** (0:05-0:15)
```bash
node scripts/export-users.js --final
```

**Step 3: Run Migration Script** (0:15-1:00)
```bash
# Dry run first
node scripts/migrate-users-to-clerk.js --dry-run

# Review output, then run for real
node scripts/migrate-users-to-clerk.js --batch-size 50

# Monitor progress:
# - Users created successfully
# - Errors (handle manually)
# - Metadata verification
```

**Step 4: Deploy Clerk-Enabled Code** (1:00-1:15)
```bash
# Flip feature flag
VITE_USE_CLERK_AUTH=true

# Deploy
git checkout main
git pull origin main
git push origin main  # Triggers Vercel deploy

# Monitor deployment
```

**Step 5: Verification Tests** (1:15-1:45)
- [ ] Test admin login (Clerk)
- [ ] Test regular user login (Clerk)
- [ ] Test new user signup
- [ ] Test protected routes
- [ ] Test API calls with Clerk tokens
- [ ] Check session persistence

**Step 6: Disable Maintenance Mode** (1:45-2:00)
```bash
VITE_MAINTENANCE_MODE=false
```

**Step 7: Monitor Initial Traffic** (2:00-4:00)
- [ ] Watch error logs (Vercel, Clerk, Supabase)
- [ ] Check login success rate
- [ ] Monitor API authentication errors
- [ ] Respond to user reports

#### T+1 Hour: Post-Migration
- [ ] Send all-clear email to users
- [ ] Update documentation
- [ ] Monitor for 24 hours
- [ ] Schedule follow-up review

#### T+7 Days: Cleanup
- [ ] Remove Supabase auth code (keep as backup for 30 days)
- [ ] Archive Supabase user data
- [ ] Update `.env` to remove old keys
- [ ] Close Supabase auth project (or disable)

---

## Rollback Plan

### 🔙 If Migration Fails

#### Immediate Rollback (Within 2 Hours)
**Triggers:**
- Login success rate < 90%
- Critical admin functions broken
- Data loss detected
- Unrecoverable errors

**Steps:**
1. **Flip Feature Flag** (1 minute)
   ```bash
   VITE_USE_CLERK_AUTH=false
   git push origin main  # Deploy
   ```

2. **Verify Supabase Auth Working** (5 minutes)
   - Test login with Supabase
   - Confirm sessions restored
   - Check admin access

3. **Notify Users** (10 minutes)
   - "We've temporarily reverted to the previous system"
   - "Your data is safe, no action required"

4. **Post-Mortem** (Next day)
   - Analyze what went wrong
   - Fix issues
   - Reschedule migration

#### Delayed Rollback (After 2 Hours)
**More Complex:** Some users may have created accounts in Clerk

**Steps:**
1. Export new Clerk users
2. Manually create in Supabase
3. Flip feature flag back
4. Merge user data

### 🛡️ Safety Mechanisms

- **Parallel Operation:** Keep Supabase active for 30 days
- **Data Backup:** Multiple exports before/during migration
- **Feature Flag:** Instant switch between auth providers
- **Monitoring:** Real-time alerts on login failures

---

## Success Criteria

### ✅ Migration is Successful If:

1. **Functionality:**
   - [ ] 100% of users can log in with Clerk
   - [ ] Admin access works correctly
   - [ ] All protected routes enforce auth
   - [ ] API calls authenticate properly
   - [ ] Sessions persist 30 days

2. **Performance:**
   - [ ] Login time within 10% of Supabase baseline
   - [ ] No increase in error rates
   - [ ] Page load times unchanged

3. **User Experience:**
   - [ ] Zero user-reported auth issues (first 48h)
   - [ ] Existing users notice no difference
   - [ ] New user onboarding works smoothly

4. **Data Integrity:**
   - [ ] All users migrated successfully
   - [ ] Admin status preserved
   - [ ] No data loss

5. **Monitoring:**
   - [ ] Clerk dashboard shows healthy metrics
   - [ ] API logs show successful auth
   - [ ] No unexpected errors in Vercel logs

---

## Dependencies & Blockers

### ❗ Must Complete Before Migration:
1. [ ] Clerk account created and configured
2. [ ] All route guards implemented and tested
3. [ ] Migration script tested on staging
4. [ ] Backup and rollback procedures verified
5. [ ] Team trained on Clerk dashboard
6. [ ] Users notified of maintenance window

### ⚠️ Potential Blockers:
- **Clerk API rate limits:** Understand limits for user creation
- **Email delivery:** Ensure Clerk emails not marked as spam
- **Session token format:** Verify API can parse Clerk tokens
- **Metadata limits:** Ensure we don't exceed Clerk metadata size
- **Cost:** Verify Clerk plan supports expected user count

---

## Resources & Documentation

### 📚 Clerk Documentation
- [Clerk React SDK](https://clerk.com/docs/references/react/overview)
- [User Metadata](https://clerk.com/docs/users/metadata)
- [Session Management](https://clerk.com/docs/authentication/session-management)
- [Backend API](https://clerk.com/docs/references/backend/overview)

### 🛠️ Tools
- Clerk Dashboard: https://dashboard.clerk.com
- Migration monitoring: Custom dashboard
- User export tool: `scripts/export-users.js`
- Migration script: `scripts/migrate-users-to-clerk.js`

### 👥 Contacts
- **Clerk Support:** support@clerk.com
- **Project Lead:** [Your Name]
- **On-Call During Migration:** [Team Member]

---

## Appendix: Code Snippets

### A. Clerk Provider Setup

**File:** `src/main.jsx`
```javascript
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

### B. Clerk Hook Usage

**File:** `src/contexts/AuthContext.jsx` (Clerk version)
```javascript
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';

export function AuthProvider({ children }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const { session } = useClerk();
  
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const dashboardAccess = user?.publicMetadata?.dashboardAccess || 'demo';
  
  return (
    <AuthContext.Provider value={{ user, isAdmin, dashboardAccess, loading: !isLoaded, signOut, session }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### C. API Authentication

**File:** `api/example-protected-endpoint.js`
```javascript
import { clerkClient } from '@clerk/clerk-sdk-node';

export default async function handler(req, res) {
  const { sessionId } = req.query;
  
  try {
    const session = await clerkClient.sessions.getSession(sessionId);
    const user = await clerkClient.users.getUser(session.userId);
    
    // Check permissions
    if (user.publicMetadata.dashboardAccess !== 'real') {
      return res.status(403).json({ error: 'Real dashboard access required' });
    }
    
    // Process request
    res.json({ success: true, data: '...' });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

---

**Next Steps:**
1. Review this checklist with team
2. Complete Phase 0 (Infrastructure Setup)
3. Schedule Phase 1 (Data Audit) for next week
4. Begin Phase 2 (Parallel Implementation) in sprint planning

**Estimated Timeline:**
- Phase 0: 1-2 days
- Phase 1: 2-3 days
- Phase 2: 1-2 weeks
- Phase 3: 3-5 days
- Phase 4: 3-5 days
- Phase 5: 1 day (migration) + 7 days (monitoring)

**Total: 4-6 weeks for complete migration**
