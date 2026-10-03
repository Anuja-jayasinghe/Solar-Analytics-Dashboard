# ADR-005: Unknown is `null`; a missing day is not a zero; every figure states its basis

**Status:** Accepted · 2026-10-03 · Issues #163, #154 · Rule: `docs/WORKING_RULES.md` §1

## Context

Fabricated zeros have corrupted data in this project three times. The third was found during the
Solis reconciliation: twelve rows of `0.00` kWh and `0.00` kW peak, inserted in a single bulk
statement on 2025-11-23. Four were provably wrong (Solis recorded 52.1, 48.7, 154 and 172.4 kWh on
those days) and eight covered a period Solis has no record for. The bill period ending 2025-05-06
looked like a 1,300 kWh shortfall because of them. The v1 UI repeats the pattern at render time:
`|| 0` fallbacks make a failed fetch or an offline inverter display as `0 kW` / `LKR 0`.

## Decision

- **`null` means unavailable, `0` means measured zero**, end to end: database, shared functions,
  API JSON, CSV (an empty cell), UI.
- **A day with no row is missing, not zero.** Totals skip it; every aggregate returns
  `presentDays`, `daysInPeriod` and `completeness`. A bill variance is flagged `complete: false`
  when days are missing.
- **Evidence has three states** where it matters: alarms `null` (could not be fetched) vs `[]`
  (none occurred); logger `null` (unknown) vs `[]` (silent); uptime `null` (not knowable) vs `0`
  (measured total outage).
- **A figure that depends on a choice states the choice.** LKR carries its `basis` (`fixed`,
  `effective` or `mixed`) and `unratedDays`; revenue is never extrapolated over days with no
  applicable rate; settings that are missing stay `null` rather than defaulting (no guessed
  capacity, no guessed tariff).
- **Estimates are labelled and never enter a comparison.** Weather-derived or modelled values may
  explain, never compare (UI_REDESIGN_DIRECTION §7.2).
- A collector must not write `0` unless the source reports a measured `0`.

## Consequences

- Consumers must handle `null` everywhere; the UI needs explicit "No data" / "Awaiting bill" states.
- Some numbers that used to appear now do not (a lifetime "potential value" against partial
  bills); that is the point.
- The v1 widgets that fabricate zeros are removed at cutover rather than patched.
