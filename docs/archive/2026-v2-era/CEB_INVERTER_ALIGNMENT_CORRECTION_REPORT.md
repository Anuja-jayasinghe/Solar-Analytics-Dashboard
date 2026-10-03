# CEB vs Inverter Monthly Alignment - Correction Report (Pre-Implementation)

Date: 2026-04-18  
Status: Implemented

## 1) Problem Statement

The current monthly comparison logic correctly applies a shifted mapping (bill month -> previous generation month), but it fails for months where the CEB bill is not yet available.

Example provided:
- Current time: April 2026
- Last entered CEB bill date: 2026-04-03
- Meaning: that bill corresponds to March generation period
- Expected chart behavior:
  - March: show CEB units from the 2026-04-03 bill vs inverter sum for exact bill period
  - April: show inverter generation only (no CEB bar/value yet)

## 2) Confirmed Expected Business Logic

### 2.1 Month-to-bill mapping
- January generation is represented by February bill
- February generation is represented by March bill
- ...
- December generation is represented by January bill of next year

### 2.2 When bill exists for a mapped month
- CEB value = bill.units_exported
- Period end = bill_date
- Period start = previous_bill_date + 1 day (if available)
- If previous bill is unavailable: fallback to bill_date - 30 days
- Inverter value = sum(total_generation_kwh) for all days in [startDate, endDate]

### 2.3 When bill does not yet exist for a mapped month (pending month)
- CEB value must be null (not 0)
- Inverter value must still be calculated for visible progress period
- For current active month:
  - start = max(monthStart, latestKnownBillDate + 1 day)
  - end = today
- For future months (after current month):
  - inverter = null
  - ceb = null
  - period = Pending

## 3) What Is Incorrect in Current Implementation

## 3.1 Inverter value is skipped when bill is missing
Location: src/contexts/DataContext.jsx (charts block)

Current pattern:
- inverter summation runs only inside if (bill)
- else branch sets period to Pending and leaves inverterTotal at 0

Impact:
- Current month (pending CEB bill) wrongly shows 0 inverter generation
- This directly conflicts with expected behavior for April-like scenarios

## 3.2 Missing cross-boundary daily data for bill periods
Location: src/contexts/DataContext.jsx (daily query range)

Current pattern:
- daily inverter rows are fetched only for selected year: YYYY-01-01 .. YYYY-12-31

Impact:
- Bill periods that cross year boundary can be partially summed
- January and December mapped periods are most exposed to undercount

## 3.3 CEB missing state is represented as 0 instead of null
Locations:
- src/contexts/DataContext.jsx
- src/components/dashboard/EnergyCharts.jsx

Impact:
- Semantically wrong: 0 means measured zero export, not pending bill
- UI cannot distinguish Pending vs true zero value

## 3.4 Tooltip and chart rendering assume both series always exist
Location: src/components/dashboard/EnergyCharts.jsx

Current pattern:
- tooltip references payload[0] and payload[1] directly

Impact:
- fragile for null/missing CEB values after correction
- requires defensive rendering for optional series

## 4) Code Areas Requiring Correction (Implementation Scope)

## 4.1 Data assembly (primary)
File: src/contexts/DataContext.jsx  
Section: fetchData('charts')

Required changes:
- decouple inverter period calculation from bill existence
- produce provisional inverter period for pending current month
- use null for missing CEB values
- expand daily fetch coverage to include boundary periods

## 4.2 Chart presentation (secondary)
File: src/components/dashboard/EnergyCharts.jsx

Required changes:
- render CEB safely when value is null
- keep inverter visible for pending current month
- update tooltip to conditionally show series values
- preserve month ordering and period label clarity

## 4.3 Optional visual policy decision
File: src/components/dashboard/EnergyCharts.jsx

Policy options:
- Option A: Hide missing CEB bar completely (preferred for semantic clarity)
- Option B: Show subtle placeholder style for pending CEB

Recommendation: Option A now, add placeholder later only if needed.

## 5) Proposed Corrected Algorithm (Implementation Blueprint)

For each displayed month M in selectedYear:

1. Resolve mapped bill B:
- B is bill where bill_date month = M + 1 month and year adjusted for Dec->Jan rollover

2. Resolve inverter window:
- If B exists:
  - end = B.bill_date
  - start = previousBill(B).bill_date + 1 day, else B.bill_date - 30 days
- Else if M is current month in selected year:
  - start = max(monthStart(M), latestBillDate + 1 day)
  - end = today
- Else if M is future month:
  - start = null, end = null
- Else (past month with missing bill/data gap):
  - start = monthStart(M), end = monthEnd(M)
  - mark quality flag = MissingCEBBill

3. Compute values:
- inverter = sum daily_generation_kwh over [start, end] when window exists, else null
- ceb = B.units_exported when B exists, else null

4. Emit row:
- month label
- period label
- inverter
- ceb
- status flag: Finalized | Provisional | Pending | MissingCEBBill

## 6) Acceptance Criteria for This Fix

1. April scenario works exactly as requested:
- March row uses CEB bill dated April 03 and exact bill period inverter sum
- April row shows inverter-only progress, CEB absent (null)

2. No regression in finalized historical months

3. Tooltip does not break when CEB is null

4. Year-boundary periods do not undercount inverter energy

5. Data semantics are explicit:
- null = pending/unavailable
- 0 = actual measured zero

## 7) Test Cases to Execute After Implementation

1. Current month pending CEB bill
2. Historical month with valid mapped bill
3. January mapped from February bill
4. December mapped from next January bill
5. Dataset with missing intermediate bill
6. Dataset with true CEB zero export

## 8) Decision Log

- This document captures approved logic direction before implementation.
- No production code has been modified yet.
