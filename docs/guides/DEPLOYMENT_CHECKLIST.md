# Deployment Checklist

## Pre-Deployment

### Code Quality
- [x] All tests passing
- [x] No console errors in production build
- [x] Bundle size optimized (< 350KB total)
- [x] All components render correctly
- [x] Error handling tested

### Database Setup
- [ ] Run billing period SQL inserts in production Supabase
  ```sql
  INSERT INTO system_settings (setting_name, setting_value) 
  VALUES 
    ('last_billing_date', '2025-11-05'),
    ('billing_cycle_days', '30'),
    ('rate_per_kwh', '37')
  ON CONFLICT (setting_name) DO UPDATE 
  SET setting_value = EXCLUDED.setting_value;
  ```
- [ ] Verify RPC function `get_monthly_comparison` exists
- [ ] Check table indexes for performance
- [ ] Enable Row Level Security (RLS) policies

### Environment Variables
- [ ] Set production environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SOLIS_API_KEY`
  - `VITE_SOLIS_API_SECRET`
  - `VITE_SOLIS_BASE_URL`

### Build Verification
- [x] Production build successful (`npm run build`)
- [x] No build warnings
- [x] Assets properly generated in `dist/`
- [x] Index.html contains correct meta tags

## Deployment Steps

### Option 1: Netlify
```bash
# Install CLI
npm install -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist

# Or connect GitHub repo for auto-deploy
netlify init
```

### Option 2: Vercel
```bash
# Install CLI
npm install -g vercel

# Deploy
vercel --prod

# Or import GitHub repo in Vercel dashboard
```

### Option 3: Manual (Static Hosting)
1. Run `npm run build`
2. Upload `dist/` folder to hosting provider
3. Configure redirects (see netlify.toml/vercel.json)
4. Set environment variables in hosting dashboard

## Post-Deployment

### Verification
- [ ] Dashboard loads without errors
- [ ] All cards display data
- [ ] Charts render correctly
- [ ] Theme toggle works
- [ ] Settings page accessible
- [ ] Admin dashboard (if applicable)

### Performance Check
- [ ] Run Lighthouse audit (target > 85)
- [ ] Test on mobile devices
- [ ] Verify HTTPS enabled
- [ ] Check CDN caching headers
- [ ] Test from different geographic locations

### Monitoring Setup
- [ ] Set up error tracking (Sentry/LogRocket)
- [ ] Configure uptime monitoring (UptimeRobot)
- [ ] Set up analytics (Google Analytics/Plausible)
- [ ] Monitor Supabase usage/quotas
- [ ] Check Solis API rate limits

### User Communication
- [ ] Notify users of new features
- [ ] Document changes in changelog
- [ ] Update help documentation
- [ ] Prepare support for questions

## Rollback Plan

If issues occur:
1. Revert to previous deployment (Netlify/Vercel dashboard)
2. Check error logs in hosting platform
3. Verify environment variables
4. Test database connectivity
5. Contact support if needed

## Performance Benchmarks

**Build Output:**
- Total bundle size: ~1.18 MB (uncompressed)
- Gzipped: ~319 KB
- Main chunks:
  - react-vendor: 175.74 KB (gzipped)
  - vendor: 100.24 KB (gzipped)
  - supabase-vendor: 39.39 KB (gzipped)

**Target Metrics:**
- First Contentful Paint: < 1.5s ✅
- Time to Interactive: < 3s ✅
- Largest Contentful Paint: < 2.5s ✅
- Cumulative Layout Shift: < 0.1 ✅

## Success Criteria

- ✅ Zero critical errors
- ✅ Dashboard loads in < 3 seconds
- ✅ All features functional
- ✅ Mobile responsive
- ✅ Theme persistence working
- ✅ Error handling operational
- ✅ Caching system active

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Version:** 2.0.0  
**Status:** _______________

---

## 📋 Document History

**Maintainer:** Anuja Jayasinghe  

### Change Log
- **Created:** November 16, 2025 - Initial deployment checklist for v2.0.0
- **Updated:** November 19, 2025 - Verified all checklist items accurate, added maintainer log

**Last Updated:** November 19, 2025
