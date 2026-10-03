# ADR-002: Domain logic lives in dependency-free `shared/` modules

**Status:** Accepted · 2026-10-03 · Issue #154

## Context

The business rules (bill-period alignment, uptime, range aggregation, access levels) were written
inside React components and `src/lib`, tied to `supabaseClient` and to local `Date` behaviour.
Two consequences were observed:

- The LR-001 alignment function returns different answers depending on the machine's timezone
  (right in a Colombo browser, subtly wrong on Vercel's UTC servers). It also returned `0` for a
  window with no data, which reads as a measured zero.
- Nothing numerical could be reused by the collector, the API and the browser, so the same figure
  could be computed three ways.

## Decision

All domain logic is written as **pure functions in `shared/`** with no I/O, no clock reads, no
environment access and no dependencies, importing only each other:

```
shared/domain/   time, solisNormalize, uptime, rangeStats, alignment, telemetryPipeline,
                 freshness, access
shared/data/     resource functions (range, comparison, bills, uptime, …), query validation, csv
shared/demo/     deterministic demo dataset
```

Callers own the clock (`todayKey`, `now` are parameters) and the I/O (repositories are injected).
Dates are `'YYYY-MM-DD'` strings; instants are epoch milliseconds. A spec in
`docs/logic-registry/` comes first, then the acceptance tests, then the code.

## Consequences

- One implementation runs in the browser, the Vercel API and GitHub Actions; a number cannot
  differ between them.
- Tests need no browser, network or database: 300+ run in about a second. A test spawns Node under
  four `TZ` values to prove timezone independence.
- The v1 `src/lib/dataService.js` implementation stays until cutover; `tests/alignment.test.js`
  checks the new one against it.
- Cost: a second, parallel implementation of LR-001 exists until v1 is removed.
