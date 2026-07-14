# Unify Admin Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the admin section (currently a separate "retro-terminal" design) to visually match the public dashboard's existing design system, with zero functional/behavioral changes.

**Architecture:** Pure CSS-in-JS style-object replacement. Every `theme.colors.X` / `theme.fonts.mono` / uppercase-mono-label reference gets replaced with the equivalent CSS custom property (`var(--accent)`, `var(--card-bg)`, etc.) already defined in `src/index.css`, following patterns already used by sibling admin components that are already public-styled (`CebDataManagement/index.jsx`, `VerificationQueue.jsx`, `UserAccessManagement/*`, `AdminManagement/*`). No new components, no new CSS variables, no layout restructuring.

**Tech Stack:** React 19, inline style objects (no CSS modules/styled-components in this codebase), CSS custom properties for theming.

## Global Constraints

- Visual restyle only — every task must preserve existing props, handlers, state, and data flow exactly. If a step would change what a function does (not just how it looks), stop and flag it rather than proceeding.
- Reuse `var(--accent)`, `var(--accent-secondary)`, `var(--card-bg)`, `var(--card-bg-solid)`, `var(--card-border)`, `var(--card-shadow)`, `var(--text-color)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--border-color)`, `var(--bg-color)` from `src/index.css` — do not invent new tokens.
- No monospace fonts, uppercase terminal-style labels, scanline effects, or ASCII art in the final result.
- Commit after every task (already-small, single-file or single-concern changes — no need to split further).

## Scope Resolution

The design spec listed ~20 files as candidates for restyling. Reading every file during plan-writing found that most already use the public CSS variables and need **no changes at all** — the terminal theme (`AdminThemeContext`/`adminTheme.js`) turned out to be used in only 6 places. This plan's tasks cover exactly those 6; everything below is confirmed to need zero changes and has no task:

- `src/components/admin/CebDataManagement/index.jsx` — already public-styled (Task 0 only touches it to merge in the pending preview-modal work, unrelated to theming)
- `src/components/admin/CebDataManagement/VerificationQueue.jsx` — already public-styled
- `src/components/admin/UserManagement/index.jsx` — already public-styled
- `src/components/admin/UserManagement/SearchBar.jsx` — already public-styled
- `src/components/admin/UserAccessManagement/index.jsx`, `BulkOperations.jsx`, `UserFilters.jsx` — already public-styled (only `UserTable.jsx` needed the Task 8 pagination-color polish)
- `src/components/admin/AdminManagement/index.jsx`, `AdminSearch.jsx` — already public-styled (only `AdminUsersList.jsx`/`RegularUsersList.jsx` needed the Task 8 pagination-color polish)
- `src/components/BottomNav.jsx` — its admin drawer entry never used `adminTheme`; already plain CSS-class styling
- `src/pages/AdminLogin.jsx` — already uses `var(--accent)`/`var(--card-bg)`/etc. throughout; no `adminTheme` import

---

### Task 0: Merge the pending CEB preview modal branch

This branch was built and verified working in an earlier session (fixes the CEB bill preview to be mobile-friendly) but was never merged — work got diverted into an unrelated navigation bug. It touches `CebDataManagement/index.jsx`, which Task with later work in this plan does not touch, so merging first avoids any conflict.

**Files:**
- Merges: `src/components/admin/CebDataManagement/index.jsx`, `src/components/admin/CebDataManagement/DocumentPreviewModal.jsx` (from branch `feat/ceb-preview-modal-mobile-styling`)

- [ ] **Step 1: Confirm the branch still exists and check its diff**

Run: `git log --oneline main..feat/ceb-preview-modal-mobile-styling`
Expected: one commit, `feat: restyle CEB document preview modal and make it mobile-friendly`

- [ ] **Step 2: Merge it into main**

```bash
git checkout main
git merge --no-ff feat/ceb-preview-modal-mobile-styling -m "Merge feat/ceb-preview-modal-mobile-styling: mobile-friendly CEB bill preview modal"
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds with no errors

- [ ] **Step 4: Push**

```bash
git push origin main
```

(No separate commit needed — this task's "commit" is the merge itself.)

---

### Task 1: Restyle `CebForm.jsx`

**Files:**
- Modify: `src/components/admin/CebDataManagement/CebForm.jsx` (full replacement)

**Interfaces:**
- Consumes: `form` (object with `bill_date`, `meter_reading`, `units_exported`, `earnings`, `account_number`, `billing_month`), `onFormChange(newForm)`, `onSubmit(event)`, `loading` (bool) — unchanged from current props
- Produces: nothing new; same default export shape

- [ ] **Step 1: Replace the file content**

```jsx
import React from 'react';

/**
 * CEB Data Form Component
 * Manual entry form for new CEB billing records
 */
export default function CebForm({
  form = { bill_date: '', meter_reading: '', units_exported: '', earnings: '', account_number: '', billing_month: '' },
  onFormChange = () => {},
  onSubmit = () => {},
  loading = false
}) {
  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg-solid)',
    color: 'var(--text-color)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  };

  const buttonStyle = {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    opacity: loading ? 0.7 : 1,
    transition: 'all 0.2s ease'
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '2rem',
        background: 'var(--card-bg)',
        padding: '1.25rem',
        border: '1px solid var(--border-color)',
        borderRadius: '10px'
      }}
    >
      <div style={{
        gridColumn: '1 / -1',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--accent)'
      }}>
        Add New Record
      </div>

      <input
        type="date"
        value={form.bill_date}
        onChange={(e) => {
           const date = e.target.value;
           let derivedMonth = form.billing_month;
           if (date && !form.billing_month) {
              const d = new Date(date);
              const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
              derivedMonth = `${d.getFullYear()} ${months[d.getMonth()]}`;
           }
           onFormChange({ ...form, bill_date: date, billing_month: derivedMonth });
        }}
        required
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Account Number"
        value={form.account_number}
        onChange={(e) => onFormChange({ ...form, account_number: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Billing Month (YYYY MMM)"
        value={form.billing_month}
        onChange={(e) => onFormChange({ ...form, billing_month: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Meter Reading"
        value={form.meter_reading}
        onChange={(e) => onFormChange({ ...form, meter_reading: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Units Exported"
        value={form.units_exported}
        onChange={(e) => onFormChange({ ...form, units_exported: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Earnings (LKR)"
        value={form.earnings}
        onChange={(e) => onFormChange({ ...form, earnings: e.target.value })}
        required
        style={inputStyle}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Saving...' : 'Add Record'}
      </button>
    </form>
  );
}
```

Note: the `months` array stays uppercase (`'JAN'`, `'FEB'`...) — this feeds `billing_month`, which is used as part of an `onConflict` upsert key against existing database rows. Changing case here would be a functional/data change, not a visual one, so it's deliberately preserved exactly as before.

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/components/admin/CebDataManagement/CebForm.jsx`
Expected: no errors (the `AdminThemeContext`/`adminTheme` imports are gone, so no unused-import warnings either)

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/CebDataManagement/CebForm.jsx
git commit -m "style: unify CebForm.jsx with public dashboard design"
```

---

### Task 2: Restyle `CebTable.jsx`

**Files:**
- Modify: `src/components/admin/CebDataManagement/CebTable.jsx` (full replacement)

**Interfaces:**
- Consumes: same props as before — `data`, `currentPage`, `itemsPerPage`, `totalItems`, `onPageChange`, `onItemsPerPageChange`, `onEdit`, `onDelete`, `loading`, `editingId`, `editForm`, `onEditFormChange`, `onSaveEdit`, `onCancelEdit`, `onPreview` — no signature changes
- Produces: nothing new

- [ ] **Step 1: Replace the file content**

```jsx
import React from 'react';

/**
 * CEB Data Table Component
 * Displays CEB billing records with inline editing and pagination
 */
export default function CebTable({
  data = [],
  currentPage = 1,
  itemsPerPage = 20,
  totalItems = 0,
  onPageChange = () => {},
  onItemsPerPageChange = () => {},
  onEdit = () => {},
  onDelete = () => {},
  loading = false,
  editingId = null,
  editForm = null,
  onEditFormChange = () => {},
  onSaveEdit = () => {},
  onCancelEdit = () => {},
  onPreview = () => {}
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  if (loading && data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        <p>Loading records...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        color: 'var(--text-secondary)',
        border: '1px dashed var(--border-color)',
        borderRadius: '10px'
      }}>
        <p>No CEB data records found</p>
      </div>
    );
  }

  const headerStyle = {
    textAlign: 'left',
    padding: '0.9rem 1rem',
    color: 'var(--accent)',
    fontWeight: '600',
    fontSize: '12px',
    borderBottom: '2px solid var(--border-color)'
  };

  const cellStyle = {
    padding: '0.8rem 1rem',
    color: 'var(--text-color)',
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)',
    position: 'relative'
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--card-bg-solid)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-color)',
    padding: '4px 8px',
    fontSize: '13px',
    outline: 'none',
    borderRadius: '4px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              <th style={headerStyle}>Date</th>
              <th style={headerStyle}>Meter Reading</th>
              <th style={headerStyle}>Units Exported</th>
              <th style={headerStyle}>Earnings</th>
              <th style={headerStyle}>Source</th>
              <th style={headerStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isEditing = editingId === row.id;

              return (
                <tr key={row.id} style={{
                  transition: 'all 0.2s ease',
                  background: isEditing ? 'rgba(255, 122, 0, 0.06)' : 'transparent',
                  borderLeft: isEditing ? '3px solid var(--accent)' : '3px solid transparent'
                }}
                onMouseEnter={(e) => !isEditing && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => !isEditing && (e.currentTarget.style.background = 'transparent')}
                >
                  {isEditing ? (
                    <>
                      <td style={cellStyle}>
                        <input
                          type="date"
                          value={editForm.bill_date}
                          onChange={(e) => onEditFormChange({ ...editForm, bill_date: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.meter_reading}
                          onChange={(e) => onEditFormChange({ ...editForm, meter_reading: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.units_exported}
                          onChange={(e) => onEditFormChange({ ...editForm, units_exported: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.earnings}
                          onChange={(e) => onEditFormChange({ ...editForm, earnings: e.target.value })}
                          style={{ ...inputStyle, color: 'var(--success-color)' }}
                        />
                      </td>
                      <td style={cellStyle}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fixed</div>
                      </td>
                      <td style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
                        <button
                          onClick={onSaveEdit}
                          disabled={loading}
                          style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={onCancelEdit}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={cellStyle}>{row.bill_date}</td>
                      <td style={cellStyle}>{String(row.meter_reading || 0).padStart(6, '0')}</td>
                      <td style={cellStyle}>{row.units_exported || 0}</td>
                      <td style={{ ...cellStyle, color: 'var(--success-color)' }}>
                        {row.earnings ? `LKR ${row.earnings.toLocaleString()}` : 'LKR 00.00'}
                      </td>
                      <td style={cellStyle}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                               fontSize: '10px',
                               padding: '2px 6px',
                               background: row.data_source === 'manual_entry' ? 'rgba(255,255,255,0.05)' : 'rgba(255, 122, 0, 0.12)',
                               color: row.data_source === 'manual_entry' ? 'var(--text-muted)' : 'var(--accent)',
                               border: `1px solid ${row.data_source === 'manual_entry' ? 'var(--border-color)' : 'var(--accent)'}40`,
                               borderRadius: '4px'
                            }}>
                               {row.data_source === 'manual_entry' ? 'Manual' : 'Parsed'}
                            </span>
                            {row.file_path && (
                               <button
                                  onClick={() => onPreview && onPreview(row.file_path)}
                                  title="View Original Bill"
                                  style={{
                                    color: 'var(--accent)',
                                    fontSize: '14px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                               >
                                  📄
                               </button>
                            )}
                         </div>
                      </td>
                      <td style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
                        <button
                          onClick={() => onEdit(row)}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(row)}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: 'var(--error-color)',
                            border: '1px solid var(--error-color)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalItems > itemsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          fontSize: '13px'
        }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '6px 12px',
                background: currentPage === 1 ? 'var(--hover-bg)' : 'var(--accent)',
                color: currentPage === 1 ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              ← Prev
            </button>

            <div style={{ color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages || 1}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{
                padding: '6px 12px',
                background: currentPage >= totalPages ? 'var(--hover-bg)' : 'var(--accent)',
                color: currentPage >= totalPages ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage >= totalPages || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Next →
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              disabled={loading}
              style={{
                background: 'var(--card-bg-solid)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/components/admin/CebDataManagement/CebTable.jsx`
Expected: no errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/CebDataManagement/CebTable.jsx
git commit -m "style: unify CebTable.jsx with public dashboard design"
```

---

### Task 3: Restyle `UserManagement/UserStats.jsx`

**Files:**
- Modify: `src/components/admin/UserManagement/UserStats.jsx` (full replacement)

**Interfaces:**
- Consumes: `users` (array), `loading` (bool) — unchanged
- Produces: nothing new

- [ ] **Step 1: Replace the file content**

```jsx
import React from 'react';
import SkeletonLoader from '../../shared/SkeletonLoader';

export default function UserStats({ users, loading }) {
  if (loading) {
    return <SkeletonLoader variant="stats" />;
  }

  const admins = users.filter(u => u.role === 'admin');
  const regularUsers = users.filter(u => u.role !== 'admin');
  const realAccessUsers = users.filter(u => u.dashboardAccess === 'real');
  const demoAccessUsers = users.filter(u => u.dashboardAccess === 'demo');

  const stats = [
    { label: 'Total Users', value: users.length, color: 'var(--accent)' },
    { label: 'Admins', value: admins.length, color: 'var(--error-color)' },
    { label: 'Regular Users', value: regularUsers.length, color: 'var(--success-color)' },
    { label: 'Real Access', value: realAccessUsers.length, color: 'var(--warning-color)' },
    { label: 'Demo Access', value: demoAccessUsers.length, color: 'var(--text-muted)' }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    }}>
      {stats.map((stat, index) => (
        <div
          key={index}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1.25rem'
          }}
        >
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            {stat.label}
          </div>

          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            color: stat.color
          }}>
            {stat.value}
          </div>

          <div style={{
            marginTop: '0.8rem',
            height: '4px',
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '2px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min((stat.value / (users.length || 1)) * 100, 100)}%`,
              background: stat.color,
              borderRadius: '2px'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/components/admin/UserManagement/UserStats.jsx`
Expected: no errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/UserManagement/UserStats.jsx
git commit -m "style: unify UserStats.jsx with public dashboard design"
```

---

### Task 4: Restyle `UserManagement/UserTable.jsx`

**Files:**
- Modify: `src/components/admin/UserManagement/UserTable.jsx` (full replacement)

**Interfaces:**
- Consumes: `users`, `loading`, `onRoleChange(userId, newRole, userName)`, `onAccessChange(userId, newAccess, userName)` — unchanged
- Produces: nothing new

- [ ] **Step 1: Replace the file content**

```jsx
import React from 'react';
import { formatDateDDMMYYYY } from '../../../lib/dateFormatter';

export default function UserTable({ users, loading, onRoleChange, onAccessChange }) {
  if (users.length === 0) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '3rem',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        No users found
      </div>
    );
  }

  const headerStyle = {
    textAlign: 'left',
    padding: '0.9rem 1rem',
    color: 'var(--accent)',
    fontWeight: '600',
    fontSize: '12px',
    borderBottom: '2px solid var(--border-color)'
  };

  const cellStyle = {
    padding: '0.8rem 1rem',
    color: 'var(--text-color)',
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)'
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={headerStyle}>User</th>
              <th style={headerStyle}>Email</th>
              <th style={headerStyle}>Role</th>
              <th style={headerStyle}>Access</th>
              <th style={headerStyle}>Joined</th>
              <th style={headerStyle}>Last Sign-in</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                style={{ transition: 'background 0.15s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ fontWeight: '600' }}>
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : 'Unnamed User'}
                    </div>
                  </div>
                </td>
                <td style={cellStyle}>
                  <span style={{ color: 'var(--text-secondary)' }}>{user.email || 'No email'}</span>
                </td>
                <td style={cellStyle}>
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => onRoleChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.role === 'admin' ? 'rgba(220, 53, 69, 0.12)' : 'var(--card-bg-solid)',
                      color: user.role === 'admin' ? 'var(--error-color)' : 'var(--text-color)',
                      border: `1px solid ${user.role === 'admin' ? 'var(--error-color)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td style={cellStyle}>
                  <select
                    value={user.dashboardAccess || 'demo'}
                    onChange={(e) => onAccessChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.dashboardAccess === 'real' ? 'rgba(245, 158, 11, 0.12)' : 'var(--card-bg-solid)',
                      color: user.dashboardAccess === 'real' ? 'var(--warning-color)' : 'var(--text-muted)',
                      border: `1px solid ${user.dashboardAccess === 'real' ? 'var(--warning-color)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="demo">Demo</option>
                    <option value="real">Real</option>
                  </select>
                </td>
                <td style={cellStyle}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDateDDMMYYYY(user.createdAt)}
                  </span>
                </td>
                <td style={cellStyle}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDateDDMMYYYY(user.lastSignInAt, 'Never')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/components/admin/UserManagement/UserTable.jsx`
Expected: no errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/UserManagement/UserTable.jsx
git commit -m "style: unify UserManagement/UserTable.jsx with public dashboard design"
```

---

### Task 5: Restyle Sidebar's admin-access popup

Removes the color-preset picker entirely (per approved design decision) and reskins the popup to match `Landing.jsx`'s existing profile-dropdown-menu style (rounded card, `var(--card-bg-solid)`, `var(--accent)` primary button).

**Files:**
- Modify: `src/components/Sidebar.jsx:1-96` (imports and state) and `src/components/Sidebar.jsx:352-574` (the popup JSX block)

**Interfaces:**
- Consumes: existing `showAdminPopup`, `setShowAdminPopup`, `isAdmin`, `user`, `navigate` — all already in scope in this component, unchanged
- Produces: nothing new; removes `selectedTheme`, `updateTheme`, `adminColorPresets`, `currentTheme` (all admin-theme-specific) from this component

- [ ] **Step 1: Remove the AdminThemeContext import and its usages**

In `src/components/Sidebar.jsx`, find and remove this import (currently around line 5):

```jsx
import { AdminThemeContext, adminColorPresets } from "../contexts/AdminThemeContext";
```

Find and remove this line (currently around line 7):

```jsx
import { adminTheme, getAdminTheme } from "./admin/adminTheme";
```

(Note: Task 4 of the earlier lint-cleanup work already changed this import to `import { getAdminTheme } from "./admin/adminTheme";` — remove that remaining import too.)

Find and remove these two lines (currently around lines 67 and 76-77):

```jsx
  const { selectedTheme, updateTheme } = useContext(AdminThemeContext);
```

```jsx
  const currentTheme = getAdminTheme(adminColorPresets[selectedTheme]);
```

- [ ] **Step 2: Replace the popup JSX block**

Find the block starting with `{showAdminPopup && (` (around line 352) through its matching closing `)}` (around line 574) and replace it with:

```jsx
      {showAdminPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(8px)",
            padding: "1rem",
          }}
          onClick={() => setShowAdminPopup(false)}
        >
          <div
            style={{
              background: 'var(--card-bg-solid)',
              borderRadius: "16px",
              padding: "1.5rem",
              color: 'var(--text-color)',
              maxWidth: "420px",
              width: "100%",
              boxShadow: '0 8px 32px var(--card-shadow)',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent)', fontSize: '18px' }}>
              Admin Access
            </h3>

            {isAdmin ? (
              <>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  background: 'var(--card-bg)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}>
                  Signed in as <strong style={{ color: 'var(--text-color)' }}>{user?.email}</strong> with administrator privileges.
                </div>

                <button
                  onClick={() => {
                    setShowAdminPopup(false);
                    navigate("/admin/dashboard");
                  }}
                  style={{
                    width: "100%",
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    padding: "12px 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "0.6rem",
                    fontSize: '14px'
                  }}
                >
                  Go to Admin Dashboard
                </button>

                <button
                  onClick={() => setShowAdminPopup(false)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    padding: "11px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  background: 'var(--card-bg)',
                  padding: '0.9rem',
                  marginBottom: '0.9rem',
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}>
                  Your account doesn't have administrator access. Contact the site owner if you believe this is a mistake.
                </div>

                <button
                  onClick={() => setShowAdminPopup(false)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    padding: "11px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: '14px'
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Simplify the popup's CSS animation keyframes**

Immediately after the block replaced in Step 2, there is a `<style>{...}</style>` block containing `@keyframes adminPortalSlide` and `@keyframes portalFadeIn` (or similar names — check the file for the exact keyframe block following the popup). These keyframes only reference generic `transform`/`opacity` values, not theme colors, so they can stay as-is — confirm by reading the block; if it references `currentTheme` anywhere, remove those references (the popup no longer uses `currentTheme`).

- [ ] **Step 4: Verify no remaining references**

Run: `grep -n "AdminThemeContext\|adminColorPresets\|currentTheme\|getAdminTheme\|adminTheme" src/components/Sidebar.jsx`
Expected: no output (all removed)

- [ ] **Step 5: Verify no import errors**

Run: `npx eslint src/components/Sidebar.jsx`
Expected: no errors related to unused imports or undefined variables

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "style: unify Sidebar admin-access popup with public dashboard design"
```

---

### Task 6: Restyle `AdminDashboard.jsx` page shell

Removes ASCII art, "CONTROL.CENTER" branding, CRT scanline, and the simulated uptime/load-average/log-stream telemetry panel (this was decorative flavor text with no real data — fake numbers via `setInterval`/`Math.random()` — not real functionality, so removing it is part of dropping the terminal aesthetic, not a functional regression).

**Files:**
- Modify: `src/pages/AdminDashboard.jsx` (full replacement)

**Interfaces:**
- Consumes: `AuthContext` (`user`), `useNavigate` — unchanged
- Produces: same default export, same `CebDataManagement`/`UserManagement` tab switching behavior

- [ ] **Step 1: Replace the file content**

```jsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import CebDataManagement from "../components/admin/CebDataManagement";
import UserManagement from "../components/admin/UserManagement";

function AdminDashboard() {
  const [tab, setTab] = useState(() => {
    return localStorage.getItem("admin_active_tab") || "users";
  });
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const handleTabChange = (id) => {
    setTab(id);
    localStorage.setItem("admin_active_tab", id);
  };

  const renderContent = () => {
    switch (tab) {
      case "ceb":
        return <CebDataManagement />;
      case "users":
        return <UserManagement />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: "users", label: "User Management" },
    { id: "ceb", label: "CEB Billing Data" },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto", color: "var(--text-color)" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "2rem"
      }}>
        <div>
          <h1 style={{ margin: "0 0 0.4rem 0", color: "var(--accent)", fontSize: "28px" }}>
            🛠️ Admin Dashboard
          </h1>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px" }}>
            Manage users and billing data
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "transparent",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600"
            }}
          >
            ← Exit Admin
          </button>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {user?.email}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              border: tab === item.id ? "1px solid var(--accent)" : "1px solid var(--border-color)",
              background: tab === item.id ? "var(--accent)" : "var(--card-bg)",
              color: tab === item.id ? "#fff" : "var(--text-color)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s ease"
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "1.5rem",
        minHeight: "400px",
        boxShadow: "0 8px 32px var(--card-shadow)"
      }}>
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default AdminDashboard;
```

- [ ] **Step 2: Verify no import errors**

Run: `npx eslint src/pages/AdminDashboard.jsx`
Expected: no errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "style: unify AdminDashboard.jsx page shell with public dashboard design"
```

---

### Task 7: Remove `AdminThemeContext` and `adminTheme.js`

Only safe once Tasks 1–6 have removed every consumer. This task double-checks that, then deletes the files.

**Files:**
- Modify: `src/App.jsx:7` (remove import), `src/App.jsx` around line 415 and 429 (remove `<AdminThemeProvider>` wrapper)
- Delete: `src/contexts/AdminThemeContext.jsx`
- Delete: `src/components/admin/adminTheme.js`

- [ ] **Step 1: Confirm no remaining consumers**

Run: `grep -rln "AdminThemeContext\|adminColorPresets\|from.*adminTheme\|getAdminTheme\|getAdminShellStyles" src --include="*.jsx" --include="*.js"`
Expected: only `src/contexts/AdminThemeContext.jsx` and `src/components/admin/adminTheme.js` themselves, plus the two lines in `src/App.jsx` handled in Step 2. If any other file appears, stop — go back and finish restyling it before proceeding.

- [ ] **Step 2: Remove the import and provider wrapper from App.jsx**

In `src/App.jsx`, remove this import line:

```jsx
import { AdminThemeProvider } from "./contexts/AdminThemeContext";
```

Find:

```jsx
        <AdminThemeProvider>
```

and its matching:

```jsx
        </AdminThemeProvider>
```

Remove both tags, keeping their children in place (i.e. un-indent/keep the JSX that was between them, just delete the two wrapping lines).

- [ ] **Step 3: Delete the two files**

```bash
git rm src/contexts/AdminThemeContext.jsx src/components/admin/adminTheme.js
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: succeeds with no missing-module errors

- [ ] **Step 5: Lint check**

Run: `npx eslint src/App.jsx`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "chore: remove AdminThemeContext and adminTheme.js (fully replaced by public CSS variables)"
```

---

### Task 8: Color-consistency polish — pagination buttons

Three files already use the public card/table style but have a leftover hardcoded blue (`#1976d2`) on pagination buttons instead of the app's actual accent color. Small fix, same pattern in all three.

**Files:**
- Modify: `src/components/admin/UserAccessManagement/UserTable.jsx:108,129`
- Modify: `src/components/admin/AdminManagement/AdminUsersList.jsx:79,99`
- Modify: `src/components/admin/AdminManagement/RegularUsersList.jsx:79,99`

- [ ] **Step 1: Fix `UserAccessManagement/UserTable.jsx`**

Find (appears twice, once per button — for the "Prev" button):

```jsx
              backgroundColor: currentPage === 1 ? '#f0f0f0' : '#1976d2',
```

Replace with:

```jsx
              backgroundColor: currentPage === 1 ? 'var(--hover-bg)' : 'var(--accent)',
```

And for the "Next" button:

```jsx
              backgroundColor: currentPage >= totalPages ? '#f0f0f0' : '#1976d2',
```

Replace with:

```jsx
              backgroundColor: currentPage >= totalPages ? 'var(--hover-bg)' : 'var(--accent)',
```

- [ ] **Step 2: Apply the same two replacements to `AdminManagement/AdminUsersList.jsx`**

(identical find/replace pairs as Step 1, same file has both occurrences)

- [ ] **Step 3: Apply the same two replacements to `AdminManagement/RegularUsersList.jsx`**

(identical find/replace pairs as Step 1, same file has both occurrences)

- [ ] **Step 4: Verify all three are updated**

Run: `grep -rn "#1976d2" src/components/admin/`
Expected: no output

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/UserAccessManagement/UserTable.jsx src/components/admin/AdminManagement/AdminUsersList.jsx src/components/admin/AdminManagement/RegularUsersList.jsx
git commit -m "style: replace hardcoded pagination button color with var(--accent) for consistency"
```

---

### Task 9: Full verification and rollout

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint pass**

Run: `npm run build && npx eslint .`
Expected: build succeeds; only pre-existing unrelated warnings remain (e.g. `react-hooks/exhaustive-deps` warnings noted in earlier sessions as deferred) — no new errors

- [ ] **Step 2: Grep for any remaining terminal-theme artifacts**

Run: `grep -rn "CONTROL.CENTER\|SUBSYSTEM_FATAL\|fontFamily.*mono\|textTransform.*uppercase" src/pages/AdminDashboard.jsx src/components/admin/ src/components/Sidebar.jsx`
Expected: no output (or only incidental unrelated matches — inspect any hits manually)

- [ ] **Step 3: Ask user before visual verification**

Ask the user: "Ready for a visual check via the disposable test-admin-account + headless-browser approach used earlier, or would you rather check in your own browser first?" Proceed based on their answer — if they approve the automated approach, follow the same token-mint / screenshot / cleanup / token-delete pattern used in the earlier ErrorBanner investigation (fresh consent per token mint).

- [ ] **Step 4: User's own browser check**

Ask the user to load `/admin/dashboard` (and the User Management / CEB Billing Data tabs, and the Sidebar admin-access popup) in their own browser and confirm it now visually matches the rest of the app.

- [ ] **Step 5: Push all commits**

```bash
git push origin main
```

- [ ] **Step 6: Deploy**

```bash
npx vercel --prod --yes
```

Then verify: `curl -s -o /dev/null -w "%{http_code}\n" https://solaredge.anujajay.com/` — expect `200`.
