-- Rollback for 2026-10-04_v3_revoke_anon_read_at_v1_removal.sql: give the deprecated v1 dashboard its
-- direct reads back. Restores exactly the policies that existed on 2026-10-04 (anon + authenticated,
-- `using (true)`), except the two bill tables, which should stay closed (the admin screens use
-- /api/ceb-bills/* now).

grant select on public.ceb_data, public.inverter_data_daily_summary, public.inverter_data_live,
  public.inverter_data_live_archive, public.inverter_data_monthly_summary,
  public.system_metrics, public.system_settings to anon;

create policy ceb_data_anon_select on public.ceb_data for select to anon, authenticated using (true);
create policy inverter_daily_anon_select on public.inverter_data_daily_summary for select to anon, authenticated using (true);
create policy inverter_live_anon_select on public.inverter_data_live for select to anon, authenticated using (true);
create policy inverter_archive_anon_select on public.inverter_data_live_archive for select to anon, authenticated using (true);
create policy inverter_monthly_anon_select on public.inverter_data_monthly_summary for select to anon, authenticated using (true);
create policy system_metrics_anon_select on public.system_metrics for select to anon, authenticated using (true);
create policy system_settings_anon_select on public.system_settings for select to anon, authenticated using (true);
