# Project Logic Registry

Purpose:
- Single source of truth for verified business logic used in this project.
- Only approved and documented logic is added here.
- Unverified logic must not be added yet.

Date initialized: 2026-04-18

## Entry LR-001: CEB vs Inverter Monthly Alignment

Status: Implemented in the dashboard data path
Owner: Dashboard data pipeline
Primary files:
- src/contexts/DataContext.jsx
- src/components/dashboard/EnergyCharts.jsx
- src/lib/dataService.js

## Business intent
Compare monthly inverter generation against CEB exported units using billing-cycle alignment, where a bill received in month N represents generation from month N-1.

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

## Reference scenario
Scenario:
- today = 2026-04-18
- latest CEB bill entered = 2026-04-03

Expected:
- March row: uses bill 2026-04-03 for CEB and exact bill window for inverter
- April row: inverter-only progress; CEB pending (null)

## Known correction targets
- src/contexts/DataContext.jsx
- src/components/dashboard/EnergyCharts.jsx
- Detailed correction plan: docs/development/CEB_INVERTER_ALIGNMENT_CORRECTION_REPORT.md

## Notes
- This registry intentionally contains only LR-001 for now, as requested.
- Additional entries should be added only after logic confirmation and verification.
