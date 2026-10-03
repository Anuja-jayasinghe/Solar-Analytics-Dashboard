-- Rollback for 2026-10-03_v3_telemetry_schema.sql.
-- DESTRUCTIVE: drops the v3 telemetry tables and their data. Nothing in v1 depends on them.
-- The collected data can be re-fetched from SolisCloud (history >= 2 years), so this is
-- recoverable, but it is still a drop: run only with explicit owner confirmation.

drop table if exists public.inverter_status_segments;
drop table if exists public.inverter_day_uptime;
drop table if exists public.inverter_alarms;
drop table if exists public.collector_heartbeats;
drop table if exists public.inverter_telemetry;
drop table if exists public.collector_runs;

delete from public.system_settings where setting_name = 'capacity_kwp';
