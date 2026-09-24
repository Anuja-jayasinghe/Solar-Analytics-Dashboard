-- 2026-09-24_drop_cascade_trigger.sql
--
-- Drop `trg_cascade_delete_ceb_data`, a trigger that exists in the live project and in no
-- migration.
--
-- WHY
-- It deletes the extraction and ingestion rows behind a `ceb_data` row when that row is deleted.
-- The old `/api/ceb-bills/delete-record` endpoint relied on it. `/api/ceb-bills/delete` no longer
-- does: it removes every dependent row itself, explicitly and in order, and checks each result.
-- What remains is a redundant, undocumented cascade that surprises anyone reading the code — and
-- anything else that deletes from `ceb_data` (a script, the SQL editor) silently deletes bill
-- records and their ingestions too.
--
-- BEFORE YOU RUN IT
-- 1. Take a DB Snapshot (see docs/RUNBOOK.md).
-- 2. Deploy the application code containing the merged `/api/ceb-bills/delete` endpoint. The
--    previous `delete-record` endpoint depended on this trigger.
-- 3. Read what it does, so the ledger records what was removed:
--
--      select pg_get_triggerdef(t.oid, true) as trigger_definition,
--             p.proname                       as function_name,
--             pg_get_functiondef(p.oid)       as function_definition
--      from pg_trigger t
--      join pg_proc p on p.oid = t.tgfoid
--      where t.tgname = 'trg_cascade_delete_ceb_data' and not t.tgisinternal;
--
-- 4. Confirm nothing else deletes from `ceb_data` expecting the cascade. In this repository the
--    only deleter is /api/ceb-bills/delete.
--
-- WHAT THIS DOES NOT DO
-- It drops the trigger, not the function behind it — the function's name is only known from
-- step 3, and a function nothing calls is harmless. Drop it afterwards if you want a clean
-- catalogue.
--
-- Safe to run more than once.
--
-- ROLLBACK
-- Recreate the trigger from the definition captured in step 3.

begin;

drop trigger if exists trg_cascade_delete_ceb_data on public.ceb_data;

commit;

-- VERIFY (expect zero rows)
--   select 1 from pg_trigger where tgname = 'trg_cascade_delete_ceb_data' and not tgisinternal;
