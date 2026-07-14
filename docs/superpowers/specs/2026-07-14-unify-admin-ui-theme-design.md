# Unify Admin Dashboard UI with Public Dashboard Theme

## Problem

The admin section (`/admin/dashboard` and its sub-panels) uses a completely separate "retro-terminal/hacker" visual design — monospace fonts, CRT scanline overlay, ASCII art banner, sharp 1–2px borders, uppercase mono labels, and a customizable neon accent-color picker (`AdminThemeContext` / `adminTheme.js`). The public dashboard (Landing, Dashboard, Settings, etc.) uses a different, unrelated design language — Inter/system-ui font, rounded glass cards, a fixed orange (`--accent`) + teal (`--accent-secondary`) palette driven by CSS custom properties in `index.css`, and a light/dark theme toggle via `ThemeContext`.

This split makes the app feel like two different products. The goal is to unify the admin section onto the public dashboard's existing design system, with no new design language invented.

## Target design language

Admin adopts the public dashboard's existing tokens and patterns as-is:
- CSS custom properties from `src/index.css`: `--accent`, `--accent-secondary`, `--card-bg`, `--card-bg-solid`, `--card-border`, `--card-shadow`, `--text-color`, `--text-secondary`, `--text-muted`, `--border-color`, `--bg-color`, `--success-color`, `--warning-color`, `--error-color`
- Font: Inter/system-ui (no monospace, except where a genuinely tabular/code-like value benefits from it — a judgment call at implementation time, not a design requirement)
- Cards: rounded corners (12–16px), soft box-shadows (`0 8px 32px var(--card-shadow)`), semi-transparent backgrounds (`var(--card-bg)`) — matching the pattern already used in `Settings.jsx`, `DocumentPreviewModal.jsx`, and dashboard cards
- Buttons: solid `var(--accent)` primary buttons, outlined secondary buttons — matching existing public button conventions
- Respects the existing light/dark toggle automatically, since it's driven by the same CSS variables — no separate dark-only admin mode

Removed entirely:
- ASCII art banner, "CONTROL.CENTER" branding, CRT scanline overlay
- Monospace uppercase terminal-style labels/badges
- The customizable admin accent-color picker (color swatches in Sidebar's admin popup)

## Scope

**Deleted:**
- `src/components/admin/adminTheme.js`
- `src/contexts/AdminThemeContext.jsx`

**Restyled (visuals only — no logic, layout structure, or feature changes):**
- `src/pages/AdminDashboard.jsx` — page shell, header, tab navigation
- `src/pages/AdminLogin.jsx` — verify whether Clerk's `<SignIn/>` needs an `appearance` prop adjustment to visually match; otherwise leave as-is
- `src/components/admin/CebDataManagement/index.jsx`, `CebForm.jsx`, `CebTable.jsx`, `VerificationQueue.jsx`
- `src/components/admin/UserManagement/index.jsx`, `SearchBar.jsx`, `UserStats.jsx`, `UserTable.jsx`
- `src/components/admin/UserAccessManagement/index.jsx`, `BulkOperations.jsx`, `UserFilters.jsx`, `UserTable.jsx`
- `src/components/admin/AdminManagement/index.jsx`, `AdminSearch.jsx`, `AdminUsersList.jsx`, `RegularUsersList.jsx`
- `src/components/Sidebar.jsx` — the "AUTH_ROLE" admin-access popup and its color-swatch picker are replaced with a simple public-styled menu, reusing the dropdown pattern already used in `Landing.jsx`'s profile menu
- `src/components/BottomNav.jsx` — its admin entry point, restyled to match

**No changes needed:**
- `src/components/admin/CebDataManagement/DocumentPreviewModal.jsx` — already uses public CSS variables; serves as the reference pattern for the rest of this work

## Out of scope

- Any change to admin functionality, data flow, layout structure, tab organization, or table columns
- Any change to non-admin (public) pages or components
- Any change to the underlying auth/routing logic touched in the recent bug-fix session

## Verification

- `npm run build` and `npx eslint` after each component group, to catch syntax/import regressions
- Visual verification via a disposable test-admin Clerk account + headless browser (same technique used in the earlier ErrorBanner bug investigation) to capture before/after screenshots per admin page — requires the user's explicit OK each time a new sign-in token is minted, consistent with how that was handled previously
- Final visual pass by the user in their own browser before merge/deploy

## Rollout

Single branch `feat/unify-admin-ui-theme`, with one commit per component group (CebDataManagement, UserManagement, UserAccessManagement, AdminManagement, Sidebar/BottomNav, then deletion of the old theme files). Merged and deployed as one unit once the user has visually confirmed the result — not deployed incrementally, since a partially-migrated admin section would look broken (mixed terminal/public styling).
