# Security

Who may do what in this system, how that is enforced, and how to check it is still true.
The design rules live in [`ARCHITECTURE.md`](./ARCHITECTURE.md#security-model); this page is the
policy matrix and the checklist.

## Trust boundaries

| Actor | Credential | What it can reach |
|---|---|---|
| Any visitor | `VITE_SUPABASE_ANON_KEY` — **public**, compiled into the browser bundle | Only what RLS grants the `anon` role |
| Admin | Clerk session; `publicMetadata.role === 'admin'`, checked server-side on every request by `api/_lib/verifyAdminToken.js` | The admin API endpoints |
| Server code | `SUPABASE_SERVICE_KEY` (service role, bypasses RLS) | Everything, only ever from `api/` and the scheduled jobs |

The consequence that shapes everything else: **anything the anon key can read is public.** The
key is not a secret, so a table or bucket is either public by design or closed to `anon`.

## Policy matrix (intended state)

`R` = SELECT, `W` = INSERT / UPDATE / DELETE, `–` = no access. The service role bypasses RLS and
is not listed.

| Object | `anon` | Why |
|---|---|---|
| `ceb_data` | R | The public dashboard's billing figures |
| `system_settings` | R | The dashboard needs the tariff and targets |
| `inverter_data_live`, `_daily_summary`, `_monthly_summary` | R | Public generation data |
| `system_metrics` | R | Public dashboard metrics |
| `ceb_bill_ingestions` | – | Holds bill file paths, hashes and admin e-mail addresses |
| `ceb_bill_extractions` | – | Holds account numbers and meter readings parsed from bills |
| `admin_users`, `api_logs`, `report_logs`, `inverter_data_live_archive` | – | Internal |
| Storage bucket `ceb_bills` | – | Every bill PDF carries the account holder's name, address, phone number and account number |

No table grants `anon` any write. Every write goes through an admin API endpoint.

How the admin screens work without `anon` access to the closed rows:

- The review queue is `GET /api/ceb-bills/ingestions?view=queue`.
- Bill previews are `POST /api/ceb-bills/signed-url`.

**Verify the live database matches** (expect only `SELECT` rows, and none at all for the closed
objects):

```sql
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where roles && array['anon', 'public']::name[]
order by schemaname, tablename, policyname;
```

`public` in `roles` means every role, `anon` included. Bringing the database into line with
this matrix is `scripts/sql/2026-09-24_revoke_anon_bill_access.sql` (bills) on top of
`scripts/sql/2026-09-12_revoke_anon_writes.sql` (writes). Migrations are applied by hand; see
[`MIGRATIONS.md`](./MIGRATIONS.md).

## Known limitation

`ceb_data` is public by design, but its rows also carry `account_number`, `file_path` and
`ingestion_id`, which the dashboard does not need. Closing that means exposing a view with only
the display columns and pointing the dashboard at it; it has not been done. The storage path is
harmless without bucket access, but the account number is real customer data.

## Checklist for a new endpoint

1. Authenticate first: `verifyAdminToken(req, res)`; stop if it returns `null`.
2. `handlePreflightAndMethod(req, res, [...])` with only the methods the handler implements.
3. `blockOnConfigProblem(res)` before touching the database.
4. Validate every input with an allowlist, not a blocklist: known values, types, lengths. Copy
   fields into a new object rather than passing the request body through.
5. Never echo `error.message` from a dependency to the caller; log it, return a fixed message.
6. Order writes so a failure part-way leaves the data consistent, check every result, and make
   the operation safe to repeat.
7. Add a unit test for the validation and update [`API.md`](./API.md).
8. Count the function: Vercel Hobby allows 12 and the project uses 10. Anything under
   `api/_lib/` or `api/_config/` does not count.

## Secrets

- Never prefix a secret with `VITE_` — Vite compiles those into the browser bundle.
- Vercel and GitHub Actions hold **separate** copies of the secrets. Rotating one does not
  rotate the other.
- `SUPABASE_SERVICE_KEY` must be the service-role key. `describeConfigProblem()` in
  `api/_lib/supabaseServer.js` rejects an anon key, and the scheduled jobs and write scripts
  call it at start-up and exit non-zero on a mismatch.
- Real CEB bills are never committed (`resources/` is gitignored). Test fixtures use a
  placeholder account number and redacted personal details.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository rather than a public issue.
