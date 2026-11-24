-- 2026-11-24_observability_schedule.sql
--
-- Issue #241: a scheduler that keeps time. Supabase pg_cron (with pg_net for the HTTP calls) replaces
-- GitHub's cron for the jobs where timing matters. Measured in November 2026, GitHub ran the 5-minute
-- live job about 5 times a day, only 2 or 3 of them in daylight, with a 6.5 to 8.5 hour gap every day,
-- and started the 02:30 UTC daily check around 10:00 UTC.
--
-- WHEN TO RUN: after 2026-11-24_observability_tables.sql, and after the code with POST /api/ops/watch is
-- deployed. Take a DB Snapshot first (Actions → DB Snapshot), per docs/MIGRATIONS.md.
--
-- BEFORE RUNNING, the owner creates two secrets in Supabase (Dashboard → Project Settings → Vault, or
-- `select vault.create_secret('<value>', '<name>');` in the SQL editor). They are never in this file:
--   ops_watch_secret          the same value as OPS_WATCH_SECRET in Vercel (Production)
--   github_dispatch_token     a fine-grained GitHub token: this repository only, permission
--                             "Actions: Read and write", nothing else; an expiry date you will notice
-- A job whose secret does not exist does nothing (no call is made), so the order does not matter.
--
-- WHAT IT SCHEDULES (UTC; Colombo is UTC+5:30)
--   ops-watch                 every 15 min    POST https://solaredge.anujajay.com/api/ops/watch
--   live-collector-dispatch   every 15 min, 00:00–12:45 UTC (05:30–18:15 Colombo)
--                                             starts the "Fetch Live Inverter Data" workflow through the
--                                             GitHub API (workflow_dispatch). Dispatched runs start within
--                                             about a minute, unlike scheduled ones. The public repository's
--                                             Actions minutes are free. The workflow's own schedule stays as
--                                             a fallback; its concurrency group stops overlapping runs.
--   observability-retention   daily 21:00 UTC (02:30 Colombo)
--                                             request_log 30 days, error_events 30 days after last seen,
--                                             admin_audit_log 2 years, resolved alerts 90 days, cron run
--                                             history 7 days
--
-- Idempotent: each job is unscheduled by name before it is scheduled again.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare j text;
begin
  foreach j in array array['ops-watch', 'live-collector-dispatch', 'observability-retention'] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end $$;

select cron.schedule('ops-watch', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://solaredge.anujajay.com/api/ops/watch',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || s.decrypted_secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 30000
  )
  from vault.decrypted_secrets s where s.name = 'ops_watch_secret';
$job$);

select cron.schedule('live-collector-dispatch', '*/15 0-12 * * *', $job$
  select net.http_post(
    url := 'https://api.github.com/repos/Anuja-jayasinghe/Solar-Analytics-Dashboard/actions/workflows/fetch-live-inverter-data.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || s.decrypted_secret,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'solar-dashboard-pg-cron',
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 10000
  )
  from vault.decrypted_secrets s where s.name = 'github_dispatch_token';
$job$);

select cron.schedule('observability-retention', '0 21 * * *', $job$
  delete from public.request_log      where at < now() - interval '30 days';
  delete from public.error_events     where last_seen_at < now() - interval '30 days';
  delete from public.admin_audit_log  where at < now() - interval '2 years';
  delete from public.alert_state      where status = 'resolved' and resolved_at < now() - interval '90 days';
  delete from cron.job_run_details    where end_time < now() - interval '7 days';
$job$);

-- VERIFY
--   select jobname, schedule, active from cron.job order by jobname;          -- the three jobs, active
--   select name from vault.secrets where name in ('ops_watch_secret', 'github_dispatch_token');   -- both
-- After 15 minutes:
--   select j.jobname, d.status, d.return_message, d.start_time
--     from cron.job_run_details d join cron.job j using (jobid)
--    order by d.start_time desc limit 10;                                    -- succeeded
--   select id, status_code, left(content::text, 200), created
--     from net._http_response order by created desc limit 5;                -- 200 (watch), 204 (dispatch)
--
-- ROLLBACK (stops the schedule; leaves the extensions and the secrets):
--   select cron.unschedule(jobname) from cron.job
--    where jobname in ('ops-watch', 'live-collector-dispatch', 'observability-retention');
