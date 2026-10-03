# ADR-004: The demo runs the real resource code against generated 2035+ data

**Status:** Accepted · 2026-10-03 · Issue #158 · Decision D-8

## Context

The old demo was hard-coded sample arrays in a second React context (`DemoDataContext`) reusing
the same components. It drifted from the real data shapes, still triggered the real data provider
in the background, and its dates looked plausible (2024–2025), so a screenshot could be mistaken for
real output.

## Decision

`shared/demo/demoData.js` generates a deterministic dataset (seeded PRNG) and an in-memory
repository with the same interface as the real one. `shared/demo/demoApi.js` executes the **same
resource functions** that serve `GET /api/data/*` against it. The frontend's demo data source calls
`demoRequest(name, query)` exactly where the live source calls the endpoint.

- Every date is **2035 or later**; identifiers are `DEMO-…`; plant size and tariff are not the real
  ones. A test scans every API response for any date earlier than 2035 and for any real identifier.
- The generator runs the real uptime derivation, so demo uptime rows are produced by the production
  logic, not painted by hand.
- It deliberately contains each state the UI must render honestly: a measured-zero outage, a
  collection gap with no rows at all, a comms-lost day, a late start, a tariff change, grid trips,
  and an open bill period with the CEB side `null`.

## Consequences

- The demo cannot drift from the API's response shapes; a shape change breaks a test, not a screen.
- The demo needs no network, Supabase, Clerk or SolisCloud access.
- The dataset is regenerated on load (~70 ms); fine for a demo, worth memoising if it grows.
