"# ☀️ Solar Analytics Dashboard

Real-time solar power monitoring and analytics dashboard with advanced caching, error handling, and billing period tracking.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![React](https://img.shields.io/badge/react-19.2.0-blue)
![Vite](https://img.shields.io/badge/vite-7.1.10-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Core Functionality
- 📊 **Real-time Power Monitoring** - Live solar generation data with 5-minute updates
- 💰 **Earnings Tracking** - Total earnings calculation with CEB billing integration
- 📈 **Energy Charts** - Monthly comparison charts with billing period alignment
- 🌍 **Environmental Impact** - CO2 savings and tree equivalency metrics
- 🎯 **Daily Target Tracker** - Progress tracking against generation goals

### Advanced Features (Phase 1-4 Implementation)

#### 🚀 Performance & Caching
- **SWR (Stale-While-Revalidate)** - Instant page loads with cached data
- **Dual-layer Cache** - Memory + localStorage for reliability
- **Adaptive Polling** - Smart intervals (5m live, 15m charts/earnings)
- **Visibility-aware** - Pauses polling when tab hidden or offline
- **TTL-based Expiration** - Automatic cache invalidation

#### 🛡️ Error Handling & Resilience
- **Exponential Backoff** - Automatic retry with 30s → 1m → 5m delays
- **Error Classification** - Handles auth, rate-limit, server, transient errors
- **Circuit Breaker** - Pauses failing endpoints after 5 consecutive failures
- **Graceful Degradation** - Shows stale data during outages
- **User Notifications** - Banners for prolonged issues, modals for auth errors

#### 🎨 User Experience
- **Skeleton Loaders** - Smooth loading states with shimmer animations
- **Staleness Indicators** - Visual badges for data >10 minutes old
- **Refresh Indicator** - Real-time loading status with timestamps
- **Theme Support** - Dark/Light themes with persistence
- **Error Recovery** - Manual refresh buttons on all cards

#### 📅 Billing Period Accuracy
- **Dynamic Billing Cycles** - Calculates periods based on actual bill dates
- **Cross-month Support** - Handles month/year boundaries correctly
- **Chart Alignment** - Tooltips show exact billing periods (e.g., "Oct 05 - Nov 04")
- **Fallback Logic** - Defaults to calendar month if settings unavailable

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 19.2, Vite 7.1
- **Styling**: Custom CSS with CSS Variables for theming
- **Charts**: Recharts
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **API**: Solis Cloud API for inverter data

### Data Flow
```
User → Dashboard → DataContext (SWR) → Cache Check
                          ↓
                    Cache Hit? → Return Instantly
                          ↓
                    Background Fetch → Supabase/Solis API
                          ↓
                    Update State → Cache → UI Refresh
```

### Error Handling Flow
```
API Error → Classify (auth/rate-limit/server/transient)
     ↓
Retryable? → Yes → Schedule Retry (exponential backoff)
     ↓                    ↓
     No              Max Retries? → Circuit Breaker (30m pause)
     ↓                    ↓
Show Error Badge    ErrorBanner (>5min outage)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account
- Solis Cloud API credentials

### Environment Variables
Create a `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SOLIS_API_KEY=your_solis_api_key
VITE_SOLIS_API_SECRET=your_solis_secret
VITE_SOLIS_BASE_URL=https://www.soliscloud.com:13333
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd Solar-Analytics-Dashboard

# Install dependencies
npm install
# or
pnpm install

# Start development server
npm run dev
```

### Database Setup

Run these SQL commands in Supabase:

```sql
-- Billing period settings
INSERT INTO system_settings (setting_name, setting_value) 
VALUES 
  ('last_billing_date', '2025-11-05'),
  ('billing_cycle_days', '30'),
  ('rate_per_kwh', '37')
ON CONFLICT (setting_name) DO UPDATE 
SET setting_value = EXCLUDED.setting_value;

-- Create tables if not exists
CREATE TABLE IF NOT EXISTS inverter_data_daily_summary (
  id SERIAL PRIMARY KEY,
  summary_date DATE NOT NULL,
  total_generation_kwh NUMERIC(10, 3),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ceb_data (
  id SERIAL PRIMARY KEY,
  month_year VARCHAR(20),
  earnings NUMERIC(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create RPC function for monthly comparison
CREATE OR REPLACE FUNCTION get_monthly_comparison()
RETURNS TABLE (
  month_label TEXT,
  period_label TEXT,
  inverter_kwh NUMERIC,
  ceb_kwh NUMERIC
) AS $$
BEGIN
  -- Your RPC logic here
END;
$$ LANGUAGE plpgsql;
```

## 📱 Usage

### Dashboard
- **Live Power Dial** - Shows current generation in kW
- **Monthly Generation** - Total kWh for current billing period
- **Total Generation** - All-time generation from inverter
- **Total Earnings** - Cumulative earnings from CEB

### Charts
- **Energy Charts** - Monthly inverter vs CEB comparison
- **Earnings Breakdown** - Monthly earnings trend
- **Environmental Impact** - CO2 savings visualization
- **System Trends** - Performance analytics

### Admin Features
- CEB data management (CRUD operations)
- System settings configuration
- Cache statistics and controls

## 🧪 Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive testing procedures.

Quick tests:
```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Manual Testing Checklist
- [ ] Hard refresh → data loads from cache instantly
- [ ] Wait 10 minutes → stale badges appear
- [ ] Simulate offline → data persists, polling pauses
- [ ] Toggle theme → persists across navigation
- [ ] Hover chart → tooltips show billing periods

## 📊 Performance

### Metrics (Target vs Actual)
- **First Load**: < 3s ✅
- **Cached Load**: < 1s ✅
- **Time to Interactive**: < 3s ✅
- **Bundle Size**: < 500KB gzipped ✅
- **Cache Hit Rate**: > 80% ✅

### Optimizations
- Lazy loading for chart components
- Code splitting by route
- Memoized calculations
- Debounced API calls
- Optimistic UI updates

## 🔒 Security

- Environment variables for sensitive data
- Supabase Row Level Security (RLS)
- Rate limiting via circuit breakers
- Auth token refresh handling
- XSS protection via React escaping

## 📦 Deployment

### Build
```bash
npm run build
# Output: dist/
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Environment Variables (Production)
Set these in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SOLIS_API_KEY`
- `VITE_SOLIS_API_SECRET`
- `VITE_SOLIS_BASE_URL`

## 📝 Documentation

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive test procedures
- [IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md) - Phase 1-4 implementation checklist
- [CACHING_IMPLEMENTATION.md](./CACHING_IMPLEMENTATION.md) - Caching strategy details
- [ADMIN_IMPROVEMENT_NOTES.md](./ADMIN_IMPROVEMENT_NOTES.md) - Future admin enhancements

## 🛠️ Development

### Project Structure
```
src/
├── components/         # Reusable UI components
│   ├── dashboard/     # Dashboard-specific components
│   ├── admin/         # Admin panel components
│   └── SkeletonLoader.jsx, ErrorBanner.jsx, etc.
├── contexts/          # React Context providers
│   ├── DataContext.jsx       # Main data management
│   ├── AuthContext.jsx       # Authentication
│   └── ThemeContext.jsx      # Theme management
├── hooks/             # Custom React hooks
│   └── useData.js    # Data context consumer
├── lib/               # Utilities and services
│   ├── cacheService.js       # Caching layer
│   ├── dataService.js        # API calls
│   └── supabaseClient.js     # Supabase config
├── pages/             # Route components
│   ├── Dashboard.jsx
│   ├── Settings.jsx
│   └── AdminDashboard.jsx
└── assets/            # Static assets
```

### Key Files
- **DataContext.jsx** - Central state management with SWR, polling, error handling
- **cacheService.js** - Dual-layer cache with TTL expiration
- **Dashboard.jsx** - Main dashboard layout with lazy loading
- **ErrorBanner.jsx** - Prolonged outage notifications
- **AuthErrorModal.jsx** - Authentication error handling

## 🐛 Troubleshooting

### White Screen on Load
- Check browser console for errors
- Verify environment variables are set
- Clear cache and hard refresh (Ctrl + Shift + R)

### Data Not Updating
- Check network tab in DevTools
- Verify Supabase/Solis API credentials
- Check console for circuit breaker messages

### Theme Not Persisting
- Check localStorage in DevTools (Application tab)
- Verify ThemeContext is wrapping app
- Clear site data and test again

### Cache Issues
- Open console: `cacheService.clear()`
- Check localStorage size (max 5-10MB)
- Verify cache TTLs in cacheService.js

## 🎯 Roadmap

### Completed (Phase 1-5)
- ✅ SWR caching implementation
- ✅ Adaptive polling with visibility awareness
- ✅ Error handling with exponential backoff
- ✅ Circuit breaker pattern
- ✅ Billing period accuracy
- ✅ Theme persistence fix
- ✅ User notifications (banners/modals)

### Phase 6 (Optional)
- [ ] Cache statistics dashboard
- [ ] Context state inspector
- [ ] Advanced logging system

### Phase 7 (Optional)
- [ ] IndexedDB for larger datasets
- [ ] Request deduplication
- [ ] Prefetching strategies
- [ ] Background sync API

### Future Enhancements
- [ ] Mobile app (React Native)
- [ ] Push notifications for alerts
- [ ] Export data to CSV/PDF
- [ ] Multi-site support
- [ ] Advanced analytics (ML predictions)

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

## 👥 Authors

- **Development Team** - Initial work and Phase 1-4 implementation

## 🙏 Acknowledgments

- Solis Cloud API for inverter data
- Supabase for backend infrastructure
- Recharts for visualization
- React community for best practices

---

**Last Updated:** November 16, 2025  
**Version:** 2.0.0  
**Status:** Production Ready ✅" 
