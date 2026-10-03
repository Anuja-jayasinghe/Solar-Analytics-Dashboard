-- 2026-09-24_revoke_anon_bill_access.sql
--
-- Close the CEB bill pipeline to the public `anon` role.
--
-- WHY
-- The browser used to read `ceb_bill_ingestions` / `ceb_bill_extractions` and to sign download
-- links for the private `ceb_bills` bucket directly, using the public anon key. That required
-- `anon` SELECT on both tables and on the bucket (see 2026-04-23_ceb_bill_ingestions_anon_mode_policies.sql).
-- The anon key ships in the JS bundle, so anyone could list and download every bill PDF — each
-- carries the account holder's name, address, phone number and account number.
-- 2026-09-12_revoke_anon_writes.sql dropped some of those policies but not the SELECT policies
-- and not the storage-object policies.
--
-- The application no longer needs any of it: the review queue is served by
-- GET /api/ceb-bills/ingestions?view=queue and preview links by POST /api/ceb-bills/signed-url,
-- both admin-authenticated and using the service-role key (which bypasses RLS).
--
-- ORDER OF OPERATIONS — IMPORTANT
-- Deploy the application version that contains those two endpoints FIRST. Running this against
-- an older deployment breaks the admin review queue and PDF preview until the new code is live.
--
-- This drops policies by what they DO rather than by name, because the live project has been
-- edited by hand and the names in the repository may not match it. Every dropped policy is
-- reported with RAISE NOTICE so the run leaves a record.
--
-- Safe to run more than once.
--
-- VERIFY AFTERWARDS
--   select schemaname, tablename, policyname, cmd, roles
--   from pg_policies
--   where roles && array['anon','public']::name[]
--     and (schemaname = 'storage'
--          or tablename in ('ceb_bill_ingestions','ceb_bill_extractions'));
-- Expect zero rows. (`public` in `roles` means "every role", which includes anon.)

begin;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where roles && array['anon', 'public']::name[]
      and (
        (schemaname = 'public'
          and tablename in ('ceb_bill_ingestions', 'ceb_bill_extractions'))
        or
        (schemaname = 'storage'
          and tablename = 'objects'
          and (coalesce(qual, '') like '%ceb_bills%'
               or coalesce(with_check, '') like '%ceb_bills%'))
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice 'dropped policy % on %.%', p.policyname, p.schemaname, p.tablename;
  end loop;
end
$$;

-- With no policy left, RLS denies anon entirely. Make sure RLS is actually on: a table with RLS
-- disabled is open to everyone regardless of policies.
alter table public.ceb_bill_ingestions enable row level security;
alter table public.ceb_bill_extractions enable row level security;

commit;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Restores the anon-mode policies from 2026-04-23_ceb_bill_ingestions_anon_mode_policies.sql.
-- Only do this if the admin review queue or PDF preview must work against an older deployment,
-- and treat it as temporary: it re-opens every bill PDF to anyone holding the anon key.
--
--   \i scripts/sql/2026-04-23_ceb_bill_ingestions_anon_mode_policies.sql
