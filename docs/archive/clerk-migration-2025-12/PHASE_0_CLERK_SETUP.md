> **Archived 2026-09-24 — historical record, not current.** This is the Supabase-to-Clerk authentication migration, which is complete. Auth is Clerk only; `admin_users` is legacy and unused.
> Current documentation: [`docs/README.md`](../../README.md).

# Phase 0: Clerk Infrastructure Setup

**Status:** 🔄 In Progress  
**Date Started:** December 2, 2025

---

## ✅ Step 1: Create Clerk Application

### Account Setup
1. Go to https://clerk.com and sign up/login
2. Click "Add application"
3. Application name: **Solar Analytics Dashboard**
4. Application type: Choose **Development** (for testing) or **Production**

**📝 Notes:**
- [ ] Account created
- [ ] Application created
- [ ] Application ID: _______________

---

## ✅ Step 2: Configure Authentication Methods

### In Clerk Dashboard → User & Authentication → Email, Phone, Username

**Enable:**
- [x] **Email address** (Required)
- [x] **Password** (For migration parity with Supabase)
- [ ] **Email verification** → Set to "Verification code" (faster than link)

**Optional Enhancements:**
- [ ] **Magic links** (Better UX, passwordless)
- [ ] **Social OAuth:**
  - [ ] Google (matches your Supabase setup)
  - [ ] GitHub
  - [ ] Microsoft

**Recommended Configuration:**
```
✅ Email address: Required, used for identification
✅ Password: Optional (enable for existing Supabase users)
✅ Email verification: Verification code
✅ Require verification before access: Yes
```

---

## ✅ Step 3: Configure Session Settings

### In Clerk Dashboard → Sessions

**Recommended Settings:**
```
Session lifetime: 30 days (2592000 seconds)
Inactivity timeout: 30 days (2592000 seconds)
Multi-session handling: Allow multiple sessions per user
```

**📝 Notes:**
- [ ] Session settings configured
- Current settings: _______________

---

## ✅ Step 4: Set Up User Metadata Schema

### In Clerk Dashboard → Customization → User Metadata

You'll use metadata to store `dashboardAccess` and `role`:

#### Public Metadata (accessible to frontend)
```json
{
  "dashboardAccess": "real",
  "role": "user",
  "accessGrantedDate": "2025-12-02T00:00:00.000Z",
  "migratedFromSupabase": true
}
```

#### Private Metadata (backend-only, for audit)
```json
{
  "supabaseUserId": "original-uuid-from-auth.users",
  "originalSignupDate": "2023-01-15T00:00:00.000Z",
  "lastAccessUpgrade": "2025-12-02T00:00:00.000Z",
  "migrationNotes": "Migrated from Supabase on 2025-12-02"
}
```

#### Unsafe Metadata (user-editable with permissions)
```json
{
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

**📝 Notes:**
- [ ] Metadata schema documented
- [ ] Team understands public vs private metadata

---

## ✅ Step 5: Configure Paths & Redirects

### In Clerk Dashboard → Paths

**Set these paths:**
```
Sign-in URL: /login
Sign-up URL: /signup
Home URL: / (your landing page)
After sign-in redirect: (leave empty, will be dynamic)
After sign-up redirect: /welcome
User profile URL: /settings
```

**📝 Notes:**
- [ ] Paths configured
- [ ] Redirects tested

---

## ✅ Step 6: Get API Keys & Update Environment

### In Clerk Dashboard → API Keys

**Copy these values:**
1. **Publishable Key** (starts with `pk_test_` or `pk_live_`)
2. **Secret Key** (starts with `sk_test_` or `sk_live_`)

### Update `.env` file

Add these to your existing `.env`:

```bash
# Existing Supabase (keep for parallel operation)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx

# NEW: Clerk API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# NEW: Feature flag (keep false until cutover)
VITE_USE_CLERK_AUTH=false

# NEW: Demo user management (keep existing)
VITE_DEMO_EMAILS=demo@test.com
VITE_FORCE_DEMO_USERS=false
```

**📝 Checklist:**
- [ ] Publishable key added to `.env`
- [ ] Secret key added to `.env`
- [ ] `.env` file NOT committed to git
- [ ] `.env.clerk.example` created (template without secrets)
- [ ] Team members have their own `.env` with keys

---

## ✅ Step 7: Configure Webhooks (Optional but Recommended)

### Why Webhooks?
Webhooks let you sync Clerk events to your database in real-time (user created, updated, deleted).

### Setup Steps

1. **Create endpoint handler:**
   - File: `api/clerk-webhook.js` (to be created in Phase 2)
   - URL: `https://your-domain.vercel.app/api/clerk-webhook`

2. **In Clerk Dashboard → Webhooks:**
   - Click "Add Endpoint"
   - URL: Your webhook endpoint
   - Subscribe to events:
     - [x] `user.created`
     - [x] `user.updated`
     - [x] `user.deleted`
     - [x] `session.created` (optional)
     - [x] `session.ended` (optional)

3. **Copy webhook signing secret:**
   - Add to `.env`: `CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx`

**📝 Notes:**
- [ ] Webhook endpoint URL decided
- [ ] Webhook created in Clerk Dashboard
- [ ] Signing secret added to `.env`
- [ ] Will implement handler in Phase 2

---

## ✅ Step 8: Test Clerk Setup

### Create a Test User

1. Go to Clerk Dashboard → Users
2. Click "Create User"
3. Email: `test@yourdomain.com`
4. Set public metadata:
   ```json
   {
     "dashboardAccess": "real",
     "role": "admin"
   }
   ```
5. Save user

### Verify Setup
- [ ] Test user created successfully
- [ ] Metadata fields visible and editable
- [ ] API keys copied correctly
- [ ] Dashboard accessible

---

## 🎯 Phase 0 Completion Checklist

Before moving to Phase 1:
- [ ] Clerk application created
- [ ] Email + Password authentication enabled
- [ ] Email verification configured
- [ ] Session settings configured (30 days)
- [ ] User metadata schema documented
- [ ] Paths & redirects configured
- [ ] API keys added to `.env` (and `.env` in `.gitignore`)
- [ ] Webhooks configured (optional)
- [ ] Test user created in Clerk Dashboard
- [ ] `.env.clerk.example` file created for team reference

---

## 📝 Important Notes

**Security:**
- ✅ Never commit `.env` to git
- ✅ Use `.env.clerk.example` as template (no secrets)
- ✅ Secret keys are for backend only (never expose to frontend)
- ✅ Publishable keys are safe to expose in frontend code

**Parallel Operation:**
- Keep `VITE_USE_CLERK_AUTH=false` until Phase 5
- Both Supabase and Clerk will work simultaneously
- No disruption to existing users

**Testing:**
- Use development environment first
- Create test accounts, don't use production users
- Verify metadata structure matches your needs

---

## Next Steps

Once Phase 0 is complete:
→ **Phase 1:** Data Audit & Backup (export existing Supabase users)

**Questions? Issues?**
Document any blockers or questions here for team discussion.
