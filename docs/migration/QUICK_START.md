# Clerk Migration Quick Start Guide

**For:** Development Team  
**Purpose:** Get started with Clerk migration today  
**Time:** 30 minutes to get set up

---

## 🚀 Quick Start (Do This First)

### Step 1: Create Clerk Account (5 min)

1. Go to https://clerk.com
2. Sign up with your email
3. Create a new application: "Solar Analytics Dashboard"
4. Choose **"Development"** for now (we'll add Production later)

### Step 2: Get Your API Keys (2 min)

In Clerk Dashboard:
1. Click **"API Keys"** in sidebar
2. Copy **Publishable Key** (starts with `pk_test_`)
3. Copy **Secret Key** (starts with `sk_test_`)

### Step 3: Add to Your .env (1 min)

```bash
# Add these to your .env file
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Keep Supabase (we'll use both during migration)
VITE_SUPABASE_URL=your_existing_url
VITE_SUPABASE_ANON_KEY=your_existing_key

# Feature flag (false = use Supabase, true = use Clerk)
VITE_USE_CLERK_AUTH=false
```

### Step 4: Configure Sessions (3 min)

In Clerk Dashboard → **Sessions**:
- Session lifetime: **30 days** (2592000 seconds)
- Inactivity timeout: **30 days**
- Multi-session handling: **Single session**

Click **Save**.

### Step 5: Set Up Redirects (2 min)

In Clerk Dashboard → **Paths**:
```
Sign-in URL: /login
Sign-up URL: /signup
Home URL: /
After sign-in: (leave default)
After sign-up: /welcome
```

Click **Save**.

### Step 6: Configure User Metadata (5 min)

In Clerk Dashboard → **Customization** → **Metadata**:

Add this to Public Metadata schema:
```json
{
  "dashboardAccess": "demo",
  "role": "user",
  "accessGrantedDate": null,
  "migratedFromSupabase": false
}
```

Click **Save**.

### Step 7: Test Connection (3 min)

```bash
# Install dependencies (if not already)
pnpm install

# Test Clerk connection
node -e "console.log('Clerk Key:', process.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 15) + '...')"
```

You should see: `Clerk Key: pk_test_...`

---

## ✅ What You Have Now

- ✅ Clerk account created
- ✅ API keys configured
- ✅ Sessions set to 30 days
- ✅ Redirect URLs configured
- ✅ User metadata schema defined
- ✅ Environment variables set

---

## 📝 Next Steps

### Today (30 min remaining)
1. **Read the preparation checklist:**
   - `docs/development/CLERK_MIGRATION_PREPARATION.md`

2. **Run the user export script:**
   ```bash
   node scripts/export-users.js
   ```

3. **Review the timeline:**
   - `docs/migration/MIGRATION_TIMELINE.md`

### This Week
1. **Phase 0 - Infrastructure Setup** (2 days)
   - Complete Clerk configuration
   - Set up webhooks
   - Test API connection

2. **Phase 1 - Data Audit** (3 days)
   - Export all user data
   - Create backups
   - Document baseline metrics

### Next Week
1. **Phase 2 - Parallel Implementation** (2 weeks)
   - Implement auth adapters
   - Create route guards
   - Secure API endpoints

---

## 🧪 Test Your Setup

### Test 1: Export Users
```bash
node scripts/export-users.js
```

Expected output:
```
📦 Exporting Supabase Users for Clerk Migration
✅ Found X auth users
✅ Found X admin users
✅ Export Complete!
```

Check `backups/` folder for JSON files.

### Test 2: Migration Script (Dry Run)
```bash
node scripts/migrate-users-to-clerk.js --dry-run
```

Expected output:
```
🚀 Clerk Migration Script
🎯 Mode: DRY RUN (no changes)
✓ Would create: user@example.com (user)
✅ Export complete!
```

### Test 3: Feature Flag
```bash
# In your .env, try toggling:
VITE_USE_CLERK_AUTH=true

# Then start dev server
pnpm dev

# Should still work (using Supabase when false)
```

---

## 🛠️ Troubleshooting

### "Cannot find module @clerk/clerk-react"
```bash
pnpm install @clerk/clerk-react @clerk/clerk-sdk-node
```

### "Missing CLERK_SECRET_KEY"
- Check your `.env` file
- Make sure you copied the `sk_test_` key
- Restart your terminal/IDE

### "Supabase users export failed"
- Check your Supabase credentials
- Make sure `SUPABASE_SERVICE_KEY` (not ANON_KEY) is in `.env`
- Check Supabase project is running

### "No export files found"
- Run `node scripts/export-users.js` first
- Check `backups/` directory exists
- Check file permissions

---

## 📚 Key Documents

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `CLERK_MIGRATION_PREPARATION.md` | Complete checklist | Today |
| `MIGRATION_TIMELINE.md` | Week-by-week plan | Today |
| `ADMIN_IMPROVEMENT_NOTES.md` | Requirements & flows | Before Phase 2 |
| `USER_COUNTS_BASELINE.md` | Baseline metrics | After export |

---

## 👥 Team Roles

Assign these roles before starting:

- **Migration Lead:** Oversees entire process
- **Backend Developer:** API security & migration scripts
- **Frontend Developer:** Route guards & UI updates
- **QA Engineer:** Testing & validation
- **DevOps:** Deployment & monitoring

---

## 🚨 Important Notes

### DO NOT (Yet):
- ❌ Switch feature flag to `true` (keep `false` for now)
- ❌ Delete Supabase auth code
- ❌ Remove Supabase from `.env`
- ❌ Run migration script without `--dry-run`
- ❌ Deploy to production

### DO:
- ✅ Keep both auth providers working in parallel
- ✅ Test thoroughly on staging first
- ✅ Create backups before any changes
- ✅ Document everything
- ✅ Ask questions in team channel

---

## 💡 Pro Tips

1. **Use separate Clerk instances:**
   - Development: `pk_test_...`
   - Staging: `pk_test_...` (different account)
   - Production: `pk_live_...` (create later)

2. **Test early and often:**
   - Run `--dry-run` multiple times
   - Test on 5 users before migrating all

3. **Keep detailed logs:**
   - Save all migration outputs
   - Document any issues immediately

4. **Schedule migration carefully:**
   - Pick lowest traffic time
   - Allow 4-6 hours total
   - Have rollback plan ready

---

## 🎯 Success Criteria

You're ready for Phase 2 when:
- ✅ Clerk account fully configured
- ✅ All users exported to JSON
- ✅ Baseline metrics documented
- ✅ Migration script tested (dry-run)
- ✅ Team understands the plan
- ✅ Rollback procedure documented

---

## 📞 Need Help?

- **Clerk Support:** support@clerk.com (paid plans only)
- **Clerk Discord:** https://clerk.com/discord
- **Clerk Docs:** https://clerk.com/docs
- **Team Channel:** [Your team chat]

---

## 🎉 You're Ready!

You've completed the quick start. Next:

1. **Review** the full preparation checklist
2. **Schedule** Phase 0 work (2 days)
3. **Brief** your team
4. **Start** the migration journey!

**Estimated Total Time:** 4-6 weeks  
**Your Progress:** Day 1 of 42 ✅

---

**Last Updated:** November 30, 2025  
**Version:** 1.0
