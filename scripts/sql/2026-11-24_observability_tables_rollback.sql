-- 2026-11-24_observability_tables_rollback.sql
--
-- Undoes 2026-11-24_observability_tables.sql. The request log, audit log, error history and alert state
-- in these tables are lost: take a DB Snapshot first. The API keeps working without them (each writer
-- logs one warning and carries on).

drop function if exists public.record_error_event(text, text, text, text, text, text, jsonb, text);
drop table if exists public.error_events;
drop table if exists public.admin_audit_log;
drop table if exists public.request_log;
drop table if exists public.alert_state;
