# Testing Guide: Clerk Integration

## Quick Test Checklist

### Current State: Supabase Mode (VITE_USE_CLERK_AUTH=false)

Run these tests to verify no regressions:

1. **Landing Page** (http://localhost:5174)
   - [ ] Page loads
   - [ ] "Real Dashboard" button works
   - [ ] "Demo Dashboard" button works
   - [ ] Social links visible (GitHub, LinkedIn, anujajay.com)

2. **Authentication Flow**
   - [ ] Navigate to /admin
   - [ ] Login with Supabase credentials
   - [ ] Session persists after login
   - [ ] User data loaded correctly

3. **Dashboard Access**
   - [ ] Real dashboard loads at /dashboard
   - [ ] Demo dashboard loads at /demodashbaard
   - [ ] Dashboard shows correct data
   - [ ] Charts render properly

4. **Settings**
   - [ ] Settings accessible at /settings
   - [ ] Demo settings at /demosettings show banner
   - [ ] Demo users blocked from saving
   - [ ] Real users can save changes

5. **Admin Panel**
   - [ ] Admin login at /admin
   - [ ] Admin dashboard accessible for admin users
   - [ ] Non-admin users see access denied

6. **Console Logs**
   - [ ] No errors in browser console
   - [ ] Auth adapter logs show "Supabase adapter created"
   - [ ] Session loading logs appear

---

## Next: Switch to Clerk Mode

### Prerequisites
1. Clerk app created ✅
2. API keys in .env ✅
3. User metadata schema configured

### Configure Clerk Dashboard

1. **Go to Clerk Dashboard** → Your App → Configure

2. **Set up user metadata schema**:
   - Go to "Users & Authentication" → "Email, Phone, Username"
   - Enable "Email" and "Password" authentication
   - Go to "Customize session" → Set session lifetime to 30 days

3. **Create public metadata fields**:
   - Field: `role` (string) - Values: "admin" | "user"
   - Field: `dashboardAccess` (string) - Values: "real" | "demo"

4. **Configure paths**:
   - Sign-in URL: `/admin` (or create new /login)
   - Sign-up URL: `/signup` (if allowing public signup)
   - After sign-in: `/dashboard`
   - After sign-up: `/demodashbaard`

5. **Create test user**:
   - Go to "Users" → "Create user"
   - Email: your-test@email.com
   - Password: TestPassword123!
   - Public metadata:
     ```json
     {
       "role": "user",
       "dashboardAccess": "demo"
     }
     ```

### Enable Clerk Mode

1. **Update .env**:
   ```
   VITE_USE_CLERK_AUTH=true
   ```

2. **Restart dev server**:
   ```powershell
   # Press Ctrl+C to stop current server
   pnpm dev
   ```

3. **Watch console logs**:
   - Should see "Clerk adapter created"
   - No errors about missing Clerk dependencies

### Test Clerk Authentication

1. **Sign Up Flow** (if enabled):
   - [ ] Navigate to sign-up page
   - [ ] Enter email and password
   - [ ] Receive verification email
   - [ ] Verify email code
   - [ ] Redirected to demo dashboard
   - [ ] User metadata properly set

2. **Sign In Flow**:
   - [ ] Navigate to /admin (or /login)
   - [ ] Clerk sign-in component appears
   - [ ] Enter test user credentials
   - [ ] Successfully signed in
   - [ ] Redirected to appropriate dashboard
   - [ ] User data loaded from Clerk

3. **Session Management**:
   - [ ] Session persists after page refresh
   - [ ] Session persists across tabs
   - [ ] Session expires after 30 days (configured)

4. **Dashboard Access Control**:
   - [ ] Test user (demo access) sees demo dashboard
   - [ ] Real access user sees real dashboard
   - [ ] Access level read from publicMetadata.dashboardAccess

5. **Admin Features**:
   - [ ] Admin user (role: "admin") can access /admin/dashboard
   - [ ] Non-admin users blocked from admin panel
   - [ ] Admin status read from publicMetadata.role

6. **Sign Out**:
   - [ ] Sign out button works
   - [ ] Clerk session cleared
   - [ ] User redirected to landing page
   - [ ] Cannot access protected routes

### Common Issues & Fixes

**Issue**: "Clerk dependencies required when VITE_USE_CLERK_AUTH is true"
- **Fix**: Make sure ClerkProvider is wrapping app in App.jsx
- Check VITE_CLERK_PUBLISHABLE_KEY is set in .env

**Issue**: User metadata not loading
- **Fix**: Check Clerk Dashboard → User → Public metadata
- Ensure fields are in publicMetadata, not unsafeMetadata

**Issue**: Dashboard access always "demo"
- **Fix**: Verify `dashboardAccess` field set in Clerk user metadata
- Check SupabaseAuthAdapter.getDashboardAccess() is using correct logic

**Issue**: Sign-in component not appearing
- **Fix**: Clerk may need custom sign-in page
- Use Clerk's `<SignIn />` component or redirect to Clerk hosted pages

**Issue**: "Cannot read properties of undefined (reading 'user')"
- **Fix**: Clerk hooks may not be loaded yet
- Add loading state check before accessing user data

### Browser Console Expected Logs

**Supabase Mode**:
```
🔄 AuthContext: Initializing auth adapter...
🔧 Auth provider: Supabase
✅ Supabase adapter created
🔄 AuthContext: Loading initial session...
🔐 AuthContext: Session loaded: user@example.com
✅ AuthContext: Initialization complete
```

**Clerk Mode**:
```
🔄 AuthContext: Initializing auth adapter...
🔧 Auth provider: Clerk
✅ Clerk adapter created
🔄 AuthContext: Loading initial session...
🔐 AuthContext: Session loaded: user@example.com
✅ AuthContext: Initialization complete
```

---

## Performance Testing

### Metrics to Monitor

1. **Initial Load Time**:
   - Supabase mode: Baseline
   - Clerk mode: Should be similar (Clerk loads async)

2. **Auth Check Speed**:
   - Admin check with caching: < 100ms
   - Dashboard access resolution: < 150ms

3. **Memory Usage**:
   - Watch for memory leaks in auth listeners
   - Ensure unsubscribe functions called on unmount

### Load Testing

Test with multiple scenarios:
1. Fresh load (no session)
2. Existing session (should load instantly)
3. Expired session (should redirect to login)
4. Network offline (should handle gracefully)

---

## Rollback Instructions

### If Clerk Mode Has Issues

**Quick rollback** (keeps all code):
1. Set `VITE_USE_CLERK_AUTH=false` in .env
2. Restart dev server
3. App falls back to Supabase immediately

**Code rollback** (if adapter broken):
```powershell
Copy-Item "src\contexts\AuthContext.supabase.backup.jsx" "src\contexts\AuthContext.jsx" -Force
```

**Full rollback** (nuclear option):
```bash
git stash
git checkout main
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Clerk sign-in/out flows work
- [ ] User metadata properly loaded
- [ ] Dashboard access control works
- [ ] Admin status checked correctly
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Can toggle between Supabase/Clerk modes

### Ready for Phase 2 (Parallel Operation):
- [ ] Both auth systems tested independently
- [ ] No breaking changes to user experience
- [ ] Rollback tested and verified
- [ ] Team comfortable with Clerk setup

---

## Next Phase Preview

**Phase 2: Parallel Operation**
- Keep both Supabase and Clerk active
- Webhook handler syncs user data between systems
- Gradual user migration
- Monitor both systems for discrepancies

**Phase 3: User Migration**
- Export all Supabase users
- Create matching Clerk accounts
- Preserve metadata and settings
- Email users about authentication change

**Phase 4: Cutover**
- Set `VITE_USE_CLERK_AUTH=true` in production
- Monitor error rates and performance
- Keep Supabase as fallback for 30 days
- Remove Supabase code after validation period

---

## Support & Resources

- **Clerk Docs**: https://clerk.com/docs
- **Clerk React Quickstart**: https://clerk.com/docs/quickstarts/react
- **Clerk User Metadata**: https://clerk.com/docs/users/metadata
- **Clerk Webhooks**: https://clerk.com/docs/integrations/webhooks

- **Migration Plan**: `docs/development/CLERK_MIGRATION_PREPARATION.md`
- **Phase 0 Setup**: `docs/migration/PHASE_0_CLERK_SETUP.md`
- **Implementation Complete**: `docs/migration/PHASE_0_IMPLEMENTATION_COMPLETE.md`

---

## Questions to Answer During Testing

1. Does Clerk's sign-in UX match your design language?
2. Is the metadata approach sufficient for access control?
3. Do you need custom email templates in Clerk?
4. Should demo users be allowed to sign up freely?
5. How will you handle user migration communication?
6. What's the rollback trigger (error rate threshold)?
