-- 2026-09-24_ceb_data_public_columns.sql
--
-- Narrow what the public `anon` role can read from `ceb_data` to the columns the public
-- dashboard actually uses.
--
-- WHY
-- `ceb_data` is public by design — the dashboard charts CEB earnings and exported units. But
-- the table also carries `account_number`, `file_path`, `ingestion_id`, `bill_image_path`,
-- `billing_month` and `meter_reading`, and the anon key ships in the browser bundle, so all of
-- it was readable by anyone. The account number is real customer data; a bill's storage path
-- is harmless on its own but is not something to publish.
--
-- The public dashboard reads exactly four columns (src/contexts/DataContext.jsx,
-- src/lib/dataService.js):
--     id, bill_date, earnings, units_exported
-- Everything else is now reachable only through GET /api/ceb-bills/records, which is
-- admin-authenticated and uses the service-role key (which bypasses these privileges).
--
-- HOW
-- Column-level privileges, layered on the existing RLS policy (`ceb_data_anon_select`, which
-- stays: it decides WHICH ROWS anon sees; this decides WHICH COLUMNS). A query that names other
-- columns, or `select *`, is refused by Postgres with "permission denied".
--
-- ORDER OF OPERATIONS — IMPORTANT
-- Deploy the application code containing `GET /api/ceb-bills/records` FIRST. The previous admin
-- table did `select *` from the browser and stops working the moment this runs. Then run this,
-- then reload the admin CEB table and the public dashboard.
--
-- If the redesign needs another column on the public page, add it to the GRANT below in a new
-- migration — do not widen this one back to the whole table.
--
-- Safe to run more than once.
--
-- VERIFY
--   select column_name,
--          has_column_privilege('anon', 'public.ceb_data', column_name, 'select') as anon_can_read
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'ceb_data'
--   order by ordinal_position;
-- Expect `true` for exactly: id, bill_date, earnings, units_exported.
--
-- ROLLBACK
--   grant select on public.ceb_data to anon;

begin;

-- Supabase grants new tables' privileges to anon by default. Take back everything, including
-- write privileges that RLS already blocks, so the table does not rely on a single barrier.
revoke all on public.ceb_data from anon;

grant select (id, bill_date, earnings, units_exported) on public.ceb_data to anon;

commit;
