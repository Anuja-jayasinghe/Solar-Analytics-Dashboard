# Admin Dashboard Mobile-Responsive Redesign

## Problem

The admin dashboard (`/admin/dashboard`) is desktop-only. It renders entirely
outside the main app's `Sidebar`/`BottomNav` layout shell, uses inline
`style={}` objects with no media queries anywhere, and its tables are fixed
desktop tables that overflow on small screens. Admin users get no usable
navigation or layout on mobile.

The main user dashboard already solves this well: one shared component tree,
CSS media queries at a `768px` breakpoint, a `Sidebar` (desktop) /
`BottomNav` (mobile) pair, and grids that reflow rather than get hidden. This
project applies the same pattern to admin.

## Scope

- `AdminDashboard.jsx` (layout shell + navigation)
- `UserManagement/` (active tab: users, roles, dashboard access)
- `CebDataManagement/` (active tab: CEB bill records, upload form,
  verification queue, PDF/image preview modal)
- Delete `AdminManagement/` and `UserAccessManagement/` — confirmed
  superseded duplicates of `UserManagement` (see below), not wired into the
  app anywhere (`grep` for both names only matches their own `index.jsx`
  files).

## Duplicate component finding

`UserManagement/index.jsx` (the live tab) already merges what
`AdminManagement` (promote/demote admin role) and `UserAccessManagement`
(demo/real dashboard access) do separately — its own doc comment calls it
"Unified User Management Component." The only capability in the legacy pair
that `UserManagement` lacks is **bulk operations** (multi-select checkboxes +
a bulk access-update bar), from `UserAccessManagement/BulkOperations.jsx`.
Decision: port bulk-select into `UserManagement`, then delete both legacy
folders. Wiring the legacy components in as-is (originally considered) was
rejected — it would produce two different UIs for the same role/access
edits.

## Design

### 1. Routing

Admin's two tabs become real nested routes instead of local `useState`
tab-switching, so navigation works the same way the main dashboard's
`BottomNav` does (route-driven active state, browser back/forward, direct
linking):

- `/admin/dashboard` → redirects to `/admin/dashboard/users`
- `/admin/dashboard/users` → `UserManagement`
- `/admin/dashboard/ceb-billing` → `CebDataManagement`

In `src/App.jsx`, the current single `<Route path="/admin/dashboard" .../>`
(line ~306-313) becomes `<Route path="/admin/dashboard/*" element={<RequireAdmin><AdminDashboard/></RequireAdmin>}>` wrapping nested
`<Route index .../>` (redirect) and the two tab routes, rendered via
`<Outlet/>` inside `AdminDashboard.jsx`. The existing catch-all
`<Route path="/admin/*" element={<NotFound />} />` stays, ordered after.

`AdminDashboard.jsx` stops owning `tab` state and `renderContent()`; it
becomes a layout shell: header + desktop tab nav (now `<NavLink>`s) +
`<Outlet/>` + `<AdminBottomNav/>`. The `admin_active_tab` localStorage key
and its read/write calls are removed (routing replaces it).

### 2. Mobile navigation

New file `src/components/admin/AdminBottomNav.jsx`, structurally mirroring
`src/components/BottomNav.jsx`'s markup and `<style>` block (`.bottom-nav`,
`.nav-item`, `.nav-item.active`, same `display: none` / `@media (max-width:
768px) { display: flex }` toggle, same fixed positioning, safe-area padding,
and blur/shadow treatment) but with exactly two nav items:

- Users (`User` icon from `lucide-react`) → `/admin/dashboard/users`
- CEB Billing (`FileText` icon) → `/admin/dashboard/ceb-billing`

No drawer/menu button needed (unlike the main `BottomNav`, which has a
third "Menu" item for theme/logout) — admin already has "Exit Admin" and
the user's email in its header; that header stays visible on mobile.

The existing desktop tab-button row in `AdminDashboard.jsx` is kept as-is
for desktop but hidden at `≤768px` (`.admin-tab-nav { display: none }` in
the mobile media query), the same mutually-exclusive-nav-mechanism pattern
`index.css` already uses for `.sidebar` vs `.bottom-nav`.

### 3. Layout & CSS conversion

New file `src/styles/admin.css` (imported once, e.g. from
`AdminDashboard.jsx`), following `index.css`'s existing conventions
(CSS custom properties for theme colors, `768px` breakpoint). Converts the
following from inline `style={}` to classes with mobile rules:

- `AdminDashboard.jsx`: `.admin-page`, `.admin-header`,
  `.admin-header-actions`, `.admin-tab-nav`, `.admin-tab-button`,
  `.admin-content-card`. Mobile: header stacks vertically, page padding
  drops from `2rem` to `1rem`, "Exit Admin" button label hides in favor of
  an icon-only button (text kept in `aria-label`/`title` for accessibility).
- Same class-based conversion applied to the equivalent header/container
  markup in `UserManagement/index.jsx` and `CebDataManagement/index.jsx`
  (currently also inline-styled `padding: '2rem', maxWidth: '1400px'`
  wrappers) and `CebForm.jsx` (upload form: labels stack above inputs,
  buttons go full-width on mobile).

### 4. Tables → mobile cards (CSS-only responsive table pattern)

Applies to `UserManagement/UserTable.jsx` and
`CebDataManagement/CebTable.jsx`. Both already render plain
`<table><thead><tr><th>` / `<tbody><tr><td>` structures with inline
`cellStyle`. Changes:

- Add a `data-label="<Column Name>"` attribute to every `<td>` (each table
  already has a fixed, known column list, so labels are hardcoded per cell,
  not computed).
- In `admin.css`, at `≤768px`:
  ```css
  .admin-table thead { display: none; }
  .admin-table, .admin-table tbody, .admin-table tr, .admin-table td {
    display: block; width: 100%;
  }
  .admin-table tr {
    margin-bottom: 12px; border: 1px solid var(--border-color);
    border-radius: 12px; padding: 12px; background: var(--card-bg);
  }
  .admin-table td {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 4px; border: none;
  }
  .admin-table td::before {
    content: attr(data-label); font-weight: 600;
    color: var(--text-secondary); margin-right: 12px;
  }
  ```
- Row-action controls (role/access `<select>`s, promote/demote buttons)
  render unchanged inside their `<td>` — they just end up right-aligned
  next to their label on mobile instead of in a table cell.
- Existing pagination controls (`useTablePagination`) are unaffected —
  they already render as a separate block below the table.

### 5. Bulk operations (ported into UserManagement)

- Copy `BulkOperations.jsx` (presentational: shows selected count + two
  action buttons) from `UserAccessManagement/` into
  `UserManagement/BulkOperations.jsx` unchanged.
- In `UserManagement/index.jsx`: add `selectedUsers` state (`Set`), a
  checkbox column in `UserTable` (header "select all" checkbox + per-row
  checkbox, both hidden gracefully into the card layout via the same
  `data-label`-less special-case — checkbox `<td>` gets `data-label=""`
  and left-aligned), and `handleBulkAccessChange` wired to the existing
  `/api/admin/users/:id` PATCH endpoint (same one `UserAccessManagement`
  used, one request per selected user via `Promise.all`, matching that
  component's original implementation).
- Reuses the existing `ConfirmDialog` already present in `UserManagement`
  for the bulk-confirm step (message adjusted to state the selected count).

### 6. PDF/image preview modal on mobile

`DocumentPreviewModal.jsx`: at `≤768px`, modal switches from the fixed
`maxWidth: 1000px` centered dialog to near-full-screen (`width: 100vw`,
`height: 100vh` or `100dvh`, no border-radius, close button moves to a
fixed top-right position). `PdfPreview.jsx`'s canvas rendering and
zoom/page controls need no logic changes — only the container sizing
around it changes.

### 7. Cleanup

- Delete `src/components/admin/AdminManagement/` (4 files) and
  `src/components/admin/UserAccessManagement/` (4 files) entirely, after
  Task 5 (bulk-select port) lands — nothing else imports them.

## Testing

- No existing test suite covers admin components (confirmed no
  `*.test.jsx` under `src/components/admin/`) — this project does not add
  one; verification is manual (resize browser + real mobile device, per
  existing project practice established in the PDF-preview fix).
- Each task's manual check: resize to `<768px` in devtools, confirm layout
  matches the design above (bottom nav appears, tables become cards, forms
  stack, modal goes full-screen), then confirm nothing regressed at
  desktop widths.

## Out of scope

- No new backend/API changes — bulk operations reuse the existing
  `/api/admin/users/:id` PATCH endpoint already used by both `UserManagement`
  and the legacy `UserAccessManagement`.
- No changes to `VerificationQueue.jsx`'s business logic — only its
  container/card CSS gets the same class-based mobile treatment as
  `CebForm.jsx` (folded into Task covering `CebDataManagement/index.jsx`
  since they share the same header/container pattern).
