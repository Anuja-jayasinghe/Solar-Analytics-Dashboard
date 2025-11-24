# Quick Reference: Daily Summary Backfill System

## 🎯 What Was Implemented

A robust daily summary generation system that:
- ✅ Runs automatically at **22:30 Sri Lanka time** (17:00 UTC) daily
- ✅ Checks and backfills **last 30 days** on every run
- ✅ Inserts missing records automatically
- ✅ Updates incorrect records automatically
- ✅ Skips updating today's record if run before 23:00 (prevents incomplete data)
- ✅ Can be run manually anytime to fix historical gaps

## 📋 How to Use

### Automatic (Recommended)
Nothing to do! The system runs daily at 22:30 Sri Lanka time via GitHub Actions.

### Manual Backfill
1. Go to GitHub → Actions → "Generate Daily Inverter Summary"
2. Click "Run workflow" → "Run workflow"
3. Wait for completion (~30 seconds)
4. Check logs to see what was inserted/updated

### Local Testing
```bash
cd functions/generate_daily_summary
node index.js
```

## 🔍 Monitoring

### Check GitHub Actions Logs
1. Go to Actions tab in GitHub
2. Click on "Generate Daily Inverter Summary"
3. View latest run logs

Expected output:
```
📊 Summary:
   • Total Days Checked: 30
   • New Records Inserted: 0
   • Records Updated: 1
   • Records Unchanged: 29
   • Days Skipped: 0
   ⏱ Duration: 2.34s
```

### Check Database Records
```sql
-- View last 7 days
SELECT 
  summary_date,
  inverter_sn,
  total_generation_kwh,
  peak_power_kw
FROM inverter_data_daily_summary
WHERE summary_date >= CURRENT_DATE - 7
ORDER BY summary_date DESC;

-- Find missing days
SELECT d::date AS missing_date
FROM generate_series(
  CURRENT_DATE - 30,
  CURRENT_DATE,
  '1 day'::interval
) d
WHERE NOT EXISTS (
  SELECT 1 
  FROM inverter_data_daily_summary 
  WHERE summary_date = d::date
);
```

## ⚙️ Configuration Files

| File | Purpose |
|------|---------|
| `functions/generate_daily_summary/index.js` | Main script with backfill logic |
| `.github/workflows/generate-daily-inverter-summary.yml` | GitHub Actions schedule |
| `docs/DAILY_SUMMARY_BACKFILL.md` | Detailed documentation |

## 🎛️ Key Settings

```javascript
// In functions/generate_daily_summary/index.js

const BACKFILL_DAYS = 30;  // How many days to check
const MIN_HOUR_FOR_TODAY_UPDATE = 23;  // Don't update today before this hour
```

```yaml
# In .github/workflows/generate-daily-inverter-summary.yml

schedule:
  - cron: '0 17 * * *'  # 17:00 UTC = 22:30 Sri Lanka
```

## 🚨 Troubleshooting

### Problem: Some days are always skipped
**Solution**: Check if live data exists for those days
```sql
SELECT DATE(data_timestamp) as date, COUNT(*) as records
FROM inverter_data_live
WHERE data_timestamp >= CURRENT_DATE - 30
GROUP BY DATE(data_timestamp)
ORDER BY date DESC;
```

### Problem: Today is always skipped
**Solution**: This is normal before 23:00 Sri Lanka time. After 23:00, it should update.

### Problem: Values not updating
**Solution**: Values only update if they differ by >0.01. Check if source data actually changed.

### Problem: Workflow didn't run
**Solution**: 
1. Check if GitHub Actions is enabled
2. Manually run the workflow
3. Check for workflow permission issues

## 📊 What Gets Logged

Each run logs to `api_logs` table:
- Endpoint: `generate_daily_summary_success` or `generate_daily_summary_failed`
- Message: Summary statistics
- Timestamp: When it ran

Query logs:
```sql
SELECT * FROM api_logs 
WHERE endpoint LIKE 'generate_daily_summary%'
ORDER BY created_at DESC
LIMIT 10;
```

## 🔄 Data Flow Summary

```
Live Data (inverter_data_live)
    ↓
[Daily at 22:30 SL Time]
    ↓
Check Last 30 Days
    ↓
Calculate: max(generation_today), max(power_ac) per inverter per day
    ↓
Compare with existing summaries
    ↓
Insert/Update/Skip as needed
    ↓
Daily Summaries (inverter_data_daily_summary)
    ↓
Used by Dashboard (MonthlyGenerationCard, SystemTrends, etc.)
```

## 📝 Testing Checklist

Before relying on the system:

- [ ] Run manual test: `node functions/generate_daily_summary/index.js`
- [ ] Verify output shows all 30 days processed
- [ ] Check database has records for last 30 days
- [ ] Wait for scheduled run at 22:30 Sri Lanka time
- [ ] Check GitHub Actions logs for successful run
- [ ] Verify dashboard shows correct totals

## 🎉 Benefits

1. **Self-Healing**: Automatically fills missing data
2. **Data Quality**: Corrects incomplete/incorrect records
3. **Manual Recovery**: Can backfill anytime manually
4. **Safe**: Won't create duplicates or overwrite good data unnecessarily
5. **Transparent**: Detailed logs show exactly what changed

---

**Status**: ✅ Fully implemented and ready for production
**Last Updated**: November 24, 2025
