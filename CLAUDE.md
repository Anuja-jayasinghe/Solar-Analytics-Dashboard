# Solar Analytics Dashboard

A React 19 + Vite SPA on Vercel, backed by Supabase, that compares **what the solar inverter
generated** against **what the electricity company paid for**.

Single site, single inverter (SN `1811040244070066`, 40 kW array), Sri Lanka.

---

## The one rule that matters

**A bill received in month N reports generation from month N−1.**

Period windows come from bill dates, not calendar months:

```
periodEnd   = bill_date
periodStart = previous bill_date + 1 day      (fallback: bill_date − 30 days)
inverter    = sum of daily generation within that window
```

`null` means unavailable/pending. `0` means an actual measured zero. **Never conflate them** —
fabricated zeros have caused real data corruption here twice.

Spec: `docs/logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md`
Implementation: `buildAlignedEnergyComparisonRows` in `src/lib/dataService.js`
Tests: `tests/energyAlignment.test.js`

---

## Architecture

| Side | Source | Table | Collected by |
|---|---|---|---|
| Inverter | SolisCloud API | `inverter_data_live` (5-min), `inverter_data_daily_summary` | GitHub Actions cron |
| CEB | Bill PDFs, admin upload | `ceb_data` | Admin dashboard pipeline |

**CEB bill pipeline:**

```
upload → POST /api/ceb-bills/upload    (SHA-256 dedupe → Storage → ceb_bill_ingestions)
       → POST /api/ceb-bills/extract   (pdfjs-dist + regex → ceb_bill_extractions)
       → VerificationQueue.jsx         (admin reviews / edits)
       → PUT  /api/ceb-bills/records   (upsert ceb_data + mark approved)
```

**The extractor is not OCR and not AI.** `@google/generative-ai` was removed; the
`CEB_BILL_AUTOMATION_IMPLEMENTATION_PLAN.md` describing Google Document AI was **never
built**. What runs is `pdfjs-dist` text extraction (`api/_lib/pdfText.js`) plus nine regex
anchors pinned to the bill's text layout — see `api/_lib/cebBillParser.js`. Both the pre-2026
format and the 2026 `ebill-edl-v.1.0.2` redesign are covered by fixtures.

`pdf-parse` is deliberately NOT used: it pulls in `@napi-rs/canvas`, a native binary, purely to
render pages we never render. When a native module fails to load it fails at *module* level, so
the handler's `try/catch` never runs and Vercel returns its own HTML error page instead of our
JSON — which is what made a 500 here take several deploy cycles to diagnose.

---

## Security model — read before touching data access

- `VITE_SUPABASE_ANON_KEY` is **public**. It ships in the browser bundle.
- Therefore the browser client **reads only**. RLS grants `anon` `SELECT` and nothing else.
- **Every write goes through an admin-authenticated API endpoint** using the service-role key,
  which bypasses RLS. Never reintroduce a client-side `.insert()` / `.update()` / `.upsert()`.
- Authorization is Clerk `publicMetadata.role === 'admin'`, verified server-side in
  `api/_lib/verifyAdminToken.js`. The `admin_users` table is legacy and unused.
- `SUPABASE_SERVICE_KEY` must be the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY` is
  accepted as an alias). An anon key there fails every insert with "violates row-level
  security policy" — this caused a five-month outage, then a second one on Vercel.
  `api/_lib/supabaseServer.js` asserts the key's role claim and names the problem.
- **Never prefix a secret with `VITE_`.** Vite compiles those into the browser bundle.
  `api/_lib/solisAuth.js` is server-only and lives outside `src/` for exactly this reason: it
  reads env with a *computed* key, so Vite inlines the **entire** env object wherever it is
  bundled — one client import would publish every `VITE_` value.
- Vercel and GitHub Actions hold **separate** copies of the secrets. Fixing one does not fix
  the other.

---

## Commands

```bash
pnpm dev        # dev server
pnpm test       # vitest, 91 tests
pnpm lint       # eslint — 0 errors expected
pnpm build      # production build
pnpm audit --prod --audit-level high   # the CI security gate
```

CI runs lint, test, build and the prod audit. All four must pass — none is `--if-present`
any more, because two of them silently passed for months.

## Operational workflows (Actions tab)

| Workflow | Purpose |
|---|---|
| Fetch Live Inverter Data | every 5 min, Solis → `inverter_data_live` |
| Generate Daily Inverter Summary | 2×/day, aggregates into `inverter_data_daily_summary` |
| Data Freshness Check | daily; opens a `data-outage` issue if rows stop arriving |
| Backfill Daily Summaries | manual; rebuilds gaps from the Solis month API. **Dry run by default** |
| DB Snapshot | manual; read-only export of tables + schema as an artifact |
| Keepalive | stops GitHub disabling the scheduled workflows for inactivity |

**Take a DB Snapshot before running anything that writes.**

---

## Conventions

- Plain JavaScript, ESM. No TypeScript, no tsconfig — don't add a `typecheck` script unless
  you actually introduce TS.
- Serverless functions live in `api/`. Vercel Hobby caps this at **12 functions**; anything
  under `api/_lib/` or `api/_config/` doesn't count. Currently 10/12.
- Health probes `/healthz` and `/ready` share ONE function via rewrites in `vercel.json` —
  two handlers would have put the count at the cap exactly.
- Dates: serialise with local components, never `.toISOString()` on a local-midnight `Date` —
  Asia/Colombo is UTC+5:30, so that silently shifts the date back a day.
- A batch job that processed nothing has **not** succeeded. Fail loudly; don't exit 0 over an
  empty result.

## Documentation

Reference — how it works now:

- `docs/ARCHITECTURE.md` — system design, both pipelines, data model, security. **Start here.**
- `docs/API.md` — every endpoint, auth model, error shapes
- `docs/RUNBOOK.md` — operating procedures and incident response
- `docs/logic-registry/` — specs for the non-obvious domain rules

History — why it is the way it is:

- `docs/PROJECT_AUDIT_2026-09.md` — full audit: security, API, data, UI, CI, docs
- `docs/RECOVERY_STATUS_2026-09.md` — the five-month data outage and its three stacked causes
- `docs/DATA_PIPELINE_SAFEGUARDS.md` — what now prevents a silent recurrence

The history documents are a **record**, not a description of the present. Where they disagree
with the reference documents, the reference documents are right.

## State as of v2.1.0 (2026-09-13)

The parser now handles both bill formats and the data trail is verified end to end — 25 bills,
2024-09-05 to 2026-09-03, no duplicates, meter deltas and tariff maths internally consistent.

Next up is a **UI redesign**. `v2.1.0` is tagged as the last known-good state before it.

Deliberately deferred, because that surface is about to be rewritten:

- LCP 6.2s, of which 5,281ms is render delay (Lighthouse Performance 67)
- 393 KiB of unused JavaScript; react-vendor is 785 KiB

Genuinely open:

- ~20 unapproved `ceb_bill_ingestions` rows to clean up, including an orphaned June row
  pointing at a deleted file
- Supabase Edge Function `solis-live-data` returns 500 (unused by the current data path)
