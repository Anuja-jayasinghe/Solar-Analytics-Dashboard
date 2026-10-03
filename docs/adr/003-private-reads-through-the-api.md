# ADR-003: Real data is private; the browser reads through an authenticated API

**Status:** Accepted · 2026-10-03 · Issues #155, #157, #158 · Staged: see "Staging"

## Context

`VITE_SUPABASE_ANON_KEY` ships in the browser bundle, and RLS grants `anon` `SELECT` on the real
tables, so **anyone who opens the site can read all inverter and billing data**. The dashboard's
"real vs demo" gate was client-side only; `DataProvider` fetched real data for every visitor
before any gate ran. A read-only check also found `anon` held table-level `INSERT/UPDATE/DELETE/
TRUNCATE` privileges, blocked only by RLS.

## Decision (D-2, D-3)

- Real data is private. The browser reads only through `GET /api/data/*`, authenticated with a
  Clerk token and authorised at **viewer** level or above; the API uses the service-role key
  server-side.
- Access levels come from Clerk `publicMetadata`: `admin`, invited read-only `viewer`, and
  everyone else gets the demo. Authorisation is enforced server-side only; client checks are a
  convenience.
- New tables are created private from day one (RLS on, no policies, privileges revoked).
- Write-class privileges were revoked from `anon`/`authenticated` immediately (migration
  `v3_harden_public_role_privileges`), so RLS is the second wall, not the only one.

## Staging (deliberate, tracked)

`anon` keeps `SELECT` on the existing real tables until the v3 frontend replaces v1, because v1 reads
them with the anon key. Revoking it earlier would break the live site. The revoke ships with the
cutover (deferred item V3-D1, issue #155).

## Consequences

- Closes the public-read hole at cutover and removes the need for an unauthenticated Edge Function
  for live power (`/api/data/live` replaces it).
- Every dashboard view now costs a function invocation instead of a direct database read; mitigated
  by a 30 s private cache header, a 60 s in-memory live cache and a per-user rate limit.
- The serverless function budget is tight: `/api/data/[resource]` is function 11 of 12 on the
  Hobby plan.
- Until cutover, real data remains publicly readable. This is a known, tracked exposure.
