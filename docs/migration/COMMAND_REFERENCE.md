# Quick Command Reference - Clerk Migration

## Development Commands

### Start Dev Server
```powershell
pnpm dev
```

### Build for Production
```powershell
pnpm build
```

### Preview Production Build
```powershell
pnpm preview
```

---

## Switch Between Auth Modes

### Use Supabase (Current Default)
```powershell
# Edit .env file
VITE_USE_CLERK_AUTH=false

# Restart server
pnpm dev
```

### Use Clerk (Testing Mode)
```powershell
# Edit .env file
VITE_USE_CLERK_AUTH=true

# Restart server
pnpm dev
```

---

## Rollback Commands

### Quick Rollback (Keep Code, Use Supabase)
```powershell
# Just flip the flag in .env
VITE_USE_CLERK_AUTH=false
# Restart server
```

### Code Rollback (Restore Original AuthContext)
```powershell
Copy-Item "src\contexts\AuthContext.supabase.backup.jsx" "src\contexts\AuthContext.jsx" -Force
```

### Full Git Rollback
```bash
# Stash current changes
git stash

# Return to main branch
git checkout main

# Or revert specific files
git checkout main -- src/contexts/AuthContext.jsx src/App.jsx
```

---

## User Migration Commands

### Export Supabase Users
```bash
node scripts/export-users.js
```

Output: `exports/users-YYYY-MM-DD.json`

### Migrate to Clerk (Dry Run)
```bash
node scripts/migrate-users-to-clerk.js --dry-run
```

### Migrate to Clerk (Actual)
```bash
node scripts/migrate-users-to-clerk.js --confirm
```

---

## Testing Commands

### Check for TypeScript/Lint Errors
```powershell
pnpm run lint
```

### Run Tests (if available)
```powershell
pnpm test
```

### Check Build Size
```powershell
pnpm build
# Check dist/ folder size
```

---

## Environment Setup

### Copy Environment Template
```powershell
Copy-Item ".env.clerk.example" ".env.local"
```

### Required Environment Variables

**Supabase** (existing):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

**Clerk** (new):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_USE_CLERK_AUTH=false
```

**Feature Flags**:
```
VITE_DEMO_TEST_MODE=true
VITE_FORCE_DEMO_USERS=false
VITE_DEMO_EMAILS=demo1@example.com,demo2@example.com
```

---

## Git Workflow

### Create Feature Branch
```bash
git checkout -b feature/clerk-integration
```

### Commit Changes
```bash
git add .
git commit -m "feat: add Clerk auth adapter pattern"
```

### Push to Remote
```bash
git push origin feature/clerk-integration
```

### Merge Back to Main (After Testing)
```bash
git checkout main
git merge feature/clerk-integration
git push origin main
```

---

## Vercel Deployment

### Deploy Current Branch
```bash
vercel --prod
```

### Deploy to Preview (Testing)
```bash
vercel
```

### Set Environment Variables in Vercel
```bash
# Via Vercel Dashboard or CLI
vercel env add VITE_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add VITE_USE_CLERK_AUTH
```

---

## Database Commands (Supabase)

### Check Admin Users
```sql
SELECT email, dashboard_access FROM admin_users;
```

### Add Admin User
```sql
INSERT INTO admin_users (email, dashboard_access)
VALUES ('newadmin@example.com', 'real');
```

### Update Dashboard Access
```sql
UPDATE admin_users
SET dashboard_access = 'demo'
WHERE email = 'user@example.com';
```

---

## Clerk CLI Commands

### Login to Clerk
```bash
clerk login
```

### Create User (via API)
```bash
curl -X POST https://api.clerk.com/v1/users \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": ["user@example.com"],
    "password": "SecurePassword123!",
    "public_metadata": {
      "role": "user",
      "dashboardAccess": "demo"
    }
  }'
```

### List Clerk Users
```bash
curl -X GET https://api.clerk.com/v1/users \
  -H "Authorization: Bearer $CLERK_SECRET_KEY"
```

---

## Debugging Commands

### Watch Logs (Dev Server)
```powershell
pnpm dev
# Console will show all logs
```

### Check Console Errors in Browser
1. Open Developer Tools (F12)
2. Go to Console tab
3. Filter by "Error" or "Warning"

### Test Supabase Connection
```bash
node src/lib/verifySupabaseConnection.js
```

### Test Clerk Connection (after enabling)
```bash
# Create test script
node -e "const clerk = require('@clerk/clerk-sdk-node'); console.log(clerk)"
```

---

## Performance Profiling

### Build Analysis
```powershell
pnpm build
# Check bundle sizes in dist/
```

### React DevTools Profiler
1. Install React DevTools extension
2. Open Profiler tab
3. Record auth flows
4. Analyze render times

---

## Documentation Commands

### Generate API Docs (if configured)
```bash
pnpm run docs:generate
```

### View Migration Docs
- Phase 0 Setup: `docs/migration/PHASE_0_CLERK_SETUP.md`
- Implementation: `docs/migration/PHASE_0_IMPLEMENTATION_COMPLETE.md`
- Testing Guide: `docs/migration/TESTING_GUIDE_CLERK.md`
- Full Plan: `docs/development/CLERK_MIGRATION_PREPARATION.md`

---

## Useful PowerShell Aliases

Add to your PowerShell profile:

```powershell
# Open in editor
notepad $PROFILE

# Add these aliases
function Start-DevServer { pnpm dev }
function Switch-ToClerk { $env:VITE_USE_CLERK_AUTH='true'; pnpm dev }
function Switch-ToSupabase { $env:VITE_USE_CLERK_AUTH='false'; pnpm dev }

Set-Alias dev Start-DevServer
Set-Alias clerk Switch-ToClerk
Set-Alias supabase Switch-ToSupabase
```

Then just run:
```powershell
dev         # Start dev server
clerk       # Enable Clerk mode
supabase    # Enable Supabase mode
```

---

## Emergency Procedures

### If Site Goes Down

1. **Check Environment**:
   ```powershell
   cat .env | Select-String "VITE_USE_CLERK_AUTH"
   ```

2. **Quick Fix** (Rollback to Supabase):
   ```powershell
   # Edit .env
   VITE_USE_CLERK_AUTH=false
   # Or use environment variable override
   $env:VITE_USE_CLERK_AUTH='false'; pnpm dev
   ```

3. **Deploy Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   # Vercel will auto-deploy
   ```

### If Database Connection Issues

1. **Check Supabase Status**: https://status.supabase.com
2. **Test Connection**:
   ```bash
   node src/lib/verifySupabaseConnection.js
   ```
3. **Check Environment Variables**:
   ```powershell
   echo $env:VITE_SUPABASE_URL
   echo $env:VITE_SUPABASE_ANON_KEY
   ```

### If Clerk Issues

1. **Check Clerk Status**: https://status.clerk.com
2. **Verify API Keys**:
   ```powershell
   echo $env:VITE_CLERK_PUBLISHABLE_KEY
   echo $env:CLERK_SECRET_KEY
   ```
3. **Fallback to Supabase**:
   ```powershell
   VITE_USE_CLERK_AUTH=false
   ```

---

## Quick Links

- **Local Dev**: http://localhost:5174
- **Production**: https://your-app.vercel.app
- **Supabase Dashboard**: https://app.supabase.com
- **Clerk Dashboard**: https://dashboard.clerk.com
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## Support Contacts

- **Supabase Support**: https://supabase.com/support
- **Clerk Support**: https://clerk.com/support
- **Vercel Support**: https://vercel.com/support

---

## Cheat Sheet

| Task | Command |
|------|---------|
| Start dev | `pnpm dev` |
| Build | `pnpm build` |
| Use Supabase | Set `VITE_USE_CLERK_AUTH=false` |
| Use Clerk | Set `VITE_USE_CLERK_AUTH=true` |
| Rollback code | `Copy-Item src\contexts\AuthContext.supabase.backup.jsx src\contexts\AuthContext.jsx -Force` |
| Export users | `node scripts/export-users.js` |
| Migrate users | `node scripts/migrate-users-to-clerk.js` |
| Deploy preview | `vercel` |
| Deploy prod | `vercel --prod` |
