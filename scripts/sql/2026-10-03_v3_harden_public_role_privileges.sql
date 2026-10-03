-- v3 / P1 — defence in depth: strip write-class privileges from the public roles.
--
-- Issue #155. Found 2026-10-03 (read-only check): `anon` holds INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES and TRIGGER on the real tables. Writes are currently blocked ONLY by row level
-- security (there is a SELECT policy and no write policy). That is a single point of failure:
-- one mistaken `create policy ... for all` would expose every table to the public anon key that
-- ships in the browser bundle.
--
-- This removes the privileges so that RLS is the second wall, not the only one.
--
-- WHAT IT DOES NOT CHANGE: SELECT stays for anon/authenticated. The running v1 dashboard reads
-- with the anon key until cutover (deferred item V3-D1, issue #155). Revoking SELECT on the real
-- tables is part of the cutover, not this migration.
--
-- SAFE FOR EXISTING FLOWS: every write already goes through the service_role key (API functions,
-- GitHub Actions), which is unaffected by these revokes.
--
-- Apply after a DB Snapshot. Rollback: re-grant what you need, e.g.
--   grant insert, update, delete on public.<table> to anon;   (not recommended)

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

revoke usage, update on all sequences in schema public from anon, authenticated;

-- New tables created later by the migration role must not get the broad default grants back.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public
  revoke usage, update on sequences from anon, authenticated;
