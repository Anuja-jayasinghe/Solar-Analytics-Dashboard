# LR-002: Inverter Uptime and Interruptions

Status: Specified, implemented in `shared/domain/uptime.js` (tests: `tests/uptime.test.js`)
Owner: Inverter telemetry pipeline
Primary files:
- shared/domain/uptime.js
- shared/domain/time.js
- shared/domain/solisNormalize.js

Evidence base: `docs/SOLIS_API_FIELD_CATALOG.md` (findings F3–F8, F12, F15), from live read-only
probes on 2026-10-03.

## Purpose

State, for any day or range, **when the inverter was and was not delivering power during the
hours it should have been**, and *why* when that is knowable — without ever presenting a guess
as a measurement.

## Data sources

| Source | Endpoint | Used for |
|---|---|---|
| Telemetry points | `inverterDay` | proof of life: one point per logger upload |
| Alarms | `alarmList` (paginated) | exact start/end of grid trips and faults |
| Logger points | `collector/day` | whether the *logger* was reporting during a gap |

## What the data actually looks like (verified, do not assume otherwise)

1. **Night has no points.** The inverter sleeps; the logger sends nothing. Night is *absent*, not
   `state = 2`. Points span ≈ 05:56–18:48 local.
2. **Cadence varies by period**: ~1 min (Jul 2026), 5 min (now), ~18 min (Oct 2025).
3. **A grid under-voltage trip (code 1011, "UN-G-V01") is one sample with `pac = 0` and
   `uAc1 ≈ 190–215 V`.** `state` stays `1` and **there is no gap**. Alarms are the only record
   of exactly when it began and ended, so alarms are authoritative for trips.
4. **Alarm `1D4C2` "Loss of internet connection" is a LOGGER alarm, not inverter downtime.** It marks the
   logger's cloud link being down, not the inverter stopping. Found by backfilling two years: every
   "zero-uptime" day that still produced energy (e.g. 2026-06-03, 142 kWh) was covered by one. The
   inverter kept generating; the logger uploaded the buffered points later, at a coarse cadence. Real
   outages are grid alarms (`1011` under-voltage, `1015` NO-Grid, `101A` phase fault). A power cut
   can raise both at once (router and grid down together), which is why a comms alarm alone never
   decides; grid alarms and missing production do.
5. **A gap in points** means the inverter stopped *or* the logger/WiFi/cloud did. Only logger
   evidence separates the two.
6. `dataTimestamp` is epoch ms and is the only trustworthy clock. `timeStr` is UTC+8.

## Canonical rules

### R1 — Operating window
The window for a local day D (Asia/Colombo) is
`[sunrise(D) + 30 min, sunset(D) − 30 min]` for the site (7.0713 N, 80.0088 E).
Everything is measured inside the window. Outside it nothing is ever "down".
The 30-minute margins exist because output at the edges is negligible and a late start on a dull
morning is indistinguishable from an outage.

### R2 — Cadence and detection threshold
`cadence` = median gap between consecutive in-window points (clamped to 1–30 min).
`gapThreshold = max(3 × cadence, 10 min)`.
A day stores both, so a result on a coarse day is never read as proof of continuity:
`resolutionMin = gapThreshold`.

### R3 — Segments
The day is analysed over the window. `segments` lists every **non-producing** stretch; whatever is not listed is `producing`. Each segment has a `kind`:

| kind | Meaning | Counts as down? |
|---|---|---|
| `producing` | covered by points no more than `gapThreshold` apart | no |
| `trip` | an alarm interval (clipped to the window) | **yes** |
| `gap` | no points for > threshold, and the logger **was** reporting (or no logger data available) | **yes** |
| `comms_lost` | no points for > threshold and the logger was **not** reporting either | **unknown**: excluded |
| `edge_gap` | window start→first point, or last point→window end, longer than the threshold, with no alarm | **unknown**: excluded |

- Logger evidence for a gap is taken from its **interior**: a heartbeat within one cadence of either end is the stop or the recovery, not proof the logger stayed up (found while building the demo dataset). A piece too short to have an interior (≤ 2 cadences) uses its whole length.
- A `gap` or `edge_gap` is reduced by one cadence at its start: the next sample was *due* one
  cadence after the previous one, so only the remainder is evidence of a stop.
- If a trip overlaps a gap, the overlap is a `trip` (the cause is known).
- **Alarms have two classes.** *Comms alarms* (`1D4C2`) are **not trips**: they create no segment of their own
  and cannot make a day look down. They are *evidence for classifying a gap*: a silent stretch that overlaps
  one is `comms_lost`, exactly like a silent logger. Every other alarm is a *trip* candidate.
  If points cover a comms alarm's interval (buffered data), the inverter is shown up, because points are
  positive evidence of operation however late they arrived.
- Overlapping trip alarms are merged (union), never double-counted.
- A `trip` has `cause` = `grid_undervoltage` (1011), `grid_overvoltage` (1010), or
  `fault` (anything else), plus the raw `alarmCode`.
- An alarm with `state = 0` (pending / ongoing) has no end: its end is `min(now, windowEnd)`.

### R4 — Day figures
```
unknown   = comms_lost + edge_gap
known     = windowMinutes − unknown
down      = trip + gap
uptimePct = known > 0 ? (known − down) / known × 100 : null
```
`null` ≠ `0`. A day with **no points and no logger evidence** is `status = 'no_data'`,
`uptimePct = null`. A day with **no inverter points but a reporting logger** is
`status = 'down'`, `uptimePct = 0` — that zero is measured.

### R5 — Range aggregation
Ranges weight each day by its `known` minutes (not a mean of percentages). Days with
`status = 'no_data'` are excluded from the weighting and counted separately as `daysNoData`.

### R6 — Interruption counts
`tripCount` and `gapCount` are reported alongside minutes. For this plant the headline metric is
the number of grid under-voltage trips, since a 5-minute trip costs little energy but recurs
(199 alarms in ~3 months on the probe date).

## Things this spec deliberately does NOT claim

- It does not estimate lost energy or lost revenue. That is a modelled figure and, when added,
  must be labelled as an estimate and kept out of every comparison figure.
- It does not distinguish cloud-induced zero output from an outage; only alarms and gaps count.
- It does not read `state`: it was `1` in every sampled point, including during trips.

## Worked example (real data, 2026-10-02)

Window ≈ 06:25–17:28 (≈ 663 min). Cadence 5 min → threshold 15 min. 146 points, no gap.
Four 1011 alarms that day; the 05:54–05:59 one lies before the window opens and the 06:24–06:29 one is
clipped to ≈ 2 min. Result: trips of ≈ 2, 5 and 10 min (`trip ≈ 17.3`, `gap = 0`, `unknown = 0`),
`uptimePct ≈ 97.4 %`, `tripCount = 3`, all `grid_undervoltage`. (Verified by replaying the real day,
`tests/fixtures/solis/day-2026-10-02.json`.)

A second real day, 2026-04-06, had five silent stretches of 12–19 min and **no alarms** → five `gap`s,
72 min, `uptimePct ≈ 89.3 %`. With no logger data for that day they carry `loggerEvidence = false`: they
may be inverter stops or logger/cloud drop-outs, and the result says so rather than choosing.

## Edge cases

- **No alarms returned because the API failed** vs **no alarms occurred**: the caller passes
  `alarms: null` for "unknown" and `[]` for "none". With `null`, trips are not asserted and the
  result carries `alarmsKnown = false`.
- Point timestamps duplicated: deduplicated before analysis.
- Points outside the window are ignored for gap analysis but still count toward `pointCount`.
- Cadence cannot be computed (fewer than 3 in-window points): cadence defaults to 5 min and the
  day carries `lowConfidence = true`.
- Daylight saving does not apply (Sri Lanka, UTC+5:30 all year).

## Acceptance criteria

1. A day with continuous points and no alarms → `uptimePct = 100`, no segments but `producing`.
2. A 40-minute interior gap with a reporting logger → one `gap` of (40 − cadence) min.
3. The same gap with no logger points inside it → `comms_lost`, excluded from the percentage. A lone heartbeat within one cadence of the recovery does not change that.
4. A 5-minute 1011 alarm with no gap → one `trip` of 5 min, `cause = grid_undervoltage`.
5. A late start (first point 90 min after window start), no alarm → `edge_gap`, not down.
6. Two overlapping alarms → counted once.
7. No points, no logger → `no_data`, `uptimePct = null` (never 0).
8. No points, logger reporting → `down`, `uptimePct = 0`.
9. `alarms = null` → `alarmsKnown = false`, no trips.
10. Night points (outside the window) never create segments.
11. Range aggregation weights by known minutes and skips `no_data` days.
12a. A comms alarm (`1D4C2`) over a day with continuous points → no segment, `uptimePct = 100` (the 2026-06-03 shape).
12b. A gap overlapping a comms alarm, with logger evidence unknown → `comms_lost`, not `gap`.
12c. A gap overlapping both a comms alarm and a grid alarm → the grid alarm wins (`trip`): a power cut is real downtime.
12. The 2025-10-03 coarse-cadence day reports `resolutionMin ≈ 52` (≈ 3 × 17 min) and `lowConfidence = false`.

## Current implementation files
- shared/domain/uptime.js
- shared/domain/time.js
- shared/domain/solisNormalize.js
- tests/uptime.test.js, tests/solisNormalize.test.js, tests/time.test.js
