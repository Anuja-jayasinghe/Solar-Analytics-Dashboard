# Admin Dashboard Mobile-Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin dashboard (`/admin/dashboard`) fully usable on mobile, following the same CSS-only, single-codebase responsive pattern the main user dashboard already uses (media queries at a 768px breakpoint, no separate mobile components/hooks).

**Architecture:** Admin's two tabs (User Management, CEB Billing Data) become real nested routes under `/admin/dashboard/*`, with a new `AdminBottomNav` (mirroring the main app's `BottomNav`) providing mobile navigation. Inline `style={}` layout in admin components converts to CSS classes in a new `src/styles/admin.css`, with mobile rules for headers, forms, and a CSS-only "table becomes card list" technique for the two data tables. One new capability (bulk user operations) is ported from a now-dead legacy component into the live `UserManagement`, after which the legacy duplicates are deleted.

**Tech Stack:** React 19, react-router-dom v6, plain CSS (no CSS-in-JS library, no Tailwind), lucide-react icons.

## Global Constraints

- Breakpoint: `768px` (`@media (max-width: 768px)`), matching `index.css`'s existing convention — do not introduce a different breakpoint value anywhere in this plan.
- No new JS hooks/libraries for responsiveness (no `useMediaQuery`, no `matchMedia` listener) — CSS media queries only, consistent with how the main dashboard achieves its mobile layout.
- Use existing CSS custom properties for all colors (`--accent`, `--card-bg`, `--card-bg-solid`, `--border-color`, `--text-color`, `--text-secondary`, `--text-muted`, `--error-color`, `--warning-color`, `--success-color`, `--hover-bg`, `--card-shadow`) — defined in `src/index.css` `:root` (dark) and its light-theme override block. Never hardcode a hex color that duplicates one of these.
- No backend/API changes. Bulk operations reuse the existing `/api/admin/users/:id` PATCH endpoint (body `{ dashboardAccess: 'real' | 'demo' }`), same one `UserManagement` already calls for individual access changes.
- No test suite exists for admin components today and this plan does not add one (confirmed: no `*.test.jsx` under `src/components/admin/`). Every task ends with a manual verification step instead: run `npm run dev`, resize the browser devtools viewport below 768px, and check the specific behavior the task describes, then check nothing regressed at a desktop width (e.g. 1280px).

---

### Task 1: Convert admin tabs to real routes

**Files:**
- Modify: `src/App.jsx:2` (import), `src/App.jsx:306-315` (route block)
- Modify: `src/pages/AdminDashboard.jsx` (full rewrite of tab logic → layout shell)

**Interfaces:**
- Produces: routes `/admin/dashboard` (redirects), `/admin/dashboard/users`, `/admin/dashboard/ceb-billing`. `AdminDashboard.jsx` renders `<Outlet/>` where tab content used to be switched locally. Later tasks (2, 3, 4) build on this shell existing.

- [ ] **Step 1: Add `Outlet` to the react-router-dom import in `App.jsx`**

In `src/App.jsx:3`, change:
```jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
```
to:
```jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
```

- [ ] **Step 2: Replace the single admin route with a nested route block**

In `src/App.jsx`, replace lines 306-313:
```jsx
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
```
with:
```jsx
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard/users" replace />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="ceb-billing" element={<CebDataManagement />} />
        </Route>
```

Leave lines 314-315 (`/admin` → redirect, `/admin/*` → `NotFound`) unchanged — they still work correctly since react-router matches the more specific `/admin/dashboard/*` nested routes first.

- [ ] **Step 3: Add imports for `UserManagement` and `CebDataManagement` to `App.jsx`**

Near the top of `src/App.jsx` (wherever other page-level component imports live — search for how `AdminDashboard` itself is currently imported, e.g. `import AdminDashboard from "./pages/AdminDashboard";`, and add directly below it):
```jsx
import UserManagement from "./components/admin/UserManagement";
import CebDataManagement from "./components/admin/CebDataManagement";
```

- [ ] **Step 4: Rewrite `AdminDashboard.jsx` as a layout shell**

Replace the full contents of `src/pages/AdminDashboard.jsx` with:
```jsx
import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";

const tabs = [
  { path: "users", label: "User Management" },
  { path: "ceb-billing", label: "CEB Billing Data" },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-header-title">🛠️ Admin Dashboard</h1>
          <p className="admin-header-subtitle">Manage users and billing data</p>
        </div>

        <div className="admin-header-actions">
          <button className="admin-exit-btn" onClick={() => navigate("/dashboard")} title="Exit Admin">
            ← <span className="admin-exit-btn-label">Exit Admin</span>
          </button>
          <span className="admin-header-email">{user?.email}</span>
        </div>
      </div>

      <div className="admin-tab-nav">
        {tabs.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `admin-tab-button${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="admin-content-card">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default AdminDashboard;
```

Note: this task intentionally leaves `AdminDashboard.jsx` referencing CSS classes (`admin-page`, `admin-header`, etc.) that don't exist yet — Task 2 creates `admin.css` with these classes. The page will be unstyled (but functionally correct/navigable) between Task 1 and Task 2; that's fine within a single work session, but if these land as separate commits reviewed independently, do Task 2 immediately after.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, log in as an admin, navigate to `/admin/dashboard`. Confirm:
- It redirects to `/admin/dashboard/users` and shows the User Management content.
- Clicking "CEB Billing Data" navigates to `/admin/dashboard/ceb-billing` and shows that content.
- Browser back button returns to the Users tab.
- Directly loading `/admin/dashboard/ceb-billing` in the address bar works (no full-page reload needed since it's client-side routed, but a hard refresh should also land correctly since it's server-rendered as the SPA shell).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/AdminDashboard.jsx
git commit -m "feat: convert admin tabs to real nested routes"
```

---

### Task 2: Admin layout CSS + AdminBottomNav for mobile

**Files:**
- Create: `src/styles/admin.css`
- Create: `src/components/admin/AdminBottomNav.jsx`
- Modify: `src/pages/AdminDashboard.jsx` (import CSS, render `AdminBottomNav`)

**Interfaces:**
- Consumes: `AdminDashboard.jsx`'s className structure from Task 1 (`admin-page`, `admin-header`, `admin-header-actions`, `admin-header-title`, `admin-header-subtitle`, `admin-exit-btn`, `admin-exit-btn-label`, `admin-header-email`, `admin-tab-nav`, `admin-tab-button`, `admin-content-card`).
- Produces: `.admin-table` class (used by Tasks 3 and 4 for the responsive table technique) and CSS custom-property-based theming already established.

- [ ] **Step 1: Create `src/styles/admin.css`**

```css
/* ===== Admin Dashboard Layout ===== */

.admin-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text-color);
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
}

.admin-header-title {
  margin: 0 0 0.4rem 0;
  color: var(--accent);
  font-size: 28px;
}

.admin-header-subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.admin-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.admin-exit-btn {
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.admin-header-email {
  font-size: 12px;
  color: var(--text-secondary);
}

.admin-tab-nav {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.admin-tab-button {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.2s ease;
  display: inline-block;
}

.admin-tab-button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.admin-content-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  min-height: 400px;
  box-shadow: 0 8px 32px var(--card-shadow);
}

/* ===== Responsive table → mobile card list ===== */
/* Applied via the shared .admin-table class on both CebTable and
   UserManagement/UserTable. Each <td> must carry a data-label attribute
   matching its column header for this to work. */

@media (max-width: 768px) {
  .admin-table thead {
    display: none;
  }

  .admin-table,
  .admin-table tbody,
  .admin-table tr {
    display: block;
    width: 100%;
  }

  .admin-table tr {
    margin-bottom: 12px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 12px;
    background: var(--card-bg);
  }

  .admin-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 4px;
    border: none !important;
    text-align: right;
  }

  .admin-table td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--text-secondary);
    margin-right: 12px;
    text-align: left;
  }

  .admin-table td[data-label=""] {
    justify-content: flex-start;
  }

  .admin-table td[data-label=""]::before {
    content: none;
    margin-right: 0;
  }
}

/* ===== Mobile layout adjustments ===== */

@media (max-width: 768px) {
  .admin-page {
    padding: 1rem;
  }

  .admin-header {
    flex-direction: column;
  }

  .admin-header-actions {
    align-items: flex-start;
    width: 100%;
  }

  .admin-tab-nav {
    display: none;
  }

  .admin-content-card {
    padding: 1rem;
    padding-bottom: calc(1rem + 65px + env(safe-area-inset-bottom));
  }

  .admin-exit-btn-label {
    display: none;
  }
}
```

- [ ] **Step 2: Create `src/components/admin/AdminBottomNav.jsx`**

```jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { Users, FileText } from "lucide-react";

export default function AdminBottomNav() {
  return (
    <>
      <style>{`
        .admin-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 65px;
          background: var(--navbar-bg, var(--card-bg-solid));
          border-top: 1px solid var(--border-color);
          display: none;
          justify-content: space-around;
          align-items: center;
          z-index: 1000;
          padding-bottom: env(safe-area-inset-bottom);
          box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
          backdrop-filter: blur(10px);
        }

        .admin-bottom-nav .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          height: 100%;
          color: var(--text-secondary);
          text-decoration: none;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .admin-bottom-nav .nav-item.active {
          color: var(--accent);
        }

        .admin-bottom-nav .nav-item svg {
          width: 22px;
          height: 22px;
          stroke-width: 2px;
        }

        .admin-bottom-nav .nav-label {
          font-size: 10px;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .admin-bottom-nav {
            display: flex;
          }
        }
      `}</style>

      <div className="admin-bottom-nav">
        <NavLink to="/admin/dashboard/users" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <Users />
          <span className="nav-label">Users</span>
        </NavLink>

        <NavLink to="/admin/dashboard/ceb-billing" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <FileText />
          <span className="nav-label">CEB Billing</span>
        </NavLink>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Wire the CSS import and `AdminBottomNav` into `AdminDashboard.jsx`**

In `src/pages/AdminDashboard.jsx`, add near the top (after the React import):
```jsx
import "../styles/admin.css";
import AdminBottomNav from "../components/admin/AdminBottomNav";
```

And render `<AdminBottomNav />` as the last element inside the top-level `<div className="admin-page">`, immediately after the closing `</div>` of `admin-content-card`:
```jsx
      <div className="admin-content-card">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>

      <AdminBottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

`npm run dev`, open `/admin/dashboard/users` in devtools with viewport width set to 375px (iPhone SE) and 768px exactly (boundary) and 1024px (desktop):
- At ≤768px: bottom nav bar appears with "Users" and "CEB Billing" items, correct one highlighted per route; top tab-button row is hidden; header stacks vertically; "Exit Admin" shows as icon only.
- At >768px: bottom nav is hidden, top tab row shows and still works exactly as before (click-to-navigate, active tab highlighted in accent color).
- Tapping the bottom nav items navigates correctly and updates the active highlight.

- [ ] **Step 5: Commit**

```bash
git add src/styles/admin.css src/components/admin/AdminBottomNav.jsx src/pages/AdminDashboard.jsx
git commit -m "feat: add mobile bottom nav and responsive layout CSS for admin dashboard"
```

---

### Task 3: User Management responsive table

**Files:**
- Modify: `src/components/admin/UserManagement/index.jsx`
- Modify: `src/components/admin/UserManagement/UserTable.jsx`

**Interfaces:**
- Consumes: `.admin-table` CSS class and responsive rules from Task 2's `admin.css`.

- [ ] **Step 1: Convert `UserManagement/index.jsx`'s inline header/container styles to classes**

In `src/components/admin/UserManagement/index.jsx`, replace the outer wrapper:
```jsx
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0', fontSize: '28px' }}>
          👥 User Management
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
          Manage user roles and dashboard access
        </p>
      </div>
```
with:
```jsx
    <div className="admin-section">
      {/* Header */}
      <div className="admin-section-header">
        <h2 className="admin-section-title">👥 User Management</h2>
        <p className="admin-section-subtitle">Manage user roles and dashboard access</p>
      </div>
```

Add these three classes to `src/styles/admin.css` (append to the file from Task 2):
```css
.admin-section {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.admin-section-header {
  margin-bottom: 2rem;
}

.admin-section-title {
  color: var(--accent);
  margin: 0 0 0.5rem 0;
  font-size: 28px;
}

.admin-section-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  .admin-section {
    padding: 1rem;
  }

  .admin-section-title {
    font-size: 22px;
  }
}
```

(These same three classes are reused unchanged by Task 4 for `CebDataManagement/index.jsx` — do not duplicate them.)

- [ ] **Step 2: Add `data-label` attributes and the `admin-table` class in `UserTable.jsx`**

In `src/components/admin/UserManagement/UserTable.jsx`, change the `<table>` opening tag:
```jsx
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
```
to:
```jsx
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
```

Add a `data-label` to each of the six `<td>` elements in the row-rendering map, matching the header text:
```jsx
                <td data-label="User" style={cellStyle}>
```
```jsx
                <td data-label="Email" style={cellStyle}>
```
```jsx
                <td data-label="Role" style={cellStyle}>
```
```jsx
                <td data-label="Access" style={cellStyle}>
```
```jsx
                <td data-label="Joined" style={cellStyle}>
```
```jsx
                <td data-label="Last Sign-in" style={cellStyle}>
```

(Six `<td>`s total, in the same order they already appear at lines 63, 86, 89, 110, 131, 136 — no other changes to their contents.)

- [ ] **Step 3: Manual verification**

`npm run dev`, go to `/admin/dashboard/users`, resize devtools to 375px width. Confirm:
- Table header row disappears; each user renders as a bordered card.
- Each field shows a bold label ("User", "Email", "Role", "Access", "Joined", "Last Sign-in") to the left of its value.
- Role/Access `<select>` dropdowns are still fully interactive and change the user's role/access correctly (check network tab or the success message banner).
- At 1024px width, the table renders exactly as it did before this task (no visual regression).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/UserManagement/index.jsx src/components/admin/UserManagement/UserTable.jsx src/styles/admin.css
git commit -m "feat: responsive card layout for User Management table on mobile"
```

---

### Task 4: CEB Billing Data responsive tables and forms

**Files:**
- Modify: `src/components/admin/CebDataManagement/index.jsx`
- Modify: `src/components/admin/CebDataManagement/CebTable.jsx`
- Modify: `src/components/admin/CebDataManagement/VerificationQueue.jsx`

**Interfaces:**
- Consumes: `.admin-table`, `.admin-section`, `.admin-section-header`, `.admin-section-title`, `.admin-section-subtitle` from Tasks 2-3's `admin.css`.

- [ ] **Step 1: Convert `CebDataManagement/index.jsx`'s outer wrapper and header to classes**

Replace:
```jsx
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto", color: "var(--text-color)" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ color: "var(--accent)", margin: "0 0 0.5rem 0", fontSize: "28px" }}>
          ⚙️ CEB Data Management
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "14px" }}>
          Manage your monthly CEB export readings and earnings.
          Current Tariff: <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
            {rate ? `LKR ${rate}/kWh` : "Not set"}
          </span>
        </p>
      </div>
```
with:
```jsx
    <div className="admin-section" style={{ maxWidth: "1000px" }}>
      {/* Header */}
      <div className="admin-section-header">
        <h2 className="admin-section-title">⚙️ CEB Data Management</h2>
        <p className="admin-section-subtitle">
          Manage your monthly CEB export readings and earnings.
          Current Tariff: <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
            {rate ? `LKR ${rate}/kWh` : "Not set"}
          </span>
        </p>
      </div>
```

(The inline `style={{ maxWidth: "1000px" }}` overrides `.admin-section`'s default `max-width: 1400px` for this narrower section — keep it, everything else about `.admin-section`'s padding/margin still applies.)

- [ ] **Step 2: Add `data-label` and `admin-table` class to the "Files In Storage" table**

In the same file, find the storage-files `<table>` (inside the collapsible "Files In Storage" section). Change:
```jsx
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
```
to:
```jsx
                  <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
```

Add `data-label` to each of its seven `<td>` elements, matching the header text (`Date`, `File`, `Status`, `Month`, `Units`, `Earnings`, `Actions`):
```jsx
                            <td data-label="Date" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: '11px' }}>
```
```jsx
                            <td data-label="File" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "var(--text-color)", fontWeight: '500' }}>
```
```jsx
                            <td data-label="Status" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)" }}>
```
```jsx
                            <td data-label="Month" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "#38bdf8", fontWeight: 'bold' }}>
```
```jsx
                            <td data-label="Units" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "var(--text-color)" }}>
```
```jsx
                            <td data-label="Earnings" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "#4caf50" }}>
```
```jsx
                            <td data-label="Actions" style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", textAlign: "right" }}>
```

- [ ] **Step 3: Add `data-label` and `admin-table` class to `CebTable.jsx`**

In `src/components/admin/CebDataManagement/CebTable.jsx`, change:
```jsx
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
```
to:
```jsx
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
```

Add a `data-label` to each of the twelve `<td>` elements (six in the `isEditing` branch, six in the display branch).

In the `isEditing` branch (currently six plain `<td style={cellStyle}>` openings in a row), change each opening tag, keeping everything inside unchanged:
```jsx
                      <td data-label="Date" style={cellStyle}>
                        <input
                          type="date"
                          value={editForm.bill_date}
                          onChange={(e) => onEditFormChange({ ...editForm, bill_date: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-label="Meter Reading" style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.meter_reading}
                          onChange={(e) => onEditFormChange({ ...editForm, meter_reading: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-label="Units Exported" style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.units_exported}
                          onChange={(e) => onEditFormChange({ ...editForm, units_exported: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-label="Earnings" style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.earnings}
                          onChange={(e) => onEditFormChange({ ...editForm, earnings: e.target.value })}
                          style={{ ...inputStyle, color: 'var(--success-color)' }}
                        />
                      </td>
                      <td data-label="Source" style={cellStyle}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fixed</div>
                      </td>
                      <td data-label="Actions" style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
```
(the `Actions` cell's Save/Cancel buttons inside stay exactly as they are — only the opening `<td>` tag changes).

In the display (non-editing) branch, change:
```jsx
                      <td style={cellStyle}>{row.bill_date}</td>
                      <td style={cellStyle}>{String(row.meter_reading || 0).padStart(6, '0')}</td>
                      <td style={cellStyle}>{row.units_exported || 0}</td>
                      <td style={{ ...cellStyle, color: 'var(--success-color)' }}>
                        {row.earnings ? `LKR ${row.earnings.toLocaleString()}` : 'LKR 00.00'}
                      </td>
                      <td style={cellStyle}>
```
to:
```jsx
                      <td data-label="Date" style={cellStyle}>{row.bill_date}</td>
                      <td data-label="Meter Reading" style={cellStyle}>{String(row.meter_reading || 0).padStart(6, '0')}</td>
                      <td data-label="Units Exported" style={cellStyle}>{row.units_exported || 0}</td>
                      <td data-label="Earnings" style={{ ...cellStyle, color: 'var(--success-color)' }}>
                        {row.earnings ? `LKR ${row.earnings.toLocaleString()}` : 'LKR 00.00'}
                      </td>
                      <td data-label="Source" style={cellStyle}>
```
and the final `Actions` cell in this branch:
```jsx
                      <td style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
```
to:
```jsx
                      <td data-label="Actions" style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
```
(the Edit/Delete buttons inside stay exactly as they are — only the opening `<td>` tag changes; the `Source` cell's badge/preview-button contents also stay unchanged).

- [ ] **Step 4: Mobile-friendly stacking for `VerificationQueue.jsx`'s editable field grid and header**

In `src/components/admin/CebDataManagement/VerificationQueue.jsx`, add a scoped `<style>` block (this component doesn't yet import `admin.css`-style classes — the simplest fix consistent with the component's existing all-inline-styles approach is one small `<style>` tag, matching the pattern already used in `DocumentPreviewModal.jsx` and `BottomNav.jsx`). Add directly after the opening `<div style={{ marginTop: '2rem', ...}}>` on line 294:

```jsx
    <div style={{ marginTop: '2rem', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 768px) {
          .verification-queue-fields-grid {
            grid-template-columns: 1fr !important;
          }
          .verification-queue-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 0.75rem;
          }
        }
      `}</style>
```

Then add the `verification-queue-header` class to the section header row (line 295):
```jsx
      <div className="verification-queue-header" style={{ background: 'rgba(255, 193, 7, 0.1)', borderBottom: '1px solid var(--border-color)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
```

And the `verification-queue-fields-grid` class to the editable fields grid (line 419):
```jsx
                              <div className="verification-queue-fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
```

- [ ] **Step 5: Manual verification**

`npm run dev`, go to `/admin/dashboard/ceb-billing`, resize to 375px width:
- CEB records table becomes a stacked card list with labels (same pattern as Task 3).
- Expand "Files In Storage" — that table also becomes a stacked card list.
- `CebForm`'s add-record inputs already stack to one column automatically (uses `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` — confirm this still holds, no change needed there).
- If there's an item in the Parsing Review Queue, confirm its two-column editable field grid becomes one column, and its header row (title + Refresh button) stacks instead of overflowing.
- At 1024px width, everything renders exactly as before this task.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/CebDataManagement/index.jsx src/components/admin/CebDataManagement/CebTable.jsx src/components/admin/CebDataManagement/VerificationQueue.jsx
git commit -m "feat: responsive card layout for CEB Billing tables and mobile field stacking"
```

---

### Task 5: Port bulk operations into User Management

**Files:**
- Create: `src/components/admin/UserManagement/BulkOperations.jsx`
- Modify: `src/components/admin/UserManagement/index.jsx`
- Modify: `src/components/admin/UserManagement/UserTable.jsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (existing, `src/components/shared/ConfirmDialog.jsx`, props: `open, title, message, confirmText, cancelText, onConfirm, onCancel, isLoading, isDangerous`), `useToast` (existing, `src/components/shared/ToastManager.jsx`, already imported in `UserManagement/index.jsx`).
- Produces: `UserTable` gains `selectedUsers` (Set), `onToggleSelect`, `onSelectAll` props (all required from this task forward — Task 3 already ran on the un-selectable version of this file, this task adds the checkbox column on top of Task 3's `data-label` changes).

- [ ] **Step 1: Create `src/components/admin/UserManagement/BulkOperations.jsx`**

Copy of the legacy component (from `src/components/admin/UserAccessManagement/BulkOperations.jsx`), unchanged:

```jsx
import React from 'react';

/**
 * Bulk Operations Component
 * Displays buttons for bulk user actions
 */
export default function BulkOperations({
  selectedCount = 0,
  onGrantRealAccess = () => {},
  onSetDemo = () => {},
  loading = false,
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
      padding: '1rem',
      marginBottom: '1.5rem',
      background: 'var(--card-bg)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      borderLeft: '4px solid var(--accent)'
    }}>
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>
        {selectedCount} selected:
      </span>

      <button
        onClick={onGrantRealAccess}
        disabled={loading}
        style={{
          padding: '8px 14px',
          background: '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        ✅ Grant Real Access
      </button>

      <button
        onClick={onSetDemo}
        disabled={loading}
        style={{
          padding: '8px 14px',
          background: '#ffc107',
          color: '#000',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        🧪 Set to Demo
      </button>
    </div>
  );
}
```

(Dropped the two `onMouseEnter`/`onMouseLeave` inline hover handlers from the legacy version — they're a pre-`:hover`-CSS pattern not used elsewhere in this codebase's newer components; harmless to omit, buttons keep their base colors on hover instead of darkening slightly.)

- [ ] **Step 2: Add checkbox column to `UserTable.jsx`**

In `src/components/admin/UserManagement/UserTable.jsx`, change the function signature:
```jsx
export default function UserTable({ users, loading, onRoleChange, onAccessChange }) {
```
to:
```jsx
export default function UserTable({ users, loading, onRoleChange, onAccessChange, selectedUsers, onToggleSelect, onSelectAll }) {
```

Add a header cell before `<th style={headerStyle}>User</th>` (inside the `<tr>` at line 46):
```jsx
              <th style={{ ...headerStyle, width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedUsers.size === users.length && users.length > 0}
                  onChange={onSelectAll}
                  disabled={users.length === 0}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </th>
```

Add a matching row cell as the first `<td>` in the row map (before the existing `data-label="User"` cell from Task 3), giving it an empty `data-label` so Task 2's CSS left-aligns it without a label prefix:
```jsx
                <td data-label="" style={cellStyle}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => onToggleSelect(user.id)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </td>
```

- [ ] **Step 3: Wire bulk-select state and bulk PATCH into `UserManagement/index.jsx`**

Add the new import at the top:
```jsx
import BulkOperations from './BulkOperations';
```

Add state, alongside the existing `useState` calls:
```jsx
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkTargetAccess, setBulkTargetAccess] = useState(null);
```

Add these handler functions, near `confirmChange`:
```jsx
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllUsers = () => {
    setSelectedUsers((prev) =>
      prev.size === filteredUsers.length ? new Set() : new Set(filteredUsers.map((u) => u.id))
    );
  };

  const requestBulkAccessChange = (newAccess) => {
    if (selectedUsers.size === 0) return;
    setBulkTargetAccess(newAccess);
    setBulkConfirmOpen(true);
  };

  const confirmBulkAccessChange = async () => {
    setBulkConfirmOpen(false);
    setLoading(true);
    setError('');
    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error('No auth token');

      const userIds = Array.from(selectedUsers);
      const responses = await Promise.all(
        userIds.map((userId) =>
          fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dashboardAccess: bulkTargetAccess })
          })
        )
      );

      if (!responses.every((r) => r.ok)) throw new Error('Some updates failed');

      setSuccessMessage(`Updated ${userIds.length} user(s) to ${bulkTargetAccess} access`);
      toast.success(`${userIds.length} user(s) updated`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (err) {
      console.error('Bulk update error:', err);
      setError(`Bulk update failed: ${err.message}`);
      toast.error('Bulk update failed');
    } finally {
      setLoading(false);
      setBulkTargetAccess(null);
    }
  };
```

Render `BulkOperations` conditionally, directly above the `UserTable` (before the `{loading && allUsers.length === 0 ? (...) : (...)}` block):
```jsx
      {selectedUsers.size > 0 && (
        <BulkOperations
          selectedCount={selectedUsers.size}
          onGrantRealAccess={() => requestBulkAccessChange('real')}
          onSetDemo={() => requestBulkAccessChange('demo')}
          loading={loading}
        />
      )}

```

Pass the new props to `UserTable`:
```jsx
        <UserTable
          users={filteredUsers}
          loading={loading}
          onRoleChange={handleRoleChange}
          onAccessChange={handleAccessChange}
          selectedUsers={selectedUsers}
          onToggleSelect={toggleUserSelection}
          onSelectAll={selectAllUsers}
        />
```

Add a second `ConfirmDialog` instance for the bulk action, alongside the existing one:
```jsx
      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Confirm Bulk Update"
        message={`Update ${selectedUsers.size} user(s) to ${bulkTargetAccess} access?`}
        onConfirm={confirmBulkAccessChange}
        onCancel={() => { setBulkConfirmOpen(false); setBulkTargetAccess(null); }}
        isLoading={loading}
        isDangerous={true}
      />
```

- [ ] **Step 4: Manual verification**

`npm run dev`, go to `/admin/dashboard/users`:
- A "select all" checkbox appears in the table header; per-row checkboxes appear in each card/row.
- Selecting one or more users shows the `BulkOperations` bar with the correct count.
- Clicking "Grant Real Access" or "Set to Demo" opens the confirm dialog with the right count and target; confirming sends one PATCH request per selected user (check devtools Network tab) and shows a success toast/message.
- At ≤768px, the checkbox renders at the start of each mobile card (left-aligned, no label prefix, thanks to the `data-label=""` CSS rule from Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/UserManagement/BulkOperations.jsx src/components/admin/UserManagement/index.jsx src/components/admin/UserManagement/UserTable.jsx
git commit -m "feat: add bulk user access operations to User Management"
```

---

### Task 6: Full-screen document preview modal on mobile

**Files:**
- Modify: `src/components/admin/CebDataManagement/DocumentPreviewModal.jsx`

**Interfaces:**
- None — self-contained CSS-only change to an existing component.

- [ ] **Step 1: Fix the overlay padding so the modal is truly full-screen on mobile**

The modal already has a `@media (max-width: 640px)` rule making `.doc-preview-modal` full-width/height, but its parent overlay `<div>` (the outermost one, `onClick={onClose}`) has an unconditional inline `padding: '2rem'`, which still insets the "full-screen" modal by 2rem on every side. Change the breakpoint to `768px` (this plan's standard) and zero out the overlay's padding at that width too.

Change the outer overlay `<div>`'s inline style from:
```jsx
        padding: '2rem',
```
to:
```jsx
        padding: '2rem',
```
(unchanged — the base/desktop style stays as-is) but give it a class so the media query can override it:
```jsx
      className="doc-preview-overlay"
```
Add this attribute to the outer `<div onClick={onClose} ...>` (the desktop padding stays inline; the class only carries the mobile override).

Then update the existing `<style>{...}</style>` block at the bottom of the component: replace
```
        @media (max-width: 640px) {
          .doc-preview-modal {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
        }
```
with:
```
        @media (max-width: 768px) {
          .doc-preview-overlay {
            padding: 0 !important;
          }
          .doc-preview-modal {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
        }
```

- [ ] **Step 2: Manual verification**

`npm run dev`, go to `/admin/dashboard/ceb-billing`, click "View Original Bill" (📄) on any record with an uploaded file, resize devtools to 375px width: the modal should now cover the entire viewport edge-to-edge (no visible gap/border around it), with the header (title + open/download/close icons) and PDF/image content still fully usable. At 1024px width, confirm the modal still renders as a centered dialog with padding around it, same as before.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/CebDataManagement/DocumentPreviewModal.jsx
git commit -m "fix: make document preview modal truly full-screen on mobile"
```

---

### Task 7: Delete superseded legacy admin components

**Files:**
- Delete: `src/components/admin/AdminManagement/` (4 files: `index.jsx`, `AdminSearch.jsx`, `AdminUsersList.jsx`, `RegularUsersList.jsx`)
- Delete: `src/components/admin/UserAccessManagement/` (4 files: `index.jsx`, `UserFilters.jsx`, `UserTable.jsx`, `BulkOperations.jsx`)

**Interfaces:**
- None — confirmed via `grep -rn "AdminManagement\|UserAccessManagement" src/` (excluding their own folders) that nothing else in the codebase imports either component. Task 5 already ported the one capability (`BulkOperations`) worth keeping.

- [ ] **Step 1: Verify no remaining references**

```bash
grep -rn "AdminManagement\|UserAccessManagement" src/ --include="*.jsx" --include="*.js" | grep -v "src/components/admin/AdminManagement/" | grep -v "src/components/admin/UserAccessManagement/"
```
Expected: no output. If anything appears, stop and investigate before deleting.

- [ ] **Step 2: Delete both directories**

```bash
git rm -r src/components/admin/AdminManagement src/components/admin/UserAccessManagement
```

- [ ] **Step 3: Confirm the app still builds**

```bash
npm run build
```
Expected: build succeeds with no import-resolution errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove AdminManagement and UserAccessManagement (superseded by unified User Management)"
```

---

## Final check

After all seven tasks: `npm run build` succeeds, and a full manual pass through `/admin/dashboard` at both a mobile width (375px) and desktop width (1280px) shows correct navigation, tables, forms, bulk operations, and the document preview modal, per each task's verification step above.
