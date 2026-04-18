# LR-001: CEB vs Inverter Monthly Alignment

Status: Implemented in the dashboard data path
Owner: Dashboard data pipeline
Primary files:
- src/lib/dataService.js
- src/contexts/DataContext.jsx
- src/components/dashboard/EnergyCharts.jsx

## Purpose
Compare monthly inverter generation against CEB exported units using billing-cycle alignment.

The key assumption is simple: a bill received in month N represents generation from month N-1.

This logic must support three visible states:
- finalized months, where both inverter and CEB values exist
- the current month, where inverter data is partial but the bill is not yet available
- future months, where neither side should be treated as finalized

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

3. Pending current month (bill not yet available):
- ceb = null
- periodStart = max(currentMonthStart, latestKnownBillDate + 1 day)
- periodEnd = today
- inverter = sum(daily_generation_kwh in [periodStart, periodEnd])

4. Future months:
- inverter = null
- ceb = null
- period = Pending

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

If the current month has no bill yet:
- start date is the later of:
	- the first day of the month
	- the latest known bill date plus one day
- end date is today

### Step 4: Sum inverter generation for that window
The inverter value is the sum of all daily inverter rows whose `summary_date` falls within the computed period.

### Step 5: Assign the CEB value
- if the mapped bill exists, `ceb = units_exported`
- if the bill does not exist yet, `ceb = null`

### Step 6: Mark the row status
- `finalized`: bill exists and the comparison is complete
- `provisional`: current month has inverter data, but the bill is not here yet
- `pending`: future month
- `missing_bill`: a past month where no bill was found

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

### Example B: April 2026 before the April bill arrives
Given:
- today = 2026-04-18
- no April bill has been received yet

Result:
- `month` = `Apr`
- `ceb` = `null`
- `periodStart` = later of April 1, 2026 or latest bill date + 1 day
- `periodEnd` = today
- `inverter` = sum of daily inverter generation for that partial period
- `status` = `provisional`

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

When the current bill is missing:
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

### Current month without a bill
The inverter total should still appear, even if the bill has not arrived yet.

### True zero export
Use `0` only when the bill explicitly reports zero exported units.

### No bill for a past month
Mark the row as `missing_bill` rather than pretending the value is zero.

## Acceptance criteria

1. March 2026 maps to the April 3 bill and shows a finalized comparison.
2. April 2026 shows inverter-only progress until the bill arrives.
3. Future months remain pending.
4. The chart does not break when `ceb` is `null`.
5. The logic can be implemented from this file without reading source code first.

## Current implementation files
- [src/lib/dataService.js](../../src/lib/dataService.js)
- [src/contexts/DataContext.jsx](../../src/contexts/DataContext.jsx)
- [src/components/dashboard/EnergyCharts.jsx](../../src/components/dashboard/EnergyCharts.jsx)
