# Project Audit — September 2026

**Date:** 2026-09-12 · **Commit:** `main` after PR #118 · **Scope:** security, API, data, UI/UX, CI, docs, dependencies

Full-project audit taken after the data pipeline was recovered, to establish a stability
baseline before any feature work. Companion docs:
[`RECOVERY_STATUS_2026-09.md`](./RECOVERY_STATUS_2026-09.md) ·
[`DATA_PIPELINE_SAFEGUARDS.md`](./DATA_PIPELINE_SAFEGUARDS.md)

---

## Verdict

The data pipeline is healthy again and the build is clean. What the audit found instead is a
**security posture that assumes the Supabase anon key is a secret.** It is not — it ships in
every browser bundle. Several tables grant write access to `anon` with no predicate, and four
API endpoints have no authentication at all.

Nothing here is theoretical. Each finding below was verified against the live project.

**Fix order: S1 → S3 → S2 → S6/S7 → S4/S5 → everything else.**

---

## 🔴 Security

### S1 — CRITICAL · Anyone can rewrite your billing data and tariff

```
ceb_data         INSERT  {anon,authenticated}  with_check: true
ceb_data         UPDATE  {anon,authenticated}  qual: true / with_check: true
system_settings  INSERT  {anon,authenticated}  with_check: true
system_settings  UPDATE  {anon,authenticated}  qual: true / with_check: true
```

`qual: true` means *no restriction whatsoever*. The `anon` key is public by design — it is in
`VITE_SUPABASE_ANON_KEY`, compiled into the JS bundle any visitor can read.

**Impact.** Anyone who opens the site can change `rate_per_kwh` in `system_settings`, and
every earnings figure on the dashboard is derived from it (`DataContext.jsx:202`,
`potentialValue = totalGen_kWh * tariff`). They can also insert or overwrite rows in
`ceb_data`, which is the canonical billing table the whole analytics layer reads.

**Fix — and this is the important part: you cannot simply revoke these policies.** They exist
because the app depends on them. See S1a.

### S1a — The root cause: admin writes happen in the browser with no identity

`src/lib/supabaseClient.js` creates the client with the bare anon key. **No Clerk JWT is ever
attached.** So at the database level, an admin and an anonymous visitor are the same caller —
and the policies were opened to `true` to make the admin UI function.

These are all client-side writes, executed with the public anon key:

| File | Writes to |
|---|---|
| `pages/Settings.jsx:73,115` | `system_settings` |
| `admin/CebDataManagement/index.jsx:364,373` | `ceb_data` |
| `admin/CebDataManagement/VerificationQueue.jsx:150,158,172` | `ceb_data`, `ceb_bill_extractions`, `ceb_bill_ingestions` |

The admin check is **purely client-side UI gating**. Nothing stops a visitor from calling the
same endpoints directly with the key from the bundle.

Revoking anon write without first giving these an authenticated path would break bill approval
and the settings page. Two ways forward:

**Option A — move the writes server-side.** Add authenticated API endpoints using the
service-role key (which bypasses RLS), then revoke anon write entirely. Most secure, and
consistent with how the upload/extract/delete endpoints already work. Cost: Vercel Hobby
allows 12 serverless functions and 11 are used — needs consolidation, e.g. one
`/api/ceb-bills/approve` plus one `/api/settings`, and renaming `api/middleware/` to
`api/_middleware/` to free a slot.

**Option B — give the browser client a real identity.** Wire Clerk's Supabase JWT integration
so the client sends a Clerk-signed token, then write RLS policies that check a claim
(`auth.jwt() -> 'publicMetadata' ->> 'role' = 'admin'`). Keeps writes client-side. Groundwork
partly exists — `VITE_CLERK_JWT_TEMPLATE_NAME` is already configured and used for the API
calls — but `supabaseClient.js` does not use it.

Option A is the stronger fix; Option B is less code churn. **This is a decision to make before
the S1/S2 policies can be closed.**

### S2 — HIGH · `admin_users` is world-readable, world-writable, world-deletable

```
admin_users  SELECT  {public}  qual: true
admin_users  INSERT  {public}  with_check: true
admin_users  DELETE  {public}  qual: true
```

**Impact.** Leaks the admin list (email addresses — PII) to anyone with the anon key, and lets
anyone insert or delete rows.

**Severity is contained, for now.** Live authorization does *not* read this table — every
server endpoint authorizes via Clerk `publicMetadata.role` (`verifyAdminToken.js:60`). The
only reader is `src/lib/auth/SupabaseAuthAdapter.js`, the legacy pre-Clerk path, dead while
`VITE_USE_CLERK_AUTH` is on. So this is **data exposure today, privilege escalation the moment
that flag flips**. Treat it as a live landmine.

### S3 — HIGH · `api/solis/explore.js` is an unauthenticated proxy to SolisCloud

The endpoint computes an auth flag and then never uses it:

```js
// api/solis/explore.js:52-60
const clerküserId  = req.headers['x-clerk-user-id'] || ...
const userId       = clerküserId || req.headers['x-user-id'];
const isAuthenticated = Boolean(clerküserId) || req.headers['x-authenticated'] === 'true';
return { userId, isAuthenticated };
```

`isAuthenticated` appears exactly twice in the file: where it is assigned, and where it is
returned. **It is never checked.** Every input is an attacker-controlled request header.

**Rate limiting does not save it.** The key is `userId || ip` — and `userId` comes from that
same spoofable header, so rotating `x-user-id` per request yields a fresh 30/min bucket every
time. The limiter is also in-memory on a serverless function, so it is per-instance regardless.

**Impact.** Any host on the internet can make your server issue authenticated SolisCloud calls
on your `SOLIS_API_ID` / `SOLIS_API_SECRET`, burning your quota and reading your inverter data.
The endpoint allowlist (`solisExplorerValidator.js`) restricts this to read-only endpoints,
which caps the damage but does not close it.

**Also:** `clerküserId` contains a non-ASCII `ü`. Valid JS, certainly unintended.

### S4 — MEDIUM · Three more endpoints with no authentication and no method check

| Endpoint | What it does unauthenticated |
|---|---|
| `api/fetch-inverter-data.js` | Solis calls + service-role DB writes |
| `api/generate-monthly-summaries.js` | Full-table scan per inverter + writes |
| `api/update-total-generation.js` | Solis call + `system_metrics` upsert |

None verify a caller. All run with the service-role key. Anyone can invoke them repeatedly —
a cheap way to burn Solis quota and Vercel execution time.

### S5 — MEDIUM · `Access-Control-Allow-Origin: *` with `Allow-Credentials: true`

Four endpoints set both. The combination is invalid per the CORS spec, so browsers reject it
for credentialed requests — meaning it is incoherent rather than directly exploitable. But on
the S3/S4 endpoints, which need no credentials, `*` means any origin can call and read them.

### S6 — CRITICAL (dependency) · Clerk advisories, on a deprecated SDK

- `@clerk/shared` — **authorization bypass** advisory (critical)
- `@clerk/clerk-react` — authorization bypass when combining organization checks (high); `5.56.0` → `5.61.3`
- `@clerk/clerk-sdk-node@5.1.6` — **deprecated by the vendor**

That deprecated package is what every server endpoint uses to authorize admins. This is the
single most load-bearing dependency in the project and it is both outdated and EOL.

### S7 — HIGH (dependency) · `react-router` XSS and DoS advisories

`react-router-dom` `7.9.4` → `7.18.3`. Advisories include XSS via open redirects, XSS in
`ScrollRestoration`, and multiple unauthenticated DoS vectors.

**Overall:** `pnpm audit` reports **61 vulnerabilities — 2 critical, 35 high, 23 moderate.**
Many are dev-chain (vite, rollup, postcss, browserslist) and lower priority; the Clerk and
react-router ones are runtime and are not.

### S8 — Rotate the service-role key

It was pasted into a chat transcript on 2026-09-12. Functionally fine, but it should be
rotated as hygiene.

---

## 🟠 Correctness & code quality

| | Finding | Where |
|---|---|---|
| Q1 | **Conditional Clerk hook calls** — `useUser`/`useAuth`/`useClerk` called conditionally. A genuine rules-of-hooks violation that can crash on auth-state transitions. Open as issue #114 | `src/contexts/AuthContext.jsx:16-18` |
| Q2 | **`AuthContext.adapter.jsx` is dead code** — nothing imports it; a near-duplicate of the live file carrying the same Q1 bug | `src/contexts/` |
| Q3 | **Unused dependencies**: `lodash` (0 refs, and carries a code-injection advisory), `@google/generative-ai` (0 refs, left from the abandoned AI extraction), `tslib` (0 refs) | `package.json` |
| Q4 | **Broken scripts** — `extract_solis_pdf.{mjs,cjs}` are written against pdf-parse v1's callable API; the installed version is 2.4.5's class-based `PDFParse`. They throw on run | `scripts/` |
| Q5 | **Lint rules downgraded to hide failures** — `react-hooks/rules-of-hooks` set to `warn` so CI would pass. That rule catches real crashes; it should not be a warning | `eslint.config.js:51` |
| Q6 | **`SolisExplorer.jsx` is 1,974 lines** — by far the largest file, and it fronts the S3 endpoint | `src/components/` |
| Q7 | **Live settings sync is silently dead.** `DataContext.jsx:576-600` subscribes to `postgres_changes` on `system_settings` to reactively update tariff and grid capacity — but `supabaseClient.js:42` replaces the realtime transport with a no-op class and sets `eventsPerSecond: 0`. The subscription can never fire. The README advertises this as a feature ("Unified Settings Sync — reactively synced"); in practice a settings change needs a page refresh. Either wire realtime up or delete the subscription and the claim | `src/contexts/DataContext.jsx`, `src/lib/supabaseClient.js` |
| Q8 | **Supabase config is logged to the browser console on every load** — URL prefix, key prefix and environment. Harmless (the anon key is public) but noisy and signals more than it should | `src/lib/supabaseClient.js:8` |

---

## 🟡 CI & testing

**Two of the four CI gates are theatre.** `ci.yml` runs lint, typecheck, test and build with
`--if-present`, but `package.json` defines only `lint` and `build`:

```
lint       REAL   -> eslint .
typecheck  MISSING -> step silently passes
test       MISSING -> step silently passes
build      REAL   -> vite build
```

- **C1 — Zero tests exist.** Nothing in the repo is verified by anything. This is why a CEB
  bill format change became a five-month outage, and why the extractor was tuned by hand
  against live uploads.
- **C2 — No dependency audit in CI.** 61 vulnerabilities, including 2 critical, accumulated
  unnoticed.
- **C3 — Lint passes with 20 warnings**, including the Q1 rules-of-hooks violations.

---

## 🔵 UI / UX / accessibility

Measured across ~17,500 lines of JSX:

| Signal | Count | Read |
|---|---|---|
| `aria-*` attributes | 10 uses, 3 distinct | Very thin for an app this size |
| `role=` | 3 uses | Effectively no landmark structure |
| `:focus` CSS rules | 6 | Keyboard navigation is largely unstyled |
| `prefers-reduced-motion` | 2 rules | Under-covered given framer-motion is used throughout |
| Clickable non-button elements | 2 | Minor — not keyboard reachable |
| Inline `style={{…}}` objects | **596** | Main maintainability drag |

**U1 — Accessibility is thin but not broken.** Images have alt text and there are no obvious
traps; what is missing is deliberate keyboard and screen-reader support. Worth a focused pass,
not a rewrite.

**U2 — 596 inline style objects** is the structural issue. It fights the CSS-variable theming
system the project already has, makes the dark/light story harder to keep consistent, and
creates new object identities on every render.

---

## 🟣 Data & schema

- **D1 — No checked-in migrations for the tables that matter.** `scripts/sql/` covers
  `ceb_bill_ingestions` and `ceb_bill_extractions`, but **not** `ceb_data`,
  `inverter_data_daily_summary`, `inverter_data_live`, `system_settings` or `admin_users`.
  Their schema exists only inside Supabase. The DB Snapshot workflow now captures it, which
  helps, but it belongs in version control.
- **D2 — `api_logs` and `report_logs` have RLS on with zero policies** — reachable only via
  service-role. Probably intentional; currently undocumented, and flagged by Supabase advisors.
- **D3 — 424 historical rows carry a fabricated `peak_power_kw = 0`** (2024-08-02 → 2025-10-12)
  where generation is above zero. Same defect the backfill fix addressed going forward; these
  predate it and would need a correction pass.

---

## ⚪ Documentation

- **Doc1 — 65 markdown files, and the two entry points are wrong.** `START_HERE.md` and
  `DOCUMENTATION_INDEX.md` are entirely about local Clerk dev tooling, not the project. Anyone
  returning to this repo is pointed at the least relevant thing first.
- **Doc2 — The CEB automation plan describes Google Document AI**, which was never built. The
  real implementation is regex over pdf-parse. Actively misleading.
- **Doc3 — `vercel.env.example` is missing every Clerk variable** and
  `SUPABASE_STORAGE_BUCKET_BILLS`. It still describes the pre-Clerk world.
- **Doc4 — No `CLAUDE.md`.**

---

## Recommended sequence

**Phase 1 — Close the exposure (do first)**
1. S1 — revoke anon write on `ceb_data` and `system_settings`
2. S3 — authenticate `api/solis/explore.js`
3. S2 — lock down `admin_users`
4. S4/S5 — authenticate the remaining three endpoints; fix CORS

**Phase 2 — Dependencies**
5. S6 — migrate off deprecated `@clerk/clerk-sdk-node`, upgrade `@clerk/clerk-react`
6. S7 — upgrade `react-router-dom`
7. Q3 — drop `lodash`, `@google/generative-ai`, `tslib`

**Phase 3 — Make the gates real**
8. C1 — add a test runner and first tests, starting with the CEB extractor (a fixture would
   have caught the outage)
9. C2 — add `pnpm audit` to CI
10. Q5 — restore `rules-of-hooks` to `error`, then Q1/Q2

**Phase 4 — Housekeeping**
11. D1 — dump the missing schemas to `scripts/sql/`
12. Doc1–Doc4 — prune the docs index, correct the plan, refresh the env example, add `CLAUDE.md`
13. U1/U2 — accessibility pass; begin retiring inline styles

**Phase 5 — Then the CEB bill parser**, the thing this all started with.
