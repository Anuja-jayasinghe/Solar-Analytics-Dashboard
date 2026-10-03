-- 2026-09-24_ceb_schema_drift.sql
--
-- Bring the repository's CEB schema in line with what the code (and the live project) use.
--
-- WHY
-- api/ceb-bills/extract.js writes `confidence_score` and `meter_reading_previous` to
-- `ceb_bill_extractions`. Neither column appears in any migration under scripts/sql/ — they were
-- added to the live project by hand. A database rebuilt from this repository would reject every
-- extraction insert.
--
-- Additive and idempotent: on the live project both columns already exist, so this is a no-op
-- there. The types match what the code writes (a rounded 0–100 score; a meter reading).

alter table public.ceb_bill_extractions
  add column if not exists confidence_score       integer,
  add column if not exists meter_reading_previous numeric;

-- ---------------------------------------------------------------------------
-- NOT CAPTURED HERE — needs a decision
-- ---------------------------------------------------------------------------
-- The live project has a trigger, `trg_cascade_delete_ceb_data`, that deletes the extraction
-- and ingestion rows behind a `ceb_data` row when it is deleted. It exists in no migration.
--
-- The application no longer depends on it: /api/ceb-bills/delete removes every dependent row
-- itself, explicitly and in order. So it is redundant, and it can hide the cascade from anyone
-- reading the code. To see exactly what it does:
--
--   select pg_get_triggerdef(t.oid, true)
--   from pg_trigger t
--   where t.tgname = 'trg_cascade_delete_ceb_data' and not t.tgisinternal;
--
-- The decision was to drop it: see 2026-09-24_drop_cascade_trigger.sql, whose header lists what
-- to check first.
--
-- ALSO WORTH KNOWING
-- * `ceb_data.ingestion_id` has no foreign key to `ceb_bill_ingestions(id)`; integrity between
--   the two relies on the application. Add one only after confirming no orphans:
--     select count(*) from public.ceb_data d
--     where d.ingestion_id is not null
--       and not exists (select 1 from public.ceb_bill_ingestions i where i.id = d.ingestion_id);
-- * The unique index behind the upsert, (account_number, billing_month), treats NULLs as
--   distinct, so a record saved without an account number never conflicts and can duplicate a
--   month. The approval path always supplies one; manual entry may not.
