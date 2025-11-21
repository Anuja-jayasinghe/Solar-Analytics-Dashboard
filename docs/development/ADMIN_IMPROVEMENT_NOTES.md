# Admin & Authentication Migration Guide

**Date:** November 20, 2025  
**Status:** Active Implementation Guide  
**Maintainer:** Anuja Jayasinghe

---

## 📑 Table of Contents
1. [Clerk Authentication Migration](#clerk-authentication-migration)
2. [New User Flow & Landing Page Architecture](#new-user-flow--landing-page-architecture)
3. [Original Admin Improvement Notes](#original-admin-improvement-notes)

---

# Clerk Authentication Migration

## Overview
Complete migration from Supabase authentication to Clerk for improved session management, role-based access control, and seamless user experience.

## Key Features to Implement
- ✅ Demo vs Real Dashboard access control
- ✅ Admin role-based access (hierarchical permissions)
- ✅ 30-day persistent sessions (no logout on refresh)
- ✅ Public landing page with smart redirects
- ✅ Demo dashboard (no authentication required)
- ✅ Welcome/thank you page for new signups

---

## Pre-Migration Checklist

### Current System Analysis
- ✅ Current auth: Supabase (email/password)
- ✅ Current user storage: Supabase database
- ✅ Current admin system: `admin_users` table with email whitelist
- ✅ Current context: `AuthContext.jsx` managing auth state
- ✅ Protected routes: Dashboard, Admin Dashboard, Settings

### Data to Preserve
- [ ] Export user credentials (emails) from Supabase
- [ ] Export admin user list
- [ ] Backup user preferences/settings
- [ ] Backup historical login data (optional)

---

## Implementation Phases

### Phase 1: Clerk Setup (Week 1)

#### 1.1 Create Clerk Account
1. Sign up at https://clerk.com
2. Create new application: "Solar Analytics Dashboard"
3. Enable authentication methods:
   - ✅ Email/Password (primary)
   - ✅ Email Magic Links (optional, better UX)
   - ✅ Google OAuth (optional)
   - ✅ GitHub OAuth (optional)

#### 1.2 Configure API Keys
**Add to `.env`:**
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

#### 1.3 Install Dependencies
```bash
pnpm install @clerk/clerk-react @clerk/clerk-sdk-node
```

#### 1.4 Configure Session Settings
**In Clerk Dashboard → Sessions:**
- Session lifetime: **30 days (2592000 seconds)**
- Inactivity timeout: **30 days**
- Multi-session handling: **Single session**
- Sync session to external database: **Enable**

#### 1.5 Set Up User Metadata Schema
**Public Metadata** (frontend accessible):
```json
{
  "dashboardAccess": "demo" | "real",
  "role": "user" | "admin",
  "accessGrantedDate": "ISO date string"
}
```

**Private Metadata** (backend only):
```json
{
  "supabaseUserId": "uuid",
  "originalSignupDate": "ISO date string"
}
```

#### 1.6 Configure Redirect URLs
**In Clerk Dashboard → Paths:**
- Sign-in URL: `/login`
- Sign-up URL: `/signup`
- After sign-in: **Dynamic based on access level**
- After sign-up: `/welcome`
- Home URL: `/`

---

### Phase 2: User Data Migration (Week 1-2)

#### 2.1 Export Current Users
```sql
-- From Supabase: Export users
SELECT id, email, created_at FROM auth.users;

-- Export admin users
SELECT * FROM admin_users;
```

#### 2.2 Migration Script Strategy
**Recommended: Big Bang Migration** (1-2 hours downtime)
1. Set maintenance mode
2. Export all users
3. Create Clerk users via API
4. Map metadata:
   - Admins → `role: "admin"`, `dashboardAccess: "real"`
   - Regular users → `role: "user"`, `dashboardAccess: "real"` or "demo"
   - New signups → Default: `role: "user"`, `dashboardAccess: "demo"`
5. Test authentication
6. Remove maintenance mode

#### 2.3 Backup Plan
- Keep Supabase auth code in separate branch
- Can rollback deployment quickly
- User data preserved during transition

---

### Phase 3: Code Implementation (Week 2)

#### 3.1 Update Main Entry Point
**File:** `src/main.jsx`

**Changes:**
- Import and wrap app with `<ClerkProvider>`
- Configure session settings
- Remove Supabase auth initialization

#### 3.2 Replace AuthContext
**File:** `src/contexts/AuthContext.jsx`

**Replace with Clerk hooks:**
- `useUser()` → Current user data
- `useAuth()` → Auth methods (signOut, getToken)
- `useClerk()` → Clerk instance

**Create custom hook:** `src/hooks/useUserAccess.js`
```javascript
// Returns: hasRealAccess, isAdmin, isDemoUser, accessLevel
```

#### 3.3 Update Authentication Pages
**Files to modify:**
- `src/pages/login.jsx` → Use Clerk's `<SignIn />` or custom form
- `src/pages/AdminLogin.jsx` → DELETE (unified login)

#### 3.4 Secure API Routes
**Files:** `api/*.js`, `functions/*/index.js`

**Pattern for each function:**
1. Import `@clerk/clerk-sdk-node`
2. Verify session token from headers
3. Extract user ID and metadata
4. Check permissions before executing
5. Return 401 if unauthorized

#### 3.5 Update Dashboard Components
**Files:**
- `src/pages/Dashboard.jsx`
- `src/pages/AdminDashboard.jsx`
- `src/components/Sidebar.jsx`

**Changes:**
- Replace AuthContext with Clerk hooks
- Update logout to use `signOut()`
- Add access level checks

#### 3.6 Update Admin Management
**File:** `src/components/admin/AdminManagement.jsx`

**New capabilities:**
- List all users from Clerk
- Update user metadata (grant/revoke access)
- Change roles (promote to admin, demote to user)
- Delete users

---

# New User Flow & Landing Page Architecture

## Route Structure & Access Control

### Complete Route Map

| Route | Auth Required | Access Level | Public | Redirect Logic |
|-------|--------------|--------------|--------|----------------|
| `/` | No | Any | Yes | If logged in + real → `/dashboard` |
| `/login` | No | Any | Yes | After login → check access |
| `/signup` | No | Any | Yes | After signup → `/welcome` |
| `/welcome` | Yes | Any | No | Thank you page with demo link |
| `/demo-dashboard` | No | Any | **YES** | Public access, show CTA |
| `/dashboard` | Yes | Real | No | Real data (block demo users) |
| `/admin-dashboard` | Yes | Admin | No | Admin panel (block non-admins) |
| `/settings` | Yes | Any | No | User preferences |

---

## User Journey Flows

### Flow 1: New Visitor (No Account)
```
1. Visit / (Landing Page)
   ├─ See hero section, features, CTAs
   └─ Three options visible:
      ├─ "Sign Up" button
      ├─ "Sign In" button
      └─ "View Demo" button (prominent)

2. Click "View Demo" → /demo-dashboard
   ├─ NO authentication required
   ├─ See full dashboard with sample data
   ├─ Banner: "Demo Mode - Sign up for real-time tracking"
   └─ CTA buttons: "Sign Up Now"

3. Click "Sign Up" → /signup
   ├─ Complete registration form
   └─ Account created with default metadata:
      - dashboardAccess: "demo"
      - role: "user"

4. Auto redirect → /welcome
   ├─ Show thank you message
   ├─ Explain current access level (demo)
   ├─ Button: "Explore Demo Dashboard"
   └─ Display contact info & social links

5. Click "Explore Demo" → /demo-dashboard
   └─ Now logged in but viewing demo data
```

### Flow 2: Returning Demo User
```
1. Visit / (Landing Page)
   └─ Check: Is user logged in?
      └─ YES + dashboardAccess="demo"
         └─ Auto redirect → /welcome or /demo-dashboard
```

### Flow 3: Returning Real Access User
```
1. Visit / (Landing Page)
   └─ Check: Is user logged in?
      └─ YES + dashboardAccess="real"
         └─ Auto redirect → /dashboard
            └─ BYPASS landing page completely
```

### Flow 4: Admin User
```
1. Visit / (Landing Page)
   └─ Auto redirect → /dashboard

2. Navigate to /admin-dashboard
   └─ Check: role="admin"?
      ├─ YES → Allow access
      │   └─ Can manage users, grant access
      └─ NO → Redirect to /dashboard (403)
```

### Flow 5: Access Upgrade
```
1. Demo user requests access
2. Admin logs in → /admin-dashboard
3. Admin updates user metadata:
   - dashboardAccess: "demo" → "real"
4. User refreshes or visits /
5. System checks metadata → "real"
6. User redirected to /dashboard
7. User now sees real solar data
```

---

## Pages to Create/Update

### 1. Landing Page (NEW)
**File:** `src/pages/LandingPage.jsx`

**Sections:**
- Hero section
  - Headline: "Monitor Your Solar System in Real-Time"
  - Subheading: "Track generation, savings, and environmental impact"
  - Screenshot/preview of dashboard
- Features overview
  - Real-time monitoring
  - Historical analytics
  - Environmental impact tracking
- Call-to-action buttons:
  - **Primary:** "Sign Up Free"
  - **Secondary:** "Sign In"
  - **Tertiary:** "View Demo Dashboard" ← No auth required
- Footer
  - Social links (GitHub, LinkedIn, etc.)
  - Contact information

### 2. Welcome/Thank You Page (NEW)
**File:** `src/pages/WelcomePage.jsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│  🎉 Welcome to Solar Analytics!         │
├─────────────────────────────────────────┤
│                                          │
│  ✅ Your account has been created       │
│                                          │
│  📊 Current Access: Demo Mode           │
│                                          │
│  You can explore the demo dashboard     │
│  with sample solar data. To access      │
│  your real solar system data:           │
│                                          │
│  📧 Contact: admin@yourdomain.com       │
│  Or request access through the form     │
│                                          │
│  [Explore Demo Dashboard] ← Big CTA     │
│                                          │
├─────────────────────────────────────────┤
│  Connect with me:                        │
│  🔗 GitHub: github.com/yourhandle       │
│  💼 LinkedIn: linkedin.com/in/you       │
│  📧 Email: your@email.com               │
│  🐦 Twitter/X: @yourhandle              │
└─────────────────────────────────────────┘
```

**Features:**
- Welcome message
- Access level explanation
- Demo dashboard button
- Contact information for access requests
- Social links section (GitHub, LinkedIn, Email, etc.)

### 3. Demo Dashboard (UPDATE)
**File:** `src/pages/DemoDashboard.jsx`

**Changes:**
- **Remove authentication requirement** (public access)
- Add banner at top:
  - For logged out: "📊 Demo Mode - Sign up to track your solar system"
  - For demo users: "📊 Demo Mode - Contact admin for real dashboard access"
- Use static/sample data
- Same UI as real dashboard
- CTA buttons based on auth state:
  - Not logged in: "Sign Up" / "Sign In"
  - Demo user: "Request Access"

### 4. Real Dashboard (UPDATE)
**File:** `src/pages/Dashboard.jsx`

**Changes:**
- Add access guard: Require `dashboardAccess="real"`
- Show admin link in sidebar if `role="admin"`
- Fetch real data from APIs
- Update user info display with Clerk data

### 5. Admin Dashboard (UPDATE)
**File:** `src/pages/AdminDashboard.jsx`

**Changes:**
- Add admin guard: Require `role="admin"`
- User management section:
  - List all users
  - Show access levels
  - Buttons to:
    - Grant real access (demo → real)
    - Revoke real access (real → demo)
    - Promote to admin (user → admin)
    - Demote from admin (admin → user)
    - Delete user

---

## Route Guard Implementation

### Guard Components to Create

#### 1. PublicRoute
**Purpose:** Redirect logged-in real users away from public pages
```javascript
// Usage: Landing page
// Logic: If logged in + real access → redirect to /dashboard
```

#### 2. AuthRequired
**Purpose:** Must be logged in (any access level)
```javascript
// Usage: Welcome page, Settings
// Logic: If not logged in → redirect to /login
```

#### 3. RealDashboardRoute
**Purpose:** Requires real dashboard access
```javascript
// Usage: Dashboard
// Logic: If not logged in → /login
//        If demo user → /welcome or /demo-dashboard
```

#### 4. AdminRoute
**Purpose:** Requires admin role
```javascript
// Usage: Admin Dashboard
// Logic: If not logged in → /login
//        If not admin → /dashboard (403)
```

---

## Access Level Definitions

### Three-Tier System

#### 1. Demo User (Default for new signups)
**Metadata:**
```json
{
  "dashboardAccess": "demo",
  "role": "user"
}
```
**Access:**
- ✅ `/demo-dashboard` (sample data)
- ✅ `/welcome`
- ✅ `/settings`
- ❌ `/dashboard` (blocked)
- ❌ `/admin-dashboard` (blocked)

#### 2. Real User (Granted by admin)
**Metadata:**
```json
{
  "dashboardAccess": "real",
  "role": "user"
}
```
**Access:**
- ✅ `/dashboard` (real data)
- ✅ `/demo-dashboard` (can view demo too)
- ✅ `/settings`
- ❌ `/admin-dashboard` (blocked)

#### 3. Admin User (Special privileges)
**Metadata:**
```json
{
  "dashboardAccess": "real",
  "role": "admin"
}
```
**Access:**
- ✅ `/dashboard` (real data)
- ✅ `/admin-dashboard` (user management)
- ✅ `/demo-dashboard` (can view demo)
- ✅ `/settings`

---

## Smart Redirect Logic

### Landing Page (`/`) Redirect Logic
```javascript
if (user is logged in) {
  if (user.publicMetadata.dashboardAccess === "real") {
    redirect to /dashboard
  } else {
    // First visit after signup
    if (coming from signup) {
      redirect to /welcome
    } else {
      redirect to /demo-dashboard
    }
  }
} else {
  // Show landing page
  render LandingPage component
}
```

### Post-Login Redirect Logic
```javascript
After successful login {
  const access = user.publicMetadata.dashboardAccess
  
  if (access === "real") {
    redirect to /dashboard
  } else {
    redirect to /welcome
  }
}
```

### Post-Signup Redirect Logic
```javascript
After successful signup {
  // Always redirect to welcome page for new users
  redirect to /welcome
}
```

---

## Implementation Checklist

### Week 2: Landing & Welcome Pages
- [ ] Create `src/pages/LandingPage.jsx`
  - [ ] Hero section with solar dashboard preview
  - [ ] Features list
  - [ ] CTA buttons (Sign Up, Sign In, View Demo)
  - [ ] Footer with social links
- [ ] Create `src/pages/WelcomePage.jsx`
  - [ ] Welcome message
  - [ ] Access level explanation
  - [ ] Demo dashboard CTA button
  - [ ] Contact/social links section
- [ ] Add your social media links:
  - [ ] GitHub profile URL
  - [ ] LinkedIn profile URL (if applicable)
  - [ ] Email contact
  - [ ] Twitter/X handle (if applicable)

### Week 2: Update Demo Dashboard
- [ ] Remove authentication requirement from route
- [ ] Add public access banner
- [ ] Implement static/sample data
- [ ] Add conditional CTAs based on auth state
- [ ] Style banner for visibility

### Week 2: Route Guards
- [ ] Create `src/components/guards/PublicRoute.jsx`
- [ ] Create `src/components/guards/AuthRequired.jsx`
- [ ] Create `src/components/guards/RealDashboardRoute.jsx`
- [ ] Create `src/components/guards/AdminRoute.jsx`

### Week 2: Update App Routing
- [ ] Update `src/App.jsx`:
  - [ ] Add route for `/` (LandingPage with redirect logic)
  - [ ] Add route for `/welcome` (WelcomePage)
  - [ ] Add route for `/demo-dashboard` (public)
  - [ ] Update `/dashboard` with RealDashboardRoute guard
  - [ ] Update `/admin-dashboard` with AdminRoute guard
  - [ ] Update `/signup` with post-signup redirect
  - [ ] Update `/login` with smart redirect logic

### Week 3: Clerk Configuration
- [ ] Set default user metadata for new signups:
  - `dashboardAccess: "demo"`
  - `role: "user"`
- [ ] Configure signup redirect: `/welcome`
- [ ] Configure signin redirect: Dynamic (check access)
- [ ] Test session persistence (30 days)

### Week 3: Admin User Management
- [ ] Update Admin Dashboard UI:
  - [ ] User list with Clerk data
  - [ ] Display access levels and roles
  - [ ] "Grant Real Access" button
  - [ ] "Revoke Real Access" button
  - [ ] "Make Admin" button
  - [ ] "Remove Admin" button
  - [ ] "Delete User" button with confirmation
- [ ] Implement Clerk API calls:
  - [ ] Update user metadata
  - [ ] Delete user
  - [ ] List all users

### Week 3: Testing
- [ ] Test new user signup flow
- [ ] Test demo dashboard public access
- [ ] Test welcome page display
- [ ] Test real user auto-redirect from landing
- [ ] Test admin access to admin dashboard
- [ ] Test access level upgrade (demo → real)
- [ ] Test session persistence across days
- [ ] Test manual logout

### Week 4: Polish & Deploy
- [ ] Add loading states to all redirects
- [ ] Add error handling for failed redirects
- [ ] Test all flows in production environment
- [ ] Update documentation
- [ ] Monitor user feedback

---

## Testing Scenarios

### Scenario 1: First-Time Visitor
```
✅ Visit / → See landing page
✅ Click "View Demo" → /demo-dashboard (no login)
✅ Browse demo data
✅ Click "Sign Up" → Complete signup
✅ Redirect to /welcome
✅ See thank you message
✅ Click "Explore Demo" → /demo-dashboard
✅ See banner indicating demo mode
```

### Scenario 2: Demo User Returns
```
✅ Visit / → Auto redirect to /demo-dashboard
✅ See demo data with banner
✅ Cannot access /dashboard (redirect to demo)
✅ Cannot access /admin-dashboard (blocked)
✅ Can access /settings
```

### Scenario 3: Real Access User
```
✅ Visit / → Auto redirect to /dashboard
✅ See real solar data
✅ Can access /settings
✅ Cannot access /admin-dashboard (not admin)
```

### Scenario 4: Admin User
```
✅ Visit / → Auto redirect to /dashboard
✅ See admin link in sidebar
✅ Click admin link → /admin-dashboard
✅ See user management interface
✅ Can update user access levels
```

### Scenario 5: Access Upgrade
```
✅ Demo user logged in
✅ Admin grants real access (updates metadata)
✅ User refreshes page
✅ Next visit to / → Redirect to /dashboard
✅ User now sees real data
```

---

## Social Links Configuration

### Add Your Details
**Update in the following files:**
- `src/pages/LandingPage.jsx` (footer)
- `src/pages/WelcomePage.jsx` (connect section)

**Example structure:**
```javascript
const socialLinks = {
  github: "https://github.com/yourusername",
  linkedin: "https://linkedin.com/in/yourprofile",
  email: "your.email@domain.com",
  twitter: "https://twitter.com/yourhandle",
  website: "https://yourwebsite.com"
}
```

---

## Benefits Summary

### User Experience
✅ Smooth onboarding for new users  
✅ Demo accessible without signup (low friction)  
✅ Clear path from demo to real access  
✅ No repeated logins (30-day sessions)  
✅ Returning users skip landing page  

### Security & Access Control
✅ Clear separation: demo vs real vs admin  
✅ Clerk handles token refresh automatically  
✅ Role-based access built-in  
✅ Easy to upgrade/downgrade users  
✅ Admin has full control  

### Marketing & Growth
✅ Landing page creates first impression  
✅ Demo showcases value before signup  
✅ Social links build trust  
✅ Easy to share demo link  

### Technical
✅ No custom auth logic needed  
✅ Session management handled by Clerk  
✅ Scalable metadata system  
✅ API security with token verification  

---

## Timeline Summary

**Week 1:** Clerk setup, user migration preparation  
**Week 2:** Landing page, welcome page, demo update, route guards  
**Week 3:** Admin management, testing, polish  
**Week 4:** Deployment, monitoring, documentation  

**Total: 3-4 weeks for complete migration**

---

# Original Admin Improvement Notes

## Original Planning Document

**Note:** The sections below represent the original admin improvement planning. The Clerk migration above supersedes the authentication sections but complements the admin UX, audit logging, and observability goals.

---

## Objectives
- Strengthen authentication, authorization, and session handling for the admin area.
- Improve reliability, observability, and safety of admin operations (data edits, settings, backfills).
- Provide a clean UX for admin tasks with clear guardrails and auditability.

---

## Current Context
- Frontend: React app with contexts in `src/contexts/` (e.g., `AuthContext.jsx`).
- Data: Supabase (RPC, tables), serverless functions (Solis integration).
- Admin UI: `src/components/admin/` and `src/pages/AdminDashboard.jsx`.

---

## Authentication & Session
- Login Flow
  - Use a single, centralized `AuthContext` handling login, logout, and session hydration.
  - Persist minimal session token in memory; store refresh token securely (httpOnly cookie if possible via backend route; otherwise encrypted localStorage fallback).
- Token Refresh
  - Implement silent refresh before expiry (e.g., T-2 minutes) to avoid mid-operation logouts.
  - On refresh failure, force logout and redirect to Admin Login.
- MFA (Optional Phase 2)
  - Support TOTP-based MFA for admin roles.
  - Backup codes UI for recovery.
- Security
  - Brute-force protection on login (rate limit per IP and username; exponential backoff).
  - Lockout policy after N failed attempts with admin override to unlock.

---

## Authorization & Roles
- Roles & Claims
  - Define roles: `viewer`, `editor`, `admin` (extendable to `owner`).
  - Map routes/actions → role requirements in a central policy module.
- Route Guards
  - Protect admin routes at router-level (redirect unauth/unauthorized to login/403 page).
  - Avoid UI flicker by resolving auth before rendering protected pages (or render a protected layout skeleton during check).
- UI Gating
  - Hide admin nav and controls for non-admins; disable actions without permission.

---

## Admin UX & Safeguards
- Confirmation & Undo
  - Confirmation dialogs for destructive actions (delete, reset, overwrite).
  - Soft-delete with a recovery window where feasible.
- Draft/Preview
  - For settings changes: stage in a draft view with diff preview before apply.
- Bulk Operations
  - Chunked processing with progress indicators and resumable steps for backfills.
- Accessibility
  - Keyboard navigable forms, ARIA roles, and clear focus states.

---

## Audit Logging
- What to Log
  - Actor (user id/email), action, entity, before/after diff summary, timestamp, outcome (success/failure), correlation ID.
- Storage
  - Table `admin_audit_log` with partitioning by month (for scale) and indexes on date/user.
- Surfacing
  - Admin-facing audit viewer with filters (date range, user, action, entity).

---

## Rate Limiting & Abuse Prevention
- Per-IP and per-user limits for sensitive admin functions (e.g., settings update, backfills).
- Circuit breaker: temporarily suspend endpoints on repeated 5xx spikes.
- CAPTCHA or secondary verification for repeated failed login attempts.

---

## Data Integrity & Recovery
- Soft-delete over hard-delete for key tables; nightly purge task for aged soft-deletes.
- Snapshots
  - Pre-change snapshots for critical settings and content (versioned config).
  - Rollback button for last known good configuration.
- Validation
  - Strict input validation (schema-based) with helpful errors.

---

## Observability
- Structured Logs
  - JSON logs including `requestId`, `userId`, duration, status, and error details.
- Metrics
  - Success rate, latency p95, error rates per admin endpoint.
- Alerts
  - Trigger alerts on login failures spike, repeated rate limit hits, and long-running tasks.

---

## Secrets & Configuration
- Do not store provider credentials directly in frontend storage.
- Use serverless functions/edge routes to proxy sensitive calls with server-held secrets.
- Rotation Policy: document rotation steps; schedule periodic rotation reminders.

---

## Testing & Hardening
- Unit Tests: auth flows, role checks, reducers/hooks in `AuthContext`.
- Integration Tests: protected routes, token refresh, admin operations happy-path and failure-path.
- Security Tests: basic vulnerability checks (XSS/CSRF avoidance in forms; input sanitization).

---

## Phased Roadmap
- Phase A (Post-Dashboard)
  - Centralize `AuthContext` session + refresh logic
  - Route guards + UI gating
  - Basic audit log (create/update/delete settings)
- Phase B
  - Brute-force protection + rate limiting on admin endpoints
  - Soft-delete mechanics + restore
  - Admin audit viewer page
- Phase C
  - MFA for admins
  - Snapshot/rollback for critical settings
  - Observability dashboards & alerts

---

## Acceptance Criteria (Phase A)
- Admin routes are fully protected; no flicker; unauthorized users cannot access endpoints.
- Session persists across reload; silent token refresh prevents surprise logouts.
- Every settings change emits an audit log with actor and diff summary.
- Basic rate limiting in place for login endpoint.

---

## References
- `src/contexts/AuthContext.jsx`
- `src/pages/AdminLogin.jsx`, `src/pages/AdminDashboard.jsx`
- Supabase policies/Row Level Security (if used)
- Serverless functions handling sensitive operations

---

## 📋 Document History

**Maintainer:** Anuja Jayasinghe  

### Change Log
- **Created:** November 16, 2025 - Initial admin improvement planning document
- **Updated:** November 19, 2025 - Updated date and status in header, added maintainer log
- **Major Update:** November 20, 2025 - Added complete Clerk migration guide and new user flow architecture with landing page, welcome page, and demo dashboard strategy

**Last Updated:** November 20, 2025
