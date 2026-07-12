# Local Login Debugging Log — 2026-07-12

Session log of diagnosing and fixing "login page won't load locally" (`npm run dev` / `npx vercel dev`).

## Investigation

1. Read [package.json](../../package.json) — auth stack is `@clerk/clerk-react` (primary) with a Supabase fallback (`AuthFactory.js` picks based on `VITE_USE_CLERK_AUTH`).
2. Read `.env.local` — `VITE_USE_CLERK_AUTH="true"` and `VITE_CLERK_PUBLISHABLE_KEY="pk_live_..."` (a **production** Clerk key, pulled in via Vercel CLI).
3. Read [src/App.jsx](../../src/App.jsx) — `ClerkProvider` wraps the entire app tree (`App.jsx:437`) when `VITE_USE_CLERK_AUTH` is true, using `CLERK_PUBLISHABLE_KEY` straight from env.
4. Grepped project docs for Clerk key guidance — every onboarding doc (`docs/migration/PHASE_0_CLERK_SETUP.md`, `docs/migration/QUICK_START.md`, `docs/LOCAL_CLERK_DEVELOPMENT.md`, etc.) says local dev must use a `pk_test_...` key, never `pk_live_...`.
5. Confirmed [docs/LOCAL_CLERK_DEVELOPMENT.md](../LOCAL_CLERK_DEVELOPMENT.md) states outright: *"`npm run dev` with Vite doesn't properly support Clerk authentication for local testing"* — a known, documented issue in this repo.
6. Checked `src/lib/localAuth.js` (the doc's proposed dev-bypass mock) — file exists but is **not wired into** `AuthContext.jsx` (dead code, not currently used).
7. Ran `npm run dev` — server started fine on `http://localhost:5174` (port 5173 was already in use by a prior instance), so the failure is client-side/runtime (Clerk rejecting the live key on a non-production origin), not a server startup failure.

## Root cause

`pk_live_...` Clerk publishable keys are locked to the exact production domain they were issued for (`clerk.solaredge.anujajay.com`). Clerk refuses to initialize on `localhost`, and since `ClerkProvider` sits at the very top of the component tree, the whole app — including the login page — fails to render locally.

## Decision

User chose: **Option 1 — ngrok tunnel** (per `docs/LOCAL_CLERK_DEVELOPMENT.md`), to test real Clerk auth locally using a tunnel that gets added to Clerk's allowed origins, rather than switching to a `pk_test_` key or the dead-code mock bypass.

## ngrok setup — completed 2026-07-12

- Checked for existing package managers: no `choco`/`scoop`; `winget` available.
- Installed ngrok via `winget install ngrok.ngrok --accept-package-agreements --accept-source-agreements`.
- User provided an ngrok auth token; ran `ngrok config add-authtoken <token>`.
- First tunnel attempt failed: `ERR_NGROK_121` — the winget package installed ngrok 3.3.1, but the account requires agent >= 3.20.0. Fixed with `ngrok update` → 3.39.9.
- Added `"dev:ngrok": "ngrok http 5173"` to `package.json`.
- Found a leftover `node` process (PID from an earlier ad-hoc `npm run dev` test in this session) squatting on port 5173, causing Vite to drift to 5174. Killed it so `npm run dev` reliably binds 5173.
- Second tunnel attempt returned `403` / `"Blocked request... not allowed"` — Vite 7's `server.allowedHosts` check rejects the ngrok Host header by default. Fixed by adding `allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app']` to `vite.config.js`'s `server` block (scoped allowlist, not a blanket `true`, to keep the check meaningful).
- Confirmed the tunnel serves the app end-to-end: `curl https://gap-trapdoor-skewer.ngrok-free.dev/` → `200`.

**Still needed from the user:** add `https://gap-trapdoor-skewer.ngrok-free.dev` to the Clerk Dashboard's Allowed Origins / Redirect URLs (dashboard.clerk.com → app → Domains/Paths), then open that URL and confirm the login page renders and Clerk auth completes. This ngrok free-tier subdomain is stable per local ngrok config but can change if ngrok is reconfigured or the account plan changes — re-check Clerk's allowed origins if so.

## Branching (per user request — no direct work on `main`)

- `fix/lint-cleanup-and-minor-bugs` — the codebase-wide lint/bug-fix sweep (2 commits: code fixes, then this doc + changelog)
- `chore/local-dev-ngrok-setup` — this ngrok/local-dev setup (this commit)

---

# Codebase-wide minor bug scan — 2026-07-12

User asked to scan the whole codebase for minor bugs before moving on to planned improvements.

## Method

Ran `npm run lint` (eslint) as the primary sweep — 172 problems initially. Investigated each one rather than blindly auto-fixing, since some were real bugs, some were dead code, and ~130 were false positives from a lint-config gap. Then did a manual read-through of every flagged file to decide fix vs. defer. Confirmed with `npm run build` that the app still builds cleanly after all changes (4322 modules, no errors).

## Fixed

**Config fix (root cause of ~130 false positives):**
- [eslint.config.js](../../eslint.config.js) only declared `globals.browser`, so every `process.env`/`Buffer` reference in `api/`, `functions/`, `scripts/`, and `vite.config.js` (all genuine Node.js code) was flagged as `no-undef`. Added a second config block granting `globals.node` to those paths (plus `src/lib/solisAuth.js`, an isomorphic helper used both client- and server-side). Also added `argsIgnorePattern: '^_'` and `caughtErrorsIgnorePattern: '^_'` so intentionally-unused function/catch params can be marked with a leading underscore instead of triggering `no-unused-vars`.

**Real bug — invalid/conditional hook call:**
- [src/components/ErrorBanner.jsx](../../src/components/ErrorBanner.jsx) — `getErrorTitle`, a plain helper function called inside a `.map()` during render, called `useToast()` and `useEffect()` inside a `switch` case for the `'rate-limit'` error type. This is a genuine React violation (hooks called conditionally, inside a non-component function, inside a render-time loop) that would throw an "Invalid hook call" / hooks-order error whenever a rate-limit error was present. Fixed by moving the toast side-effect into the component's existing top-level `useEffect`.

**Genuine dead code removed:**
- `api/ceb-bills/ingestions.js` — removed `listAllFilesRecursive`, `listFolderEntries`, `isFolderEntry`, and the now-unused `BUCKET`/`PAGE_SIZE` constants. This route used to list files directly from Supabase Storage but was migrated to query the `ceb_bill_ingestions` table instead; the old storage-walking code was never deleted and had zero callers.
- `src/components/dashboard/MonthlyGenerationCard.jsx` — unused `useEffect`/`useState` imports and a computed-but-never-rendered `formattedValue` (the component actually renders via `<NumberTicker format={...}>` instead).
- `src/components/RefreshIndicator.jsx` — unused `isStale` destructure, two dead style objects (`infoStyle`, `staleWarningStyle`), and unused `FileWarning`/`ChevronRight`/`ChevronLeft` icon imports (these were invisible to eslint's default `no-unused-vars` because the ignore pattern `^[A-Z_]` incidentally matches capitalized import names — worth remembering for future lint sweeps).
- `src/components/Sidebar.jsx` — unused `adminTheme` import, `session` destructure, and dead `showColorPicker`/`setShowColorPicker` state.

**Minor correctness fixes:**
- `src/pages/AdminDashboard.jsx` — the CONTROL.CENTER ASCII-art banner had a bare `\_` instead of `\\_` on one line; JS silently drops unrecognized escapes, so that backslash was missing from the rendered art. Fixed to match the escaping pattern used on every other line of the banner.
- `src/lib/cacheService.js` — empty `catch {}` block swallowing JSON-parse errors silently with no explanation; added a comment so it reads as intentional rather than a bug.
- Removed a handful of other truly-unused local vars/params/imports (`src/App.jsx`, `AuthErrorModal.jsx`, `BottomNav.jsx`, `ErrorBoundary.jsx`, admin `UserManagement`/`UserAccessManagement`/`AdminManagement` catch blocks, `UserTable.jsx`, `SupabaseAuthAdapter.js`, `dataService.js`, `Settings.jsx`, `api/config/solisEndpointsConfig.js`, `api/solis/explore.js`, `functions/fetch_live_data/index.js`, `api/ceb-bills/extract.js` unnecessary regex escape).
- `src/lib/auth/AuthAdapter.js` — this is an abstract interface class where every method stub intentionally declares params it doesn't use (documenting the contract). Added a scoped `eslint-disable no-unused-vars` for the file rather than prefixing ~11 params with `_`, since the un-prefixed names are the actual documentation value here.

Lint result: **172 → 0 errors, 10 warnings** (all remaining items are `react-hooks/exhaustive-deps` warnings, not errors).

## Deliberately deferred (flagged, not fixed — architectural, not "minor")

- **`react-hooks/exhaustive-deps` warnings** (`fetchUsers`, `fetchStorageFiles`, `isDemo`, `clerk`/`clerkAuth`/`clerkUser`, `session?.user?.email`, `scheduleRetry` across several admin components and `AuthContext.jsx`/`DataContext.jsx`). These are warnings, not errors — blindly adding the missing deps risks introducing render loops if the referenced functions aren't memoized. Needs case-by-case review; better suited to the upcoming "improvements" pass than a blind lint-fix.
- **Conditional Clerk hook calls in `AuthContext.jsx` / `AuthContext.adapter.jsx`** (`isClerkEnabled() ? useUser() : {...}` etc.) — technically violates React's rules-of-hooks, but `isClerkEnabled()` reads a build-time env flag that never changes across renders, so it's stable in practice, not an active crash. A real fix means always mounting `ClerkProvider` (even in Supabase-only mode) or splitting into two provider components picked at a higher level — a bigger structural change directly touching the auth code we're mid-fix on for the ngrok/local-login issue above. Deferred to avoid destabilizing that work; worth addressing intentionally in the improvements round.
- **`react-refresh/only-export-components` warnings** (`ThemeContext.jsx`, `AdminThemeContext.jsx`, `DataContext.jsx`, `ToastManager.jsx`, `AuthContext.jsx`, `AuthContext.adapter.jsx`) — these only affect Vite Fast Refresh granularity (a saved edit to one of these files causes a full page reload instead of a hot patch), not runtime correctness. Fixing means splitting each file into a context-only file and a hooks/exports file — a mechanical but broad refactor, deferred as an "improvement" rather than a "bug."
