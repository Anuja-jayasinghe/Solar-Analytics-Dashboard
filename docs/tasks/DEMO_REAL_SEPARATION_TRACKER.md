# Demo/Real Separation Tracker

Purpose: Track the separation of demo vs real dashboards and pages, including testing status.

| ID | Task | File/Path | Status | Owner | Notes |
|----|------|-----------|--------|-------|-------|
| 1  | Create DemoDataProvider (mock data) | `src/contexts/DemoDataContext.jsx` | Done | Copilot | Matches `DataContext` shape; static demo data |
| 2  | Demo Dashboard page | `src/pages/demo/DashboardDemo.jsx` | Done | Copilot | Wraps existing `Dashboard` with `DemoDataProvider` |
| 3  | Real Dashboard page | `src/pages/real/DashboardReal.jsx` | Done | Copilot | Re-exports existing `Dashboard` |
| 4  | Demo Settings page | `src/pages/demo/SettingsDemo.jsx` | Done | Copilot | Shows banner; functional blocking to be wired later |
| 5  | Real Settings page | `src/pages/real/SettingsReal.jsx` | Done | Copilot | Re-exports existing `Settings` |
| 6  | Demo test flag in Dashboard | `src/pages/Dashboard.jsx` | Done | Copilot | Uses `VITE_DEMO_TEST_MODE` to wrap with `DemoDataProvider` |
| 7  | Wire demo access blocking (Settings) | `src/pages/Settings.jsx` (via context) | Planned | — | Use `dashboardAccess` + modal to block saves |
| 8  | Add `dashboardAccess` to `AuthContext` | `src/contexts/AuthContext.jsx` | Planned | — | Values: `demo` / `real`; helper `hasRealAccess()` |
| 9  | Optional DB column `dashboard_access` | Supabase `admin_users` | Planned | — | Migration script to add column |
| 10 | Temporary test harness (without App.jsx) | `src/pages/demo/DemoSandbox.jsx` | Planned | — | Optional: lightweight router for local preview |
| 11 | Documentation updates | `docs/migration/*` | Planned | — | Link new pages and flow |

## Quick Test Instructions (No App.jsx changes)

- Option A (temporary import swap):
  - In `src/pages/Dashboard.jsx`, add at the top (temporary):
    ```js
    // TEMP TEST ONLY: uncomment next line to preview demo
    // export { default } from './demo/DashboardDemo';
    ```
  - Or for settings:
    ```js
    // TEMP TEST ONLY: uncomment next line to preview demo
    // export { default } from './demo/SettingsDemo';
    ```
  - Start dev server and navigate to existing routes.

- Option B (create sandbox route later):
  - Add `DemoSandbox.jsx` and wire under `/demo/*` in `App.jsx` when ready.

### New: Env-flag Demo Mode (no file swaps)

1) Add to your `.env`:
```
VITE_DEMO_TEST_MODE=true
```
2) Restart dev server and open `/dashboard`.
   The page will use `DemoDataProvider` automatically.

## Next Updates

- Wire `dashboardAccess` into `AuthContext` and block demo saves in Settings.
- Add a simple `DemoBlockModal` + `DemoAccessBanner` components.
- Optional: Add `/demo/dashboard` route once approved to touch `App.jsx`.

Last Updated: 2025-12-01
