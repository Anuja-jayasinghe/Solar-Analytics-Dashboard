-- 2026-09-12: Revoke anonymous write access
--
-- Audit findings S1 / S1a / S2 — see docs/PROJECT_AUDIT_2026-09.md
--
-- ============================================================================
-- WHY
-- ============================================================================
-- `ceb_data` and `system_settings` granted INSERT and UPDATE to `anon` with
-- `USING (true)` / `WITH CHECK (true)` — no restriction whatsoever. The anon key is public
-- by design: it ships in VITE_SUPABASE_ANON_KEY, compiled into the browser bundle. So any
-- visitor could change `rate_per_kwh` (every earnings figure on the dashboard derives from
-- it) or insert and overwrite rows in the canonical billing table.
--
-- `admin_users` was worse: SELECT, INSERT and DELETE all granted to `public` with
-- `USING (true)`, exposing admin email addresses and allowing anyone to add or remove rows.
--
-- Those policies existed because the admin screens wrote to Supabase directly from the
-- browser. They no longer do — every write now goes through an admin-authenticated API
-- endpoint using the service-role key, which bypasses RLS entirely.
--
-- ============================================================================
-- ⚠️  ORDERING — RUN THIS *AFTER* THE NEW CODE IS DEPLOYED
-- ============================================================================
-- The currently-deployed frontend still writes client-side. Applying this before the
-- deploy lands breaks bill approval and the settings page. Sequence:
--
--   1. Merge the PR  2. Wait for the Vercel deploy  3. Run this  4. Smoke-test admin writes
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- At the bottom of this file.

begin;

-- ---------------------------------------------------------------- ceb_data
-- Public dashboard: reads stay open, writes go to the service role only.
drop policy if exists ceb_data_anon_upsert on public.ceb_data;
drop policy if exists ceb_data_anon_update on public.ceb_data;
-- ceb_data_anon_select is deliberately kept: the dashboard is public.

-- ---------------------------------------------------------------- system_settings
drop policy if exists system_settings_anon_insert on public.system_settings;
drop policy if exists system_settings_anon_update on public.system_settings;
-- system_settings_anon_select is deliberately kept: the client reads tariff and capacity
-- to render the dashboard.

-- ---------------------------------------------------------------- ceb_bill_* staging tables
-- Approval now updates these server-side. Anything still granting anon write is removed;
-- the admin UI reads them through the API or with an anon SELECT.
drop policy if exists ceb_bill_ingestions_insert_anon on public.ceb_bill_ingestions;
drop policy if exists ceb_bill_extractions_anon_update on public.ceb_bill_extractions;
drop policy if exists ceb_bill_ingestions_anon_update on public.ceb_bill_ingestions;

-- ---------------------------------------------------------------- admin_users
-- No legitimate anonymous access. Live authorization reads Clerk publicMetadata, not this
-- table; its only reader is src/lib/auth/SupabaseAuthAdapter.js, the pre-Clerk path, which
-- is dead while VITE_USE_CLERK_AUTH is enabled.
--
-- If that legacy path is ever revived, restore a SELECT policy scoped to `authenticated`
-- rather than re-opening it to `public`.
drop policy if exists "Allow select for all"  on public.admin_users;
drop policy if exists "Allow insert for all"  on public.admin_users;
drop policy if exists "Allow admin deletion"  on public.admin_users;

commit;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Expect: only SELECT policies remain on ceb_data and system_settings,
--         and zero policies on admin_users.
--
--   select tablename, policyname, cmd, roles::text
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('ceb_data','system_settings','admin_users',
--                       'ceb_bill_ingestions','ceb_bill_extractions')
--   order by tablename, cmd;

-- ============================================================================
-- ROLLBACK (restores the previous, permissive state)
-- ============================================================================
-- begin;
--   create policy ceb_data_anon_upsert on public.ceb_data
--     for insert to anon, authenticated with check (true);
--   create policy ceb_data_anon_update on public.ceb_data
--     for update to anon, authenticated using (true) with check (true);
--   create policy system_settings_anon_insert on public.system_settings
--     for insert to anon, authenticated with check (true);
--   create policy system_settings_anon_update on public.system_settings
--     for update to anon, authenticated using (true) with check (true);
--   create policy "Allow select for all" on public.admin_users
--     for select to public using (true);
--   create policy "Allow insert for all" on public.admin_users
--     for insert to public with check (true);
--   create policy "Allow admin deletion" on public.admin_users
--     for delete to public using (true);
-- commit;
