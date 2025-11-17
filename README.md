"# ☀️ Solar Analytics Dashboard

**Solar Analytics Dashboard** is a modern web application that helps you monitor real-time solar power generation, track earnings, and visualize energy data with interactive charts. Built with React, Vite, and Supabase, it offers intelligent caching, billing period tracking, and admin management—all in a sleek dark/light theme UI.

### 🚀 **Live Website:**  
&nbsp;&nbsp;&nbsp;&nbsp;[![Website](https://img.shields.io/badge/solaredge.anujajay.com-000000?style=flat&logo=vercel&logoColor=white)](https://solaredge.anujajay.com/)  

### 💻 **GitHub Repo:**  
&nbsp;&nbsp;&nbsp;&nbsp;[![GitHub](https://img.shields.io/badge/Solar--Analytics--Dashboard-100000?style=flat&logo=github&logoColor=white)](https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard)

### 📊 **Badges:**
![Version](https://img.shields.io/badge/version-2.0.0-blue)
![React](https://img.shields.io/badge/react-19.2.0-blue)
![Vite](https://img.shields.io/badge/vite-7.1.10-purple)
![License](https://img.shields.io/badge/license-MIT-green)

<<<<<<< Updated upstream
=======
---

## 📌 Overview

Solar Analytics Dashboard was born out of the need to efficiently monitor solar panel performance and earnings. This modern energy tracker eliminates spreadsheet chaos with a comprehensive, real-time dashboard. Built for homeowners and businesses wanting clarity in their solar investment, it transforms raw inverter data into actionable insights—with elegant theming and performance optimization.

> "Why guess your solar performance when Solar Analytics Dashboard tracks, visualizes, and optimizes it for you?"

---

## 📚 Tech Stack

| Category           | Tech Used                                  |
| ------------------ | ------------------------------------------ |
| Framework          | [React 19.2](https://react.dev/)          |
| Build Tool         | [Vite 7.1](https://vitejs.dev/)           |
| Language           | JavaScript (ES6+)                          |
| Styling            | Custom CSS with CSS Variables              |
| Backend            | [Supabase](https://supabase.com/)          |
| Charts             | Recharts + Chart.js                        |
| Routing            | React Router DOM 7.9                       |
| API Integration    | Solis Cloud API                            |
| State Management   | React Context API                          |
| Caching            | SWR (Stale-While-Revalidate)              |

---

>>>>>>> Stashed changes
## ✨ Features

* 🔐 **Admin Authentication** with Google OAuth
* 📊 **Real-time Dashboard** for solar monitoring
* ⚡ **Live Power Tracking** with 5-minute updates
* 💰 **Earnings Calculator** with CEB billing integration
* 📈 **Interactive Charts** (Bar, Line, Area)
* 🌍 **Environmental Impact** metrics (CO2 savings)
* 🎯 **Daily Target Tracker** with progress visualization
* 🚀 **Advanced Caching** with SWR strategy
* 🎨 **Dark/Light Theme** with persistence
* 📅 **Billing Period Alignment** for accurate tracking
* 🛡️ **Error Resilience** with circuit breaker pattern
* 💾 **Dual-layer Cache** (Memory + LocalStorage)
* ⚙️ **Admin Panel** for CEB data management
* 📱 **Responsive Design** for all devices

---

## 📁 Project Structure

```
.
├── src/
│   ├── components/     # Reusable React components
│   ├── contexts/       # Context providers (Auth, Data, Theme)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and services
│   ├── pages/          # Route components
│   └── assets/         # Static assets
├── api/                # Serverless API functions
├── docs/               # Documentation hub
├── public/             # Public static files
├── scripts/            # Utility scripts
├── package.json        # Project metadata and scripts
└── vite.config.js      # Vite configuration
```

---

## 🛠 Development Commands

<<<<<<< Updated upstream
## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 19.2, Vite 7.1
- **Styling**: Custom CSS with CSS Variables for theming
- **Charts**: Recharts
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **API**: Solis Cloud API for inverter data
=======
* `npm run dev` — Start dev server
* `npm run build` — Create production build
* `npm run preview` — Preview production build
* `npm run lint` — Check for code issues

---

## 📌 Pages Overview

| Page                | Description                              |
| ------------------- | ---------------------------------------- |
| `/`                 | Main dashboard / Landing                 |
| `/dashboard`        | Private dashboard with full analytics    |
| `/settings`         | System configuration and preferences     |
| `/admin`            | Admin authentication                     |
| `/admin/dashboard`  | Admin panel for CEB data management      |

---

## 🏗️ Architecture Details
>>>>>>> Stashed changes

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

---

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

## 📦 Deployment

<<<<<<< Updated upstream
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
=======
* **Frontend**: Deployed on [Vercel](https://vercel.com) at [solaredge.anujajay.com](https://solaredge.anujajay.com/)
* **Backend**: Powered by Supabase + Solis Cloud API
* **Admin Security**: Google OAuth + Database role verification

---

## 📊 Performance Metrics

| Metric              | Target  | Status |
| ------------------- | ------- | ------ |
| First Load          | < 3s    | ✅     |
| Cached Load         | < 1s    | ✅     |
| Time to Interactive | < 3s    | ✅     |
| Bundle Size         | < 500KB | ✅     |
| Cache Hit Rate      | > 80%   | ✅     |

**Optimizations:**
* Lazy loading for chart components
* Code splitting by route
* SWR caching strategy
* Memoized calculations
* Debounced API calls
>>>>>>> Stashed changes

---

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

<<<<<<< Updated upstream
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
=======
---

## 🤝 Contributing

Solar Analytics Dashboard is open to contributions! Feel free to fork, open issues, or submit pull requests. Ideas and suggestions are always welcome. 🛠️

---
>>>>>>> Stashed changes

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for more info.

---

<<<<<<< Updated upstream
**Last Updated:** November 16, 2025  
=======
## 👤 Author

* Developed by **Anuja Jayasinghe**
  🌐 [anujajay.com](https://anujajay.com)

  [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/anuja-jayasinghe/) [![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/Anuja-jayasinghe)

---

> Crafted with ☀️ to bring clarity to solar energy monitoring and maximize your renewable investment.

**Last Updated:** November 17, 2025  
>>>>>>> Stashed changes
**Version:** 2.0.0  
**Status:** Production Ready ✅" 
