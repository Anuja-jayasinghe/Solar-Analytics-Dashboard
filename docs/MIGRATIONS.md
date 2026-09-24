# Database migrations

How schema and policy changes reach the Supabase project, and what has been applied.

## Why this page exists

Before September 2026 the repository held migrations for two tables and none for the ones the
dashboard reads. Columns were added to the live project by hand (`confidence_score`,
`meter_reading_previous`), and a trigger exists there that appears in no file. Nothing recorded
which migrations had actually been run. This page is the fix: one workflow, and a ledger.

## Workflow

Migrations are plain SQL under `scripts/sql/`, named `YYYY-MM-DD_what_it_does.sql`. They are
applied **by hand** in the Supabase SQL editor. There is no migration runner, and adding one
for a single-site project would be more machinery than the problem needs.

1. **Write it idempotent** — `if not exists`, `drop policy if exists`, `create or replace`. Then
   running it twice, or against a project that already has the change, is harmless.
2. **Say why, and say when to run it, in the file header.** If it must follow a code deploy (or
   precede one) that is the first thing the header states. Two of the migrations below are
   order-sensitive.
3. **Include a rollback**, even if it is a comment.
4. **Take a DB Snapshot first** — the manual *DB Snapshot* workflow (see the
   [runbook](./RUNBOOK.md)). It is read-only and takes two minutes.
5. **Run it, then run its verification query.** Most headers include one.
6. **Record it in the ledger below** in the same pull request that adds the file, or in a
   follow-up the moment it is applied. An unrecorded migration is the failure this page exists
   to prevent.
7. Never edit a migration that has been applied. Add a new one.

Everything in `scripts/sql/` should be safe to replay in filename order onto an empty project,
except the two `2026-04-23_…anon…` files, which are superseded (see the ledger).

## Ledger

| File | Purpose | Applied to production |
|---|---|---|
| `2026-04-23_create_ceb_bill_ingestions.sql` | Upload records table, unique SHA-256 index | Yes — the table is in use |
| `2026-04-23_create_ceb_bill_extractions.sql` | Parsed-bill table | Yes — the table is in use |
| `2026-04-23_ceb_bill_ingestions_anon_mode_policies.sql` | **Superseded.** Granted `anon` access to the bill tables and bucket, for an earlier design in which the browser did everything | Probably yes — the browser relied on it until 2026-09-24. Removed by `2026-09-24_revoke_anon_bill_access.sql`. **Do not run it again** |
| `2026-09-12_baseline_schema.sql` | Point-in-time reconstruction of the live schema. `if not exists` throughout, so a no-op on the live project | Recorded as generated *from* the live database |
| `2026-09-12_revoke_anon_writes.sql` | Removed `anon` INSERT/UPDATE on `ceb_data` and `system_settings`, and the `admin_users` policies | **Not recorded — verify** with the policy query in [`SECURITY.md`](./SECURITY.md) |
| `2026-09-24_revoke_anon_bill_access.sql` | Closes the bill tables and the `ceb_bills` bucket to `anon`. **Deploy the code that adds `/signed-url` and `?view=queue` first** | **Not applied** |
| `2026-09-24_approve_ceb_extraction.sql` | `approve_ceb_extraction()` — bill approval in one transaction. Safe before or after the code; the API falls back and warns until it is installed | **Not applied** |
| `2026-09-24_drop_cascade_trigger.sql` | Drops the live-only `trg_cascade_delete_ceb_data` trigger, now redundant. Read its header first: snapshot, deploy the merged `/delete` endpoint, read the definition | **Not applied** |
| `2026-09-24_ceb_schema_drift.sql` | Adds `confidence_score` and `meter_reading_previous`, which the code writes but no migration declared. No-op on the live project | **Not applied** (no-op if the columns exist) |

When you apply one, change its last cell to `Yes — YYYY-MM-DD`.

## Suggested order for the three pending migrations

1. `2026-09-24_ceb_schema_drift.sql` — harmless; do it first.
2. `2026-09-24_approve_ceb_extraction.sql` — harmless; the API picks it up on the next approval.
3. Deploy the application code containing `/api/ceb-bills/signed-url` and
   `/api/ceb-bills/ingestions?view=queue`, then confirm in the admin screen that the review queue
   loads and a bill preview opens.
4. `2026-09-24_revoke_anon_bill_access.sql` — then the verification query in `SECURITY.md`, and
   reload the review queue and a preview once more.
5. `2026-09-24_drop_cascade_trigger.sql` — once the merged `/delete` endpoint is live. Read its
   header first; it asks you to record the trigger's definition before dropping it.

## Things deliberately not migrated yet

- A foreign key from `ceb_data.ingestion_id` to `ceb_bill_ingestions(id)`, and a fix for the
  unique index treating NULL account numbers as distinct. Both are described in the same file.
- A view exposing only the display columns of `ceb_data`. See *Known limitation* in
  [`SECURITY.md`](./SECURITY.md).
