# Start Here

Orientation for this project. If you have been away a while, read this page and nothing else
until something here sends you elsewhere.

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

A second rule, learned the hard way: **`null` means unavailable, `0` means a measured zero.**
Never conflate them — fabricated zeros have corrupted this data twice.

---

## Read these, in order

| | |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | How the system works: both pipelines, the data model, the security model. **Start here** |
| [`SECURITY.md`](./SECURITY.md) | Who can do what, the policy matrix, and the checklist for a new endpoint |
| [`RUNBOOK.md`](./RUNBOOK.md) | When something is wrong, or you need to do something routine |

`../CLAUDE.md` at the repo root is the condensed version of all of this.

## Getting it running

See [`guides/LOCAL_DEVELOPMENT.md`](./guides/LOCAL_DEVELOPMENT.md). In short: copy
`.env.example` to `.env`, `pnpm install`, `pnpm dev`. `SUPABASE_SERVICE_KEY` must be the
**service_role** key, not the anon key — getting that wrong is what caused the five-month outage.

```bash
pnpm test     # vitest
pnpm lint     # 0 errors expected
pnpm build
```

---

## Where things are

| Looking for | Go to |
|---|---|
| Every endpoint, its auth and its errors | [`API.md`](./API.md) |
| How a CEB bill becomes a row | [`guides/CEB_BILL_ENTRY_GUIDE.md`](./guides/CEB_BILL_ENTRY_GUIDE.md) |
| The comparison logic | [`logic-registry/`](./logic-registry/README.md) |
| Changing the database | [`MIGRATIONS.md`](./MIGRATIONS.md) — and what has been applied |
| Deploying | [`guides/DEPLOYMENT_CHECKLIST.md`](./guides/DEPLOYMENT_CHECKLIST.md) |
| Caching and refresh behaviour | [`guides/DATA_REFRESH_AND_CACHING_GUIDE.md`](./guides/DATA_REFRESH_AND_CACHING_GUIDE.md) |
| What was found and fixed in the last audit | [`REPO_AUDIT_2026-09-24.md`](./REPO_AUDIT_2026-09-24.md) |
| Older material | [`archive/`](./archive/README.md) |

## History, not present

These record why the code is the way it is. Where they disagree with the reference documents
above, **the reference documents are right**.

- [`PROJECT_AUDIT_2026-09.md`](./PROJECT_AUDIT_2026-09.md) — the September 2026 audit
- [`RECOVERY_STATUS_2026-09.md`](./RECOVERY_STATUS_2026-09.md) — the five-month data outage and its three stacked causes
- [`DATA_PIPELINE_SAFEGUARDS.md`](./DATA_PIPELINE_SAFEGUARDS.md) — what now prevents a silent recurrence
- [`REPO_AUDIT_2026-09-24.md`](./REPO_AUDIT_2026-09-24.md) — the follow-up audit and its remediation
