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
       → POST /api/ceb-bills/extract   (pdf-parse + regex → ceb_bill_extractions)
       → VerificationQueue.jsx         (admin reviews / edits)
       → PUT  /api/ceb-bills/records   (upsert ceb_data + mark approved)
```

**The extractor is not OCR and not AI.** `@google/generative-ai` was removed; the
`CEB_BILL_AUTOMATION_IMPLEMENTATION_PLAN.md` describing Google Document AI was **never
built**. What runs is `pdf-parse@2.4.5` text extraction plus six regexes pinned to the exact
text layout of the pre-2026 bill — see `api/_lib/cebBillParser.js`.

---

## Security model — read before touching data access

- `VITE_SUPABASE_ANON_KEY` is **public**. It ships in the browser bundle.
- Therefore the browser client **reads only**. RLS grants `anon` `SELECT` and nothing else.
- **Every write goes through an admin-authenticated API endpoint** using the service-role key,
  which bypasses RLS. Never reintroduce a client-side `.insert()` / `.update()` / `.upsert()`.
- Authorization is Clerk `publicMetadata.role === 'admin'`, verified server-side in
  `api/middleware/verifyAdminToken.js`. The `admin_users` table is legacy and unused.
- `SUPABASE_SERVICE_KEY` must be the **service_role** key. An anon key there fails every
  insert with "violates row-level security policy" — this caused a five-month outage.

---

## Commands

```bash
pnpm dev        # dev server
pnpm test       # vitest, 45 tests
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
- Dates: serialise with local components, never `.toISOString()` on a local-midnight `Date` —
  Asia/Colombo is UTC+5:30, so that silently shifts the date back a day.
- A batch job that processed nothing has **not** succeeded. Fail loudly; don't exit 0 over an
  empty result.

## Context

Three documents carry the history and are worth reading before large changes:

- `docs/PROJECT_AUDIT_2026-09.md` — full audit: security, API, data, UI, CI, docs
- `docs/RECOVERY_STATUS_2026-09.md` — the five-month data outage and its three stacked causes
- `docs/DATA_PIPELINE_SAFEGUARDS.md` — what now prevents a silent recurrence

**Known open item:** the CEB bill parser is broken against the redesigned bill format. Fixing
it needs a sample of the new PDF; add its extracted text as a fixture alongside
`tests/fixtures/ceb-bill-legacy.txt`.
