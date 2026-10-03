# ADR-001: Derive uptime from SolisCloud `inverterDay`, not our own polling

**Status:** Accepted · 2026-10-03 · Issue #153, #156 · Spec: LR-002

## Context

The owner wants a log of when the inverter was producing and when it was not. The obvious source
was `inverter_data_live`, which our GitHub Actions job fills every five minutes. Checked against
the live database, it holds **59 rows, about four per day**. GitHub cron drifts and skips runs, the
job only runs 05:00–19:55, it stores a handful of fields, and the summary job prunes it after 14
days. It cannot support an uptime claim.

SolisCloud's `inverterDay` returns **every logger upload for a day** (a point every 5 minutes at
present, 129 fields per point) and reaches back **at least two years** (probed: a day in Oct 2024
returned 148 points). `alarmList` gives exact start and end of every grid trip and fault, and
`collector/day` gives logger heartbeats.

## Decision

A nightly job pulls the last 7 completed days of `inverterDay`, `collector/day` and `alarmList`
and stores them in private tables; uptime is derived from them by `shared/domain/uptime.js`. A
gated backfill loads the full history. `inverter_data_live` stays as the "right now" feed only.

## Consequences

- The whole life of the inverter (from 2024-08-02) can be reconstructed, not just the future.
- Cadence has varied (1, 5 and 18 minutes over time), so detection is cadence-aware and each day
  records the resolution it could resolve (LR-002 R2); a coarse day is never read as proof of
  continuity.
- Night produces no points at all, so downtime is measured only inside a sunrise+30 / sunset−30
  window (R1).
- Grid under-voltage trips leave **no gap** in the points (one sample with zero power); alarms
  are the authoritative record of them, so the alarm fetch is mandatory and paginated
  (`total` 199 vs 100 per page at the time of the probe).
- **Not every alarm is downtime.** The first full backfill scored days with 140+ kWh as 0% uptime because
  alarm `1D4C2` "Loss of internet connection" (the logger's cloud link, not the inverter) had been
  treated as a trip. Comms alarms now only classify gaps as `comms_lost`; grid alarms (`1011`,
  `1015`, `101A`) are the trips. This is why the derived tables are regenerable from stored facts
  (`scripts/rederive_uptime.mjs`) rather than computed once and trusted.
- We depend on SolisCloud's history retention, which is undocumented. If it shrinks, older days
  can no longer be reconstructed; the stored copy then becomes the only record. This is the
  reason to run the backfill once, early.
- ~115k telemetry rows for two years, a few tens of MB; storage is not a constraint (database is
  16 MB today).

## Alternatives rejected

- **Fix the live poller** (more frequent, longer retention): still depends on GitHub Actions
  scheduling, still a sample of the cloud's last value rather than a log, and cannot recover the
  past.
- **Store raw JSON for every point**: 129 fields × 115k rows is hundreds of MB for data the
  source already retains.
