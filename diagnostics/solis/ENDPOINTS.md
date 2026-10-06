# Endpoint verification matrix

The paths below use the user-auth API at `https://www.soliscloud.com:13333`.
All are documented as `POST` requests. "Live" below means HTTP 200 and Solis
API code 0 using this account's working signer on 2026-10-06. The listed
record counts are for the particular date or range requested, not inventory
totals unless stated. See `FINDINGS-2026-10-06.md` for tested contract conflicts.

| Path suffix under `/v1/api/` | Purpose and fields to validate | Evidence status | Priority |
| --- | --- | --- | --- |
| `inverterList` | Confirm one target inverter; `id`, `sn`, `productModel`, `stationId`, `collectorSn`, `dcInputType`, `state`, `dataTimestamp`. | Live: one inverter. | First |
| `inverterDetail` | Confirm model and latest state; `iPv*`, `uPv*`, AC phases, `pac`, frequency, temperature, power limit, firmware, energy counters. | Live: S5-GC40K, current counter and electrical fields. | First |
| `inverterDay` | Time series of PV voltage/current, AC power, temperature, grid values, limits, state, and energy. Validate channel count and sample cadence. | Live: 147 records on October 5; channels 1–8 populated despite vendor listing 1–4. Selected historical days tested. | First |
| `inverterMonth` | Daily energy totals and units to reconcile day telemetry and stored summaries. | Live: six records for October 1–6; April 2025 had only 22 dates. | High |
| `inverterYear` | Monthly energy totals for longer-term comparison. | Live: ten 2026 monthly records on October 6; April 2025 monthly gap checked. | Medium |
| `inverterAll` | Annual energy rollups and lifetime-counter cross-check. | Live on retry: three annual records; first call timed out. Annual sum differs from current counter, mainly due to April 2025 missing daily archive. | Medium |
| `alarmList` | Alarm code, severity, start/end, state, advice, pagination, and overlap with low-output periods. | Live: 105 distinct July–October alarms over two pages using `pageNo`; documented `minId` did not advance. | High |
| `collectorList` | Identify the attached logger and current state. | Live: one logger. | Medium |
| `collectorDetail` | Upload interval, logger state and signal metadata. | Live: detail response received. | High |
| `collector/day` | Logger signal series and communication gaps at selected timestamps. | Live: 292 signal records on October 5; targeted April 11 and June 6 checks. | High |
| `userStationList` | Verify one plant, plant ID, name, capacity and timezone. | Live: one plant. | High |
| `stationDetail` | Plant capacity and metadata cross-check. | Live: 41.76 kWp capacity. | High |
| `stationDay` | Independent plant-level time-series cross-check if inverter data disagree. | Not tested in this investigation; no station/inverter conflict required it. | Conditional |
| `stationMonth`, `stationYear`, `stationAll` | Plant-level energy cross-check against inverter rollups. | Live: April 2025 plant month also has 22 dates and omits April 14–21; year and all endpoints agree at 3,178.7 kWh for April and 45,329.2 kWh for 2025. | Conditional |
| `epmList`, `weatherList`, `ammeterList` | Check whether power management, irradiance/weather or meter hardware exists. | Live: zero devices in each list. | One-time check |

## Contract checks for each tested endpoint

1. Record request shape, API `success`/`code`, HTTP status, and response shape without secrets or personal data.
2. Check required parameters against the vendor page and reject unexpected empty results.
3. Record field presence, type, unit, scale, timestamp meaning, and null/zero behavior.
4. For lists, compare documented `minId` cursor pagination with observed behavior; do not infer a total from one page.
5. For `inverterDay`, compare raw PV channels with `shared/domain/solisNormalize.js`, stored telemetry, and Pro for identical instants.
6. Mark each claim `confirmed`, `documentation incomplete`, `documentation conflict`, `not available on this account`, or `unverified` with a dated example.

## Physical configuration still required

The model is confirmed as S5-GC40K. Still needed: panel model; module count in each string;
occupied DC inputs; input-to-MPPT pairing; orientation, tilt, and known shading per string;
and the as-built wiring/string schedule. The owner does not have that schedule.
Until these are known, comparisons across all eight positions are exploratory only.
