-- 2026-11-24_observability_tables.sql
--
-- Issue #241 (observability): the four private tables behind alerts, durable logs and error tracking,
-- and the one function that records an error.
--
-- WHEN TO RUN: before the code that writes these tables is deployed. Each writer treats a missing
-- table as "not set up yet": it logs one warning and carries on, so running it after the deploy is
-- harmless too. Nothing reads these tables until the Admin panels land.
-- Take a DB Snapshot first (Actions → DB Snapshot), per docs/MIGRATIONS.md.
--
-- WHAT IT ADDS
--   alert_state       one row per alert key (api/_lib/alerts.js): open or resolved, when it was last
--                     emailed. This is what turns an outage into one email, not hundreds.
--   request_log       one row per API request (api/_lib/log.js): route, method, status, latency, the
--                     Clerk user id and access level. Kept 30 days (pruned by the watchdog migration).
--   admin_audit_log   one row per privileged change (api/_lib/log.js audit()). Kept 2 years.
--   error_events      browser errors and unexpected API 5xx, grouped by fingerprint (one row per
--                     distinct error, with a count). Kept 30 days after it was last seen.
--   record_error_event()  inserts or counts an error in one statement, and refuses a NEW group once
--                     50 new groups have appeared in the past hour, so a hostile client cannot fill
--                     the table with made-up errors.
--
-- PRIVACY (docs/WORKING_RULES.md §3): no e-mail addresses, names, account numbers, meter readings or
-- tokens in any of these. Users appear only as Clerk user ids. URLs are stored as paths, without the
-- query string.
--
-- ACCESS: RLS on, no policies, every privilege revoked from anon and authenticated: only the service
-- role (the API) reads and writes them. The function is executable by service_role only.
--
-- Idempotent: running it twice is harmless.

-- ---------------------------------------------------------------------------------------------
-- 1. Alert state
-- ---------------------------------------------------------------------------------------------
create table if not exists public.alert_state (
  key           text         primary key,
  status        text         not null check (status in ('open', 'resolved')),
  title         text         not null,
  detail        text,
  opened_at     timestamptz  not null default now(),
  last_seen_at  timestamptz  not null default now(),
  last_sent_at  timestamptz,
  resolved_at   timestamptz,
  occurrences   integer      not null default 1
);
create index if not exists alert_state_status_idx on public.alert_state (status, last_seen_at desc);

-- ---------------------------------------------------------------------------------------------
-- 2. Request log
-- ---------------------------------------------------------------------------------------------
create table if not exists public.request_log (
  id            bigint       generated always as identity primary key,
  at            timestamptz  not null default now(),
  request_id    text,
  route         text         not null,
  method        text,
  status        smallint,
  latency_ms    integer,
  actor         text,
  access_level  text
);
create index if not exists request_log_at_idx on public.request_log (at desc);
create index if not exists request_log_5xx_idx on public.request_log (at desc) where status >= 500;

-- ---------------------------------------------------------------------------------------------
-- 3. Admin audit log (decision D5)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id            bigint       generated always as identity primary key,
  at            timestamptz  not null default now(),
  request_id    text,
  action        text         not null,
  actor_id      text,
  target        jsonb,
  changes       jsonb
);
create index if not exists admin_audit_log_at_idx on public.admin_audit_log (at desc);

-- ---------------------------------------------------------------------------------------------
-- 4. Error events, grouped
-- ---------------------------------------------------------------------------------------------
create table if not exists public.error_events (
  fingerprint    text         primary key,
  source         text         not null check (source in ('browser', 'api')),
  message        text         not null,
  stack          text,
  route          text,
  release        text,
  context        jsonb,
  first_seen_at  timestamptz  not null default now(),
  last_seen_at   timestamptz  not null default now(),
  occurrences    integer      not null default 1,
  last_actor     text
);
create index if not exists error_events_last_seen_idx on public.error_events (last_seen_at desc);
create index if not exists error_events_first_seen_idx on public.error_events (first_seen_at desc);

-- Returns the group's occurrence count after this one, or 0 when a NEW group was refused because 50
-- new groups already appeared in the past hour. Lengths are capped here as well as in the API.
create or replace function public.record_error_event(
  p_fingerprint text,
  p_source      text,
  p_message     text,
  p_stack       text,
  p_route       text,
  p_release     text,
  p_context     jsonb,
  p_actor       text
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.error_events
     set occurrences  = occurrences + 1,
         last_seen_at = now(),
         release      = coalesce(left(p_release, 40), release),
         last_actor   = coalesce(left(p_actor, 64), last_actor)
   where fingerprint = left(p_fingerprint, 64)
  returning occurrences into v_count;
  if found then
    return v_count;
  end if;

  if (select count(*) from public.error_events where first_seen_at > now() - interval '1 hour') >= 50 then
    return 0;
  end if;

  insert into public.error_events (fingerprint, source, message, stack, route, release, context, last_actor)
  values (left(p_fingerprint, 64), p_source, left(p_message, 500), left(p_stack, 4000), left(p_route, 200),
          left(p_release, 40), p_context, left(p_actor, 64))
  on conflict (fingerprint) do update
     set occurrences = public.error_events.occurrences + 1, last_seen_at = now()
  returning occurrences into v_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Access: service role only
-- ---------------------------------------------------------------------------------------------
alter table public.alert_state      enable row level security;
alter table public.request_log      enable row level security;
alter table public.admin_audit_log  enable row level security;
alter table public.error_events     enable row level security;

revoke all on public.alert_state      from anon, authenticated;
revoke all on public.request_log      from anon, authenticated;
revoke all on public.admin_audit_log  from anon, authenticated;
revoke all on public.error_events     from anon, authenticated;

revoke all on function public.record_error_event(text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_error_event(text, text, text, text, text, text, jsonb, text) to service_role;

-- VERIFY (expect: 4 tables, RLS on, 0 policies; anon and authenticated hold no privilege; the function
-- executable by service_role and not by anon):
--
--   select c.relname, c.relrowsecurity,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and c.relname in ('alert_state', 'request_log', 'admin_audit_log', 'error_events');
--
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and grantee in ('anon', 'authenticated')
--      and table_name in ('alert_state', 'request_log', 'admin_audit_log', 'error_events');   -- 0 rows
--
--   select has_function_privilege('anon', 'public.record_error_event(text,text,text,text,text,text,jsonb,text)', 'execute'),
--          has_function_privilege('service_role', 'public.record_error_event(text,text,text,text,text,text,jsonb,text)', 'execute');
--   -- false, true
--
-- ROLLBACK: 2026-11-24_observability_tables_rollback.sql (drops the four tables and the function; the
-- logs and error history in them are lost).
