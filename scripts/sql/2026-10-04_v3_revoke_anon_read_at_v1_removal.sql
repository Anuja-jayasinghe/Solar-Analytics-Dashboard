-- v3 cutover, final step (issue #155): make the real data PRIVATE.
--
-- !! DO NOT APPLY WHILE THE DEPRECATED v1 DASHBOARD (served under /v1) IS STILL REACHABLE. !!
-- v1 reads these tables directly in the browser with the public anon key. The moment this runs,
-- v1 shows errors instead of data. The new dashboard is unaffected: it reads only through the
-- authenticated /api/data/* endpoints, which use the service-role key server-side.
--
-- Today (checked read-only on 2026-10-04) anonymous visitors CAN read, through RLS policies with
-- `using (true)`:
--   ceb_data, inverter_data_daily_summary, inverter_data_live, inverter_data_live_archive,
--   inverter_data_monthly_summary, system_metrics, system_settings,
--   ceb_bill_extractions, ceb_bill_ingestions   (the last two hold account numbers and the
--   storage path of every bill PDF; 2026-09-24_revoke_anon_bill_access.sql removes them and is
--   safe to apply NOW, because the code that replaced those browser reads is deployed).
-- and hold the SELECT privilege (without a policy, so currently blocked by RLS) on:
--   admin_users, api_logs, report_logs.
--
-- Order of operations at v1 removal:
--   1. Take a DB Snapshot (workflow "DB Snapshot").
--   2. Remove v1 (delete the /v1 mount and the legacy src files) and deploy.
--   3. Apply this file. 4. Check as an anonymous visitor: / works on demo data; the REST API
--      refuses the tables (curl -H "apikey: <anon key>" .../rest/v1/ceb_data -> [] or 401).
--
-- Rollback: 2026-10-04_v3_revoke_anon_read_at_v1_removal_rollback.sql.

-- 1. Drop every anon/public SELECT policy on the dashboard tables.
drop policy if exists ceb_bill_extractions_anon_select on public.ceb_bill_extractions;
drop policy if exists ceb_bill_ingestions_select_anon on public.ceb_bill_ingestions;
drop policy if exists ceb_data_anon_select on public.ceb_data;
drop policy if exists inverter_daily_anon_select on public.inverter_data_daily_summary;
drop policy if exists inverter_live_anon_select on public.inverter_data_live;
drop policy if exists inverter_archive_anon_select on public.inverter_data_live_archive;
drop policy if exists inverter_monthly_anon_select on public.inverter_data_monthly_summary;
drop policy if exists system_metrics_anon_select on public.system_metrics;
drop policy if exists system_settings_anon_select on public.system_settings;

-- 2. Remove the privilege itself, so RLS is the second wall rather than the only one.
revoke select on all tables in schema public from anon;

-- 3. Tables created later must not get it back by default.
alter default privileges in schema public revoke select on tables from anon;
