# Admin Improvement Notes

Date: November 16, 2025  
Status: Draft for post-dashboard iteration

---

## Objectives
- Strengthen authentication, authorization, and session handling for the admin area.
- Improve reliability, observability, and safety of admin operations (data edits, settings, backfills).
- Provide a clean UX for admin tasks with clear guardrails and auditability.

---

## Current Context
- Frontend: React app with contexts in `src/contexts/` (e.g., `AuthContext.jsx`).
- Data: Supabase (RPC, tables), serverless functions (Solis integration).
- Admin UI: `src/components/admin/` and `src/pages/AdminDashboard.jsx`.

---

## Authentication & Session
- Login Flow
  - Use a single, centralized `AuthContext` handling login, logout, and session hydration.
  - Persist minimal session token in memory; store refresh token securely (httpOnly cookie if possible via backend route; otherwise encrypted localStorage fallback).
- Token Refresh
  - Implement silent refresh before expiry (e.g., T-2 minutes) to avoid mid-operation logouts.
  - On refresh failure, force logout and redirect to Admin Login.
- MFA (Optional Phase 2)
  - Support TOTP-based MFA for admin roles.
  - Backup codes UI for recovery.
- Security
  - Brute-force protection on login (rate limit per IP and username; exponential backoff).
  - Lockout policy after N failed attempts with admin override to unlock.

---

## Authorization & Roles
- Roles & Claims
  - Define roles: `viewer`, `editor`, `admin` (extendable to `owner`).
  - Map routes/actions → role requirements in a central policy module.
- Route Guards
  - Protect admin routes at router-level (redirect unauth/unauthorized to login/403 page).
  - Avoid UI flicker by resolving auth before rendering protected pages (or render a protected layout skeleton during check).
- UI Gating
  - Hide admin nav and controls for non-admins; disable actions without permission.

---

## Admin UX & Safeguards
- Confirmation & Undo
  - Confirmation dialogs for destructive actions (delete, reset, overwrite).
  - Soft-delete with a recovery window where feasible.
- Draft/Preview
  - For settings changes: stage in a draft view with diff preview before apply.
- Bulk Operations
  - Chunked processing with progress indicators and resumable steps for backfills.
- Accessibility
  - Keyboard navigable forms, ARIA roles, and clear focus states.

---

## Audit Logging
- What to Log
  - Actor (user id/email), action, entity, before/after diff summary, timestamp, outcome (success/failure), correlation ID.
- Storage
  - Table `admin_audit_log` with partitioning by month (for scale) and indexes on date/user.
- Surfacing
  - Admin-facing audit viewer with filters (date range, user, action, entity).

---

## Rate Limiting & Abuse Prevention
- Per-IP and per-user limits for sensitive admin functions (e.g., settings update, backfills).
- Circuit breaker: temporarily suspend endpoints on repeated 5xx spikes.
- CAPTCHA or secondary verification for repeated failed login attempts.

---

## Data Integrity & Recovery
- Soft-delete over hard-delete for key tables; nightly purge task for aged soft-deletes.
- Snapshots
  - Pre-change snapshots for critical settings and content (versioned config).
  - Rollback button for last known good configuration.
- Validation
  - Strict input validation (schema-based) with helpful errors.

---

## Observability
- Structured Logs
  - JSON logs including `requestId`, `userId`, duration, status, and error details.
- Metrics
  - Success rate, latency p95, error rates per admin endpoint.
- Alerts
  - Trigger alerts on login failures spike, repeated rate limit hits, and long-running tasks.

---

## Secrets & Configuration
- Do not store provider credentials directly in frontend storage.
- Use serverless functions/edge routes to proxy sensitive calls with server-held secrets.
- Rotation Policy: document rotation steps; schedule periodic rotation reminders.

---

## Testing & Hardening
- Unit Tests: auth flows, role checks, reducers/hooks in `AuthContext`.
- Integration Tests: protected routes, token refresh, admin operations happy-path and failure-path.
- Security Tests: basic vulnerability checks (XSS/CSRF avoidance in forms; input sanitization).

---

## Phased Roadmap
- Phase A (Post-Dashboard)
  - Centralize `AuthContext` session + refresh logic
  - Route guards + UI gating
  - Basic audit log (create/update/delete settings)
- Phase B
  - Brute-force protection + rate limiting on admin endpoints
  - Soft-delete mechanics + restore
  - Admin audit viewer page
- Phase C
  - MFA for admins
  - Snapshot/rollback for critical settings
  - Observability dashboards & alerts

---

## Acceptance Criteria (Phase A)
- Admin routes are fully protected; no flicker; unauthorized users cannot access endpoints.
- Session persists across reload; silent token refresh prevents surprise logouts.
- Every settings change emits an audit log with actor and diff summary.
- Basic rate limiting in place for login endpoint.

---

## References
- `src/contexts/AuthContext.jsx`
- `src/pages/AdminLogin.jsx`, `src/pages/AdminDashboard.jsx`
- Supabase policies/Row Level Security (if used)
- Serverless functions handling sensitive operations
