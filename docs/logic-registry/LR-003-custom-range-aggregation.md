# LR-003: Custom Range Aggregation (inverter only)

Status: Specified, implemented in `shared/domain/rangeStats.js` (tests: `tests/rangeStats.test.js`)
Owner: Dashboard data pipeline
Primary files:
- shared/domain/rangeStats.js
- shared/domain/time.js

## Purpose

Given any date range chosen by the user, compute the outputs the Explore panel offers (total,
average, best/worst day, peak, LKR, specific yield, capacity factor, comparisons, series) from
`inverter_data_daily_summary` rows, **without inventing a single number**.

This is inverter-only (decision D-5). CEB bills cover a *billing period*, not an arbitrary range;
comparing a free range to a bill would require pro-rating, which fabricates data. The CEB
comparison remains bill-aligned (LR-001).

## Inputs

```
rows      [{ date: 'YYYY-MM-DD', kwh: number|null, peakKw: number|null }]
from, to  'YYYY-MM-DD' inclusive
capacityKwp   DC array size (41.76 for this plant; Solis stationDetail.capacity)
acRatedKw     inverter AC rating (40)
rate          see R6
```

## Canonical rules

### R1 — A missing day is unknown, not zero
A date in the range with no row, or a row whose `kwh` is `null`, is **missing**. It contributes
nothing to totals and counts toward no average. A row with `kwh = 0` is a **measured zero**: it
is included, and listed in `zeroDays` so the UI can flag it (the database has had false zeros).

### R2 — Completeness
`completeness = presentDays / daysInRange`. Every output carries it. Totals over an incomplete
range are *partial* and are labelled as such by the UI.

### R3 — Core figures
```
totalKwh       = Σ kwh over present days                      (null if none present)
avgPerDayKwh   = totalKwh / presentDays                       (null if none)
best / worst   = max / min kwh among present days, earliest date wins ties
peakKw         = max peakKw among days that have one          (null if none); peakKnownDays reported
```

### R4 — Yield figures
```
specificYield  = totalKwh / capacityKwp                       kWh per kWp
capacityFactor = totalKwh / (acRatedKw × 24 × presentDays)    0–1 (null if inputs invalid)
```
`capacityKwp` is the **DC array size** (41.76), not the 40 kW AC rating. They are different
numbers and mixing them silently inflates or deflates the figure.

### R5 — Series
One entry per calendar date in the range: `kwh` (or `null` if missing) and `cumulativeKwh`, the
running total of present days. A missing day does not change the cumulative value and is not
interpolated.

### R6 — Revenue (LKR) is only computed with a stated, applicable rate
```
rate = { mode: 'fixed', ratePerKwh }
     | { mode: 'effective', periods: [{ startDate, endDate, ratePerKwh }], fallbackRatePerKwh?: number }
```
- `fixed`: every present day uses the one rate (the Settings tariff). `basis = 'fixed'`.
- `effective`: a day uses the rate of the bill period containing it (rate = earnings ÷
  units_exported for that bill). A day in no period uses `fallbackRatePerKwh` if given, otherwise it
  is **unrated**. `basis = 'effective'`, or `'mixed'` if any day used the fallback.
- `revenue.lkr = Σ kwh × rate` over rated days; `null` if no day was rated.
- `ratedDays` and `unratedDays` are reported. Revenue is never extrapolated over unrated days.
- The UI must display the basis next to any LKR figure.

Bill periods follow LR-001: `end = bill_date`, `start = previous bill_date + 1 day`, fallback
`bill_date − 30 days`. A bill with `units_exported ≤ 0` yields no rate (division by zero is not a rate).

> Observed 2026-10-03: all 25 bills have an effective rate of exactly 37.00, equal to the Settings
> tariff, so both bases currently agree. The mechanism exists so that a future tariff change is
> handled correctly, not because one has happened.

### R7 — Comparisons
`compareRanges(current, baseline)` compares **averages per day**, so unequal numbers of present
days cannot masquerade as a trend:
```
deltaAvgKwh = current.avg − baseline.avg
deltaAvgPct = baseline.avg > 0 ? deltaAvgKwh / baseline.avg × 100 : null
```
`null` if either average is `null`. The totals are also reported, with both completeness values.
Baselines: `previousPeriod(from, to)` (same length, ending the day before `from`) and
`sameRangeLastYear(from, to)` (29 Feb folds to 28 Feb).

## Edge cases
- `from > to`, malformed dates, or a span over 3 660 days → `RangeError` (callers return 400).
- Duplicate rows for a date: the last one wins.
- Rows outside the range are ignored.
- Non-finite or negative `kwh` is treated as missing (a negative generation is a data error, not a number).

## Acceptance criteria
1. Totals/averages ignore missing days; completeness reflects them.
2. A measured zero is included and listed in `zeroDays`; a missing day is not.
3. No present days → `totalKwh`, `avgPerDayKwh`, best/worst, yields all `null`.
4. Best/worst tie-break to the earliest date.
5. `specificYield` uses `capacityKwp`; `capacityFactor` uses `acRatedKw`.
6. Cumulative series does not move on missing days and never interpolates.
7. Fixed-rate revenue = total × rate; effective-rate revenue picks the right bill period per day.
8. Unrated days are excluded and counted; revenue `null` when none are rated.
9. Comparison uses averages; baseline average 0 → pct `null`.
10. `previousPeriod` / `sameRangeLastYear` return the correct windows (incl. 29 Feb).
11. Invalid range → `RangeError`.

## Current implementation files
- shared/domain/rangeStats.js
- tests/rangeStats.test.js
