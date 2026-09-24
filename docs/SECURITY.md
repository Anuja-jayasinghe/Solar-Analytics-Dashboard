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
| `ceb_data` | R — **four columns only**: `id`, `bill_date`, `earnings`, `units_exported` | The public dashboard's billing figures. The account number, file path and ingestion id are not public |
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

Column-level privileges are what enforce "four columns only": RLS decides which *rows* `anon`
sees, the `GRANT` decides which *columns*. A browser query for anything else — including
`select *` — is refused by Postgres. The admin CEB table reads all columns through
`GET /api/ceb-bills/records`.

**Verify the live database matches** (expect only `SELECT` rows, and none at all for the closed
objects):

```sql
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where roles && array['anon', 'public']::name[]
order by schemaname, tablename, policyname;
```

`public` in `roles` means every role, `anon` included. And the column check for `ceb_data`
(expect `true` for exactly `id`, `bill_date`, `earnings`, `units_exported`):

```sql
select column_name,
       has_column_privilege('anon', 'public.ceb_data', column_name, 'select') as anon_can_read
from information_schema.columns
where table_schema = 'public' and table_name = 'ceb_data'
order by ordinal_position;
```

Bringing the database into line with this matrix is
`scripts/sql/2026-09-24_revoke_anon_bill_access.sql` (bills) and
`scripts/sql/2026-09-24_ceb_data_public_columns.sql` (`ceb_data` columns), on top of
`scripts/sql/2026-09-12_revoke_anon_writes.sql` (writes). Migrations are applied by hand; see
[`MIGRATIONS.md`](./MIGRATIONS.md).

## Widening the public surface

If the redesign needs another column on the public dashboard, add it to the `GRANT` in a **new**
migration and list it in the matrix above. Do not grant the whole table again: the account number
is real customer data.

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
