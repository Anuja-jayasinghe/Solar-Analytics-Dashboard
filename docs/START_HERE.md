# Start Here

Orientation for this project. If you have been away a while, read this page and nothing else
until something here sends you elsewhere.

> **Note:** this file used to be a guide to local Clerk auth dev tooling, which is a niche
> topic that happened to be the most recent thing anyone had written about. It is now at
> [`LOCAL_AUTH_QUICK_START.md`](./LOCAL_AUTH_QUICK_START.md).

---

## What this project is

A React 19 + Vite SPA on Vercel, backed by Supabase, that compares **what the solar inverter
generated** against **what the electricity company (CEB) paid for**. One site, one 40 kW
inverter, Sri Lanka.

Two data sources, joined by billing period:

| Side | Source | Table | Collected by |
|---|---|---|---|
| Inverter | SolisCloud API | `inverter_data_live`, `inverter_data_daily_summary` | GitHub Actions cron |
| CEB | Bill PDFs, uploaded by an admin | `ceb_data` | Admin dashboard pipeline |

## The one rule that matters

**A bill received in month N reports generation from month N−1.**

Everything on the comparison charts follows from that. Full spec:
[`logic-registry/LR-001`](./logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md).

---

## Read these three, in order

| | |
|---|---|
| [`PROJECT_AUDIT_2026-09.md`](./PROJECT_AUDIT_2026-09.md) | Full audit — security, API, data, UI, CI, docs. Start here to understand the current state |
| [`RECOVERY_STATUS_2026-09.md`](./RECOVERY_STATUS_2026-09.md) | The five-month data outage and its three stacked causes. Explains *why* much of the code looks the way it does |
| [`DATA_PIPELINE_SAFEGUARDS.md`](./DATA_PIPELINE_SAFEGUARDS.md) | What now prevents a silent recurrence, and what is still not covered |

`../CLAUDE.md` at the repo root is the condensed version of all three.

---

## Getting it running

1. Copy `../vercel.env.example` to `.env` and fill it in. Every variable is documented there.
2. `pnpm install && pnpm dev`

`SUPABASE_SERVICE_KEY` must be the **service_role** key, not the anon key. Getting that wrong
is what caused the outage.

```bash
pnpm test     # 45 tests
pnpm lint     # 0 errors expected
pnpm build
```

---

## Where things are

| Looking for | Go to |
|---|---|
| How a CEB bill becomes a row | [`guides/CEB_BILL_ENTRY_GUIDE.md`](./guides/CEB_BILL_ENTRY_GUIDE.md) |
| The comparison logic | [`logic-registry/LR-001`](./logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md) |
| Caching and refresh behaviour | [`guides/DATA_REFRESH_AND_CACHING_GUIDE.md`](./guides/DATA_REFRESH_AND_CACHING_GUIDE.md) |
| Deploying | [`guides/DEPLOYMENT_CHECKLIST.md`](./guides/DEPLOYMENT_CHECKLIST.md) |
| Admin dashboard internals | [`ADMIN_DASHBOARD_CURRENT_STATE.md`](./ADMIN_DASHBOARD_CURRENT_STATE.md) |
| Local Clerk auth dev tooling | [`LOCAL_AUTH_QUICK_START.md`](./LOCAL_AUTH_QUICK_START.md) |

## Known open item

**The CEB bill parser is broken against the redesigned bill.** The extractor is regex over
`pdf-parse` output, pinned to the exact text layout of the pre-2026 bill. Fixing it needs a
sample of the new PDF; its extracted text goes in as a second fixture beside
`tests/fixtures/ceb-bill-legacy.txt`.

## ⚠️ Documents that will mislead you

- **`development/CEB_BILL_AUTOMATION_IMPLEMENTATION_PLAN.md`** describes a Google Document AI
  architecture that was **never built**. AI extraction was tried and deliberately abandoned
  (commit `ba7bf51`) as unreliable. The real implementation is regex — `api/_lib/cebBillParser.js`.
- Anything under `migration/` or `development/CLERK_*` describes a migration that is **done**.
- `archive/` is kept for history only.
