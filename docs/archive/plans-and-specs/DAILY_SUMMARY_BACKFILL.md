> **Archived 2026-09-24 — historical record, not current.** This is a plan, spec or implementation report. Some of these were built, some were changed along the way, and some were never built — check the code before relying on any of it.
> Current documentation: [`docs/README.md`](../../README.md).

# Daily Summary Backfill & Correction System

## Overview

The daily summary generator now includes intelligent backfill and correction capabilities to ensure data integrity even when the workflow is missed or run at incorrect times.

## Features

### 1. **Scheduled Execution**
- Runs daily at **22:30 Sri Lanka time** (17:00 UTC)
- This timing ensures the day's data is complete before processing

### 2. **30-Day Backfill**
On each run, the workflow:
- Checks the last **30 days** (including today)
- Identifies missing or incorrect records
- Inserts or updates as needed

### 3. **Smart Update Logic**
For each day and inverter:
- **Missing record**: Fetches raw data and inserts new summary
- **Existing record with different values**: Updates if recalculated values differ by >0.01
- **Correct record**: Skips to avoid unnecessary writes
- **Today before 23:00**: Skips to prevent incomplete data (only updates after 23:00 local time)

### 4. **Manual Backfill**
The workflow can be triggered manually via GitHub Actions:
1. Go to Actions → "Generate Daily Inverter Summary"
2. Click "Run workflow"
3. Optionally enable debug logging

This is useful for:
- Recovering from missed runs
- Correcting data after system issues
- Backfilling historical gaps

## Data Flow

```
┌─────────────────────────────────────┐
│  GitHub Actions Scheduler           │
│  (22:30 Sri Lanka = 17:00 UTC)      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Check Last 30 Days                 │
│  (from 29 days ago to today)        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  For Each Day:                      │
│  1. Fetch live data for that date   │
│  2. Aggregate by inverter           │
│  3. Check existing summary records  │
│  4. Determine action needed         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Actions:                           │
│  • INSERT: Missing records          │
│  • UPDATE: Values changed >0.01     │
│  • SKIP: Unchanged or too early     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Upsert to Database                 │
│  (inverter_data_daily_summary)      │
└─────────────────────────────────────┘
```

## Database Schema

```sql
create table public.inverter_data_daily_summary (
  id bigint generated always as identity not null,
  inverter_sn text not null,
  summary_date date not null,
  total_generation_kwh numeric(10, 2) not null,
  peak_power_kw numeric(10, 2) null,
  created_at timestamp without time zone null default now(),
  constraint inverter_data_daily_summary_pkey primary key (id),
  constraint inverter_data_daily_summary_inverter_sn_summary_date_key 
    unique (inverter_sn, summary_date)
);
```

The unique constraint on `(inverter_sn, summary_date)` ensures:
- No duplicate records per inverter per day
- Upsert operations work correctly
- Data integrity is maintained

## Configuration

### Timing Settings (in `index.js`)
```javascript
// Number of days to backfill/check on each run
const BACKFILL_DAYS = 30;

// Minimum hour (24h format) to allow updating today's record
const MIN_HOUR_FOR_TODAY_UPDATE = 23;
```

### Cron Schedule (in workflow YAML)
```yaml
schedule:
  # 22:30 Sri Lanka time (UTC+5:30) => 17:00 UTC daily
  - cron: '0 17 * * *'
```

## Example Output

```
══════════════════════════════════════════════════════════════
 DAILY INVERTER SUMMARY GENERATOR - START
══════════════════════════════════════════════════════════════
🕐 UTC Time: 2025-11-24T17:00:00.000Z
📅 Today (Sri Lanka local): 2025-11-24
🕐 Current Sri Lanka Time: 22:xx
🔄 Backfilling last 30 days...

📆 Processing 2025-10-25...
   ✅ Inserts: 1, Updates: 0, Unchanged: 0
      [INSERT] INV001: 45.23 kWh, 4.85 kW

📆 Processing 2025-10-26...
   ✅ Inserts: 0, Updates: 1, Unchanged: 0
      [UPDATE] INV001: 48.76 kWh, 5.12 kW

📆 Processing 2025-11-23...
   ✅ Inserts: 0, Updates: 0, Unchanged: 1

📆 Processing 2025-11-24 (today)...
   ✅ Inserts: 0, Updates: 1, Unchanged: 0
      [UPDATE] INV001: 52.34 kWh, 5.45 kW

🧹 Pruning live data older than 2025-11-10T17:00:00.000Z ...
✅ Prune completed (older than 14 days removed)

══════════════════════════════════════════════════════════════
 DAILY SUMMARY GENERATOR - SUCCESS
══════════════════════════════════════════════════════════════
📊 Summary:
   • Total Days Checked: 30
   • New Records Inserted: 1
   • Records Updated: 2
   • Records Unchanged: 26
   • Days Skipped: 1
   ⏱ Duration: 3.45s
══════════════════════════════════════════════════════════════
```

## Benefits

1. **Automatic Gap Filling**: Missed days are automatically backfilled on the next run
2. **Data Correction**: Incorrect records (e.g., from early-day runs) are automatically fixed
3. **Manual Recovery**: Can be run anytime to fix historical data
4. **Prevent Incomplete Data**: Won't update today's record if run too early
5. **Idempotent**: Safe to run multiple times - won't create duplicates
6. **Transparent**: Detailed logging shows exactly what was changed

## Troubleshooting

### Issue: "Too many days skipped"
- **Cause**: Likely no live data available for those days
- **Solution**: Check if inverter was offline or data collection failed

### Issue: "All records show as 'unchanged'"
- **Cause**: Data is already correct
- **Solution**: This is expected behavior - no action needed

### Issue: "Today is always skipped"
- **Cause**: Workflow running before 23:00 Sri Lanka time
- **Solution**: Wait until after 23:00 or adjust `MIN_HOUR_FOR_TODAY_UPDATE`

### Issue: "Manual run needed"
- **Cause**: Workflow was disabled or failed for several days
- **Solution**: Manually trigger the workflow - it will backfill up to 30 days

## Related Files

- **Script**: `functions/generate_daily_summary/index.js`
- **Workflow**: `.github/workflows/generate-daily-inverter-summary.yml`
- **Table**: `public.inverter_data_daily_summary`
- **Source Data**: `public.inverter_data_live`
