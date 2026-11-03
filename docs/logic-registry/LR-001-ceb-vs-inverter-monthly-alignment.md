# LR-001: CEB vs Inverter Monthly Alignment

Status: Implemented in the dashboard data path
Owner: Dashboard data pipeline
Primary files:
- shared/domain/alignment.js (`buildAlignedRows`, `openBillPeriod`)
- shared/data/resources.js (`comparison`, `bills`, `totals.openPeriod`)
- src/v3/overview/TotalsRow.jsx, src/v3/ceb/CebCompare.jsx

## Purpose
Compare monthly inverter generation against CEB exported units using billing-cycle alignment.

The key assumption is simple: a bill received in month N represents generation from month N-1.

This logic must support three visible states:
- finalized months, where both inverter and CEB values exist
- the open period, from the day after the latest bill to today, whose bill is not yet available
- later months, where neither side should be treated as finalized

Periods always run **bill date to bill date**, never by calendar month. The open period is no
exception: it starts the day after the latest bill, even when that is in an earlier month.

## Data sources

### Inverter data
- Table: `inverter_data_daily_summary`
- Fields used:
	- `summary_date`
	- `total_generation_kwh`

### CEB data
- Table: `ceb_data`
- Fields used:
	- `bill_date`
	- `units_exported`

## What this row represents
Each month row in the chart is a comparison record with these fields:
- `month`: display label such as `Mar`
- `period`: human-readable date range or `Pending`
- `inverter`: summed inverter generation for the matched period
- `ceb`: exported units from the matching bill, or `null` when unavailable
- `status`: `finalized`, `provisional`, `pending`, or `missing_bill`

## Canonical rules

1. Mapping rule:
- generationMonth = billMonth - 1 (with January rollover from next year)

2. Finalized month (bill exists):
- ceb = units_exported from mapped bill
- periodEnd = bill_date
- periodStart = previous_bill_date + 1 day
- fallback periodStart (no previous bill): bill_date - 30 days
- inverter = sum(daily_generation_kwh in [periodStart, periodEnd])

3. Open period (the next bill is not yet available):
- month = the month of the latest bill (that bill reports the month before; the next bill reports this one)
- ceb = null
- periodStart = latestBillDate + 1 day (no bill at all: the 1st of the current month)
- periodEnd = today
- inverter = sum(daily_generation_kwh in [periodStart, periodEnd])
- It is **not** clipped to the 1st of the current month. Until 2026-11 it was, so between the 1st and
  the next bill the dashboard showed "since 1 Nov" instead of "since 4 Oct", filed the period under
  the wrong month, and called the month before it `missing_bill`.
- The API returns it on its own as `totals.openPeriod`, so it is right across New Year (on 2 January
  it still starts in December, which a calendar-year view of the new year does not contain).

The v3 Overview presents this stored daily sum as a **provisional, up-to-now** total in both
“This billing period” and the open column of “CEB vs Inverter.” It adds the live reading
`todayKwh` only when the open period ends on the server's `todayKey` and the newest stored
daily summary (`totals.generation.lastDay`) is before today, or the loaded totals confirm no
stored daily rows. Both displays use the same rule. A pending totals response does not add
today's reading yet.
The displayed day count increases by one when that live reading is included. If today's
daily summary is already stored, it is not added again. If neither a stored sum nor a valid
live reading exists, the total remains `null`. Finalized bill periods, CEB values, variance,
and money-gap calculations do not use this provisional addition.

4. Months after the open period's month:
- inverter = null
- ceb = null
- period = `Pending` (this month or later) or `Awaiting bill` (a past month: bills have not arrived for
  more than one month, and the open period already holds its days)

4b. A past month with no bill (before the open period's month):
- ceb = null
- the days it counts are only those no bill period covers (bill periods and the open period run
  without a gap from the first bill's period start to today). In practice that is only months
  before the first bill; any later month shows `Covered by a later bill` and inverter = null.
- No day is ever counted in two rows.

5. Semantic value policy:
- null means unavailable/pending
- 0 means actual measured zero

## How it works technically

### Step 1: Expand the selected year into 12 rows
The selected year is turned into one row per calendar month.

### Step 2: Find the bill that belongs to each month row
For each month row, the bill is searched using the shifted month rule:
- March generation is matched to April bill data
- April generation is matched to May bill data
- December generation is matched to January bill data of the next year

### Step 3: Compute the exact period window
If a bill exists:
- end date is the bill date
- start date is the previous bill date plus one day
- if the previous bill is missing, fall back to 30 days before the bill date

If the month is the open period's month (the month of the latest bill, with no bill after it yet):
- start date is the latest bill date plus one day
- end date is today

### Step 4: Sum inverter generation for that window
The inverter value is the sum of all daily inverter rows whose `summary_date` falls within the computed period.

### Step 5: Assign the CEB value
- if the mapped bill exists, `ceb = units_exported`
- if the bill does not exist yet, `ceb = null`

### Step 6: Mark the row status
- `finalized`: bill exists and the comparison is complete
- `provisional`: the open period; its bill is not here yet
- `pending`: a month after the open period's month
- `missing_bill`: a month before the open period's month for which no bill was found

## Worked examples

### Example A: March 2026 with an April 3 bill
Given:
- today = 2026-04-18
- last CEB bill entered = 2026-04-03

Interpretation:
- the April 3 bill corresponds to March generation

Result:
- `month` = `Mar`
- `ceb` = `units_exported` from the April 3 bill
- `periodEnd` = `2026-04-03`
- `periodStart` = previous bill date + 1 day
- `inverter` = sum of daily inverter generation within that exact window
- `status` = `finalized`

### Example B: April 2026 before the May bill arrives
Given:
- today = 2026-04-18
- latest bill = 2026-04-03 (it reports March)

Result:
- `month` = `Apr` (the May bill will report it)
- `ceb` = `null`
- `periodStart` = `2026-04-04` (latest bill date + 1 day)
- `periodEnd` = today
- `inverter` = sum of daily inverter generation for that partial period
- `status` = `provisional`

### Example B2: 3 November 2026, before the November bill is uploaded
Given:
- today = 2026-11-03
- latest bill = 2026-10-03 (it reports September)

Result:
- `Oct`: `provisional`, `periodStart` = `2026-10-04`, `periodEnd` = `2026-11-03` (31 days).
  The tile reads "since 4 Oct", not "since 1 Nov".
- `Nov`: `pending`
- Once the bill dated 2026-11-03 is uploaded, `Oct` becomes `finalized` (4 Oct to 3 Nov) and `Nov`
  opens on 4 Nov.

### Example C: Future month, such as May 2026
Result:
- `month` = `May`
- `ceb` = `null`
- `inverter` = `null`
- `period` = `Pending`
- `status` = `pending`

## Technical formula summary

When a bill exists:
$$
	ext{Inverter}_{period} = \sum_{day \in [startDate, endDate]} \text{daily\_generation\_kWh}
$$

$$
	ext{CEB}_{period} = \text{units\_exported from mapped bill}
$$

For the open period:
$$
	ext{Inverter}_{current} = \sum_{day \in [periodStart, today]} \text{daily\_generation\_kWh}
$$

## Implementation checklist

Anyone rebuilding this logic should be able to follow these steps from this file alone:

1. Query inverter daily totals across a window that includes the selected year plus boundary months.
2. Query CEB bills in the same span.
3. Build 12 month rows.
4. Match each month to the shifted bill month.
5. Derive the exact period dates.
6. Sum inverter values over the derived period.
7. Return `null` for missing CEB data, not `0`.
8. Keep a status flag so the UI can distinguish finalized, provisional, pending, and missing-bill rows.

## Edge cases

### January rollover
January generation is matched to February bill data in the following year.

### Missing previous bill
If the bill exists but the previous bill is missing, use a 30-day fallback window.

### Open period without a bill
The inverter total should still appear, even if the bill has not arrived yet. It runs from the day
after the latest bill, however late the next bill is, and across New Year.

### Several months without a bill
One open period from the latest bill to today; the months between show `Awaiting bill` with no
figure of their own.

### True zero export
Use `0` only when the bill explicitly reports zero exported units.

### No bill for a past month
Mark the row as `missing_bill` rather than pretending the value is zero. If a later bill's period
already covers its days, it carries no figure (`Covered by a later bill`), so nothing is counted twice.

## Acceptance criteria

1. March 2026 maps to the April 3 bill and shows a finalized comparison.
2. April 2026 shows inverter-only progress from 4 April until the May bill arrives.
3. Months after the open period remain pending.
3b. On 3 November 2026 with the latest bill dated 3 October, the open period is October, 4 Oct to 3 Nov.
3c. On 2 January the open period still starts the day after the December bill.
3d. No day is counted in two rows.
4. The chart does not break when `ceb` is `null`.
5. The logic can be implemented from this file without reading source code first.

## Current implementation files
- [shared/domain/alignment.js](../../shared/domain/alignment.js): `buildAlignedRows`, `openBillPeriod`
- [shared/data/resources.js](../../shared/data/resources.js): `comparison`, `bills`, `totals.openPeriod`
- [src/v3/overview/TotalsRow.jsx](../../src/v3/overview/TotalsRow.jsx), [src/v3/ceb/CebCompare.jsx](../../src/v3/ceb/CebCompare.jsx)
- Tests: [tests/alignment.test.js](../../tests/alignment.test.js)
