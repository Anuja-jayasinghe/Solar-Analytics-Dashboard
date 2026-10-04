# Release v3.0.0: the new dashboard becomes the default

Released 2026-10-04. `v2.1.0` stays tagged as the last build of the previous dashboard.

## What changes for users

| Address | Before | Now |
|---|---|---|
| `/` | Landing page of the previous dashboard | **The new Overview** (demo data for visitors, real data for invited viewers and admins) |
| `/pro`, `/settings`, `/admin`, `/signin` | not present | New Pro metrics, Settings, Admin and sign-in pages |
| `/v1/…` | not present | **The previous dashboard, tagged "V1 · DEPRECATED"** on every page, still working |
| `/dashboard`, `/demodashbaard`, `/demosettings`, `/login`, `/signup`, `/access`, `/admin/dashboard/…` | previous dashboard | Redirect to their new home (`/`, `/settings`, `/signin`, `/admin`) |
| `/v3/…` (preview prefix) | new dashboard preview | Redirects to the same page without the prefix |
| any other address | previous dashboard's 404 | New 404 page |

Nothing was removed. The previous dashboard and its admin screens keep working under `/v1` until the
final step below.

## What is new (see `docs/design/v3/README.md` and `docs/V3_REFACTOR_PLAN.md`)

- Overview: headline totals, Today circle with target progress, live gauge, CEB vs Inverter with a
  draggable "Mark above" line and the **money gap** (LR-004), generation over time, one day hour by hour,
  statistics. Compact phone layout with tabs.
- Pro metrics: uptime (LR-002), alarms, string balance, temperature, grid frequency, per-bill rates, year over year.
- Admin: bills (upload, review, approve, edit, delete), people and roles, data health.
- Dark and light themes built from colour variables (more themes need no screen changes).
- Real data is private to invited users through the authenticated read API; visitors get demo data dated 2035+.
- Collector, uptime log, LR-001..004 logic, branch rules, release process.

## Production-readiness analysis

Checked 2026-10-04 on the release candidate. "Evidence" says how it was verified.

| Area | Result | Evidence |
|---|---|---|
| Unknown address | A real 404 page that names the address and offers the way back | `tests/v3Cutover.test.js`; browser check |
| Old links and bookmarks | Redirect to the new page; `/v3` prefix dropped; query string kept | `legacyRedirect` tests; browser check of `/dashboard` |
| Deprecated v1 | Served under `/v1`, banner on every page, link to the new dashboard | test + browser check |
| Debug logging | **None in the new app** (enforced by a test). 39 `console.log/debug/info` calls in v1 are **stripped from production bundles** (`esbuild.pure`); `console.warn` and `console.error` are kept on purpose | test; grep of `dist/`: the only remaining call is inside pdf.js's own verbosity-gated logger |
| Crashing page | An error boundary shows a plain message and a Reload button instead of a blank screen; the error goes to `console.error` | tests |
| API failures | Pages show a note and dashes, never zeros; unknown is `null` end to end | tests; rule in `docs/WORKING_RULES.md` |
| Authorization | Enforced on the server. Unauthenticated `/api/data/*` returns 401; admin pages are admin-only and every admin call is re-checked by its endpoint | `curl` of production; QA as admin on production |
| Secrets in the browser | No secret-looking `VITE_` variable | test on `.env.example`; `docs/SECURITY.md` |
| Real-world flows on production | Overview, Pro, Admin (bills, people, data health), Settings save and restore, upload of a duplicate bill (correctly refused), upload of a non-bill (stored, reading failed, discarded) | session log in `docs/V3_REFACTOR_PLAN.md` |
| Approving a brand-new bill | Covered by tests only: both real bills offered for testing were already ingested, and approving a duplicate would create extra ingestion rows | to be exercised with the next real bill |
| Performance | The first page of the new app now loads **React (81 KB gz) + its own code (about 45 KB gz)**. Before this release the entry also preloaded the Supabase, "vendor" and v1-admin chunks (about 76 KB gz) and a charts chunk (101 KB gz) for every page. Recharts (90 KB gz) now loads only in v1. No perpetual animation beyond the Today circle and status bulb, both disabled by `prefers-reduced-motion` | `dist/` sizes before and after |
| Accessibility | Skip link, one `h1` per page, labelled controls and regions, keyboard-operable "Mark above" slider, per-point hints that work by tap and keyboard on every chart, and a **table view for the CEB chart only** (a table view for the other charts is a gap), `prefers-reduced-motion` honoured, status never by colour alone. **Lighthouse on production `/` (mobile profile, slow 4G): Accessibility 100** | code review + tests |
| SEO and crawlers | `robots.txt` and `sitemap.xml` updated for the new paths; the page `<title>` follows the page | files |
| **Lighthouse (production `/`, mobile profile, 2026-10-04)** | First run found Performance 57, Accessibility 97, CLS 0.45 and one ARIA failure; fixed (visitors skip the wait for Clerk's script using its signed-out cookie, card heights reserved, `role=img`, Overview bundled, demo prefetched). Final two runs: **Performance 79 and 93, Accessibility 100, Best practices 100, SEO 100, CLS 0.04 to 0.05, TBT 80 to 170 ms, FCP 1.6 to 1.8 s** (performance varies run to run in the lab) | `npx lighthouse` against production |
| Browser tab | Each page sets its own title | test |
| Rollback | `docs/RUNBOOK.md` "Rolling back v3.0.0": promote the previous deployment (instant) or revert the release merge | runbook |
| **Open risk: real data is still publicly readable** | **Bill tables and the bill PDF bucket are now closed to the public key (migration applied 2026-10-04, snapshot first; verified as anon).** Until the previous dashboard is removed, anyone holding the public anon key can still read `ceb_data`, the daily summaries and settings, because v1 reads them directly in the browser | read-only `pg_policies` query and anon REST/storage calls |

### What is left to make the data private

Making v3 the default does not by itself close the rest of the exposure. Two steps were written; the first is applied:

1. **Done 2026-10-04:** `scripts/sql/2026-09-24_revoke_anon_bill_access.sql` (closed the two bill tables and the bucket, which
   also allowed anonymous uploads and deletes; the code that replaced those browser reads had been deployed for weeks).
2. **At v1 removal:** `scripts/sql/2026-10-04_v3_revoke_anon_read_at_v1_removal.sql` (+ rollback). It breaks
   `/v1`, so it goes together with deleting `/v1`.

## Known gaps (tracked)

- Sending invitations from Admin and the collector's run history (new endpoints needed): V3-D8.
- Weather chip on Pro metrics: no data source chosen (#178).
- Alerts when the inverter stops (#151).
- Largest Contentful Paint is 3.1 to 4.6 s on the slow-4G lab profile (it is a chain of round trips: page, app code, then the first data); worth another pass if real-user numbers disagree.

## How to remove v1 (when you are ready)

Delete `src/App.jsx` and the code only it uses (`src/components`, `src/contexts`, the v1 files in `src/pages`, `src/lib`), the
`/v1` branch in `src/main.jsx` and `LegacyBanner`, drop the dependencies nothing else imports (the Supabase client, Recharts, react-pdf),
deploy, then apply step 2 above. Tracked as the final item in `docs/V3_REFACTOR_PLAN.md`.
