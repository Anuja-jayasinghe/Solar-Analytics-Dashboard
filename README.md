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

---

## 📝 Documentation

For comprehensive guides and development documentation, visit the **[Documentation Hub](./docs/README.md)**

### Quick Links:
* **[Testing Guide](./docs/guides/TESTING_GUIDE.md)** - Test procedures and checklists
* **[Deployment Checklist](./docs/guides/DEPLOYMENT_CHECKLIST.md)** - Production deployment
* **[Caching Guide](./docs/guides/DATA_REFRESH_AND_CACHING_GUIDE.md)** - Cache strategy
* **[Admin Improvements](./docs/development/ADMIN_IMPROVEMENT_NOTES.md)** - Future enhancements
* **[Changelog](./CHANGELOG.md)** - Version history

---

## 🤝 Contributing

Solar Analytics Dashboard is open to contributions! Feel free to fork, open issues, or submit pull requests. Ideas and suggestions are always welcome. 🛠️

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for more info.

---

## 👤 Author

* Developed by **Anuja Jayasinghe**
  🌐 [anujajay.com](https://anujajay.com)

  [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/anuja-jayasinghe/) [![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/Anuja-jayasinghe)

---

> Crafted with ☀️ to bring clarity to solar energy monitoring and maximize your renewable investment.

**Last Updated:** November 17, 2025  
**Version:** 2.0.0  
**Status:** Production Ready ✅ 
