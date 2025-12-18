# Solar Analytics - Report Generation System
## Complete Data Inventory & Implementation Plan

**Version:** 1.0  
**Date:** December 18, 2025  
**Author:** anujajay  
**Purpose:** Define the complete report generation feature with full data specifications

---

## 🎯 WHAT WE'RE BUILDING

### Vision
A comprehensive **Report Generation & Export System** that allows users to:
- Generate professional, branded PDF reports of their solar energy data
- Export raw data to CSV for analysis in Excel/other tools
- Filter and customize reports by time period, data type, and granularity
- Access different report types based on their needs (daily trends, monthly summaries, earnings statements)

### Key Features
1. **Dedicated Reports Page** - Separate navigation item (like Admin Dashboard)
2. **Smart Filters** - Period selectors, data type toggles, format options
3. **Live Preview** - See what the report will contain before generating
4. **Branded Output** - All reports include system logo, theme colors, user context, and copyright
5. **Download Management** - Clean filenames, proper MIME types, download history

### User Experience Flow
```
Reports Page → Select Filters → Preview Data → Generate → Download
     ↓              ↓              ↓            ↓           ↓
  Sidebar      Time Period    Summary Stats   PDF/CSV   Filename
  Navigation   Data Type      Sample Charts   Creation  report_2024-12.pdf
               Output Format  Estimated Size  Branding  
```

### Access Levels
- **Standard Users:** Generate their own energy reports (generation, earnings, comparisons)
- **Admins:** All user reports + system health + raw database exports + user analytics

---

## � REAL API DATA STRUCTURE

### Solis Cloud API - Inverter List Response
**Endpoint:** `/v1/api/inverterList`  
**Method:** POST  
**Authentication:** HMAC-SHA1 signed headers

**Sample Request Body:**
```json
{
  "pageNo": 1,
  "pageSize": 50
}
```

**Sample Response (Full):**
```json
{
  "success": true,
  "code": "0",
  "msg": "Success",
  "data": {
    "page": {
      "totalRecordCount": 1,
      "currentPage": 1,
      "pageSize": 50,
      "records": [
        {
          "id": "1234567890123456789",
          "sn": "ABC1234567890",
          "stationId": "9876543210987654321",
          "stationName": "Home Solar System",
          "type": 2,
          "typeName": "Residential",
          "capacity": 5.0,
          "capacityStr": "5.0 kW",
          "model": "SOLIS-5K-2G",
          "pac": 3.45,
          "etoday": 18.7,
          "etotal": 12547.8,
          "dataTimestamp": "1734532800000",
          "inverterTemperature": 42.5,
          "state": 1,
          "stateText": "Normal",
          "familyLoadPower": 4.2,
          "batteryPower": 0,
          "gridPower": 0.75,
          "psum": 3.45,
          "fullHour": 5.42,
          "dayIncome": 694.9,
          "totalIncome": 464269.4,
          "wirelessCommunicationState": 1,
          "communicationState": 1,
          "signalStrength": 4,
          "firmware": "MW3_15_V1.0.14(2023-08-23)",
          "inverterCountryId": "144",
          "inverterCountry": "Sri Lanka",
          "installerNickname": "Solar Installer Co.",
          "installerCompanyName": "Solar Installer Company Ltd",
          "location": {
            "lat": "6.9271",
            "lng": "79.8612",
            "address": "Colombo, Sri Lanka"
          },
          "timezone": "Asia/Colombo",
          "gridVoltage": 230.5,
          "gridFrequency": 50.02,
          "dcVoltage1": 385.2,
          "dcCurrent1": 8.96,
          "dcVoltage2": 0,
          "dcCurrent2": 0,
          "efficiency": 97.3
        }
      ]
    }
  }
}
```

**Key Fields for Reports:**
- `sn` - Inverter serial number (unique identifier)
- `pac` - Current AC power output in kW (e.g., 3.45 kW)
- `etoday` - Today's generation in kWh (e.g., 18.7 kWh)
- `etotal` - Lifetime total generation in kWh (e.g., 12,547.8 kWh)
- `dataTimestamp` - Unix timestamp in milliseconds (convert to readable date)
- `inverterTemperature` - Temperature in °C (e.g., 42.5°C)
- `state` - Operational state (1 = Normal, 0 = Offline, other = Fault)
- `fullHour` - Full-power equivalent hours for the day
- `dayIncome` - Today's earnings in configured currency
- `totalIncome` - Lifetime earnings

**Stored in Database:**
After fetching, this data is stored in `inverter_data_live` table with fields:
```sql
inverter_sn          TEXT       -- ABC1234567890
data_timestamp       TIMESTAMP  -- 2024-12-18 14:00:00+00
power_ac            DECIMAL    -- 3.45 (kW)
generation_today    DECIMAL    -- 18.7 (kWh)
inverter_temp       DECIMAL    -- 42.5 (°C)
status              INTEGER    -- 1 (Normal)
raw_data            JSONB      -- Full API response stored for reference
```

---

### 1. **Live Inverter Data** 
**Source:** `supabase.functions.invoke('solis-live-data')`  
**Frequency:** Real-time (polled every 30s-60s)  
**Table:** `inverter_data_live`

**Fields:**
- `inverter_sn` - Serial number
- `data_timestamp` - Reading timestamp
- `power_ac` - Current AC power output (kW)
- `generation_today` - Today's total generation (kWh)
- `inverter_temp` - Temperature (°C)
- `status` - Inverter state (online/offline/fault)
- `raw_data` - Full Solis API response (JSON)

**Retention:** 30 days (auto-pruned)

---

### 2. **Daily Generation Summary**
**Source:** `supabase.from('inverter_data_daily_summary')`  
**Frequency:** Aggregated nightly at 18:00 UTC  
**Table:** `inverter_data_daily_summary`

**Fields:**
- `inverter_sn` - Serial number
- `summary_date` - Date (YYYY-MM-DD)
- `total_generation_kwh` - Total daily generation (kWh)
- `peak_power_kw` - Peak power during the day (kW)

**Time Range:** Historical (all days since installation)

---

### 3. **Monthly Energy Comparison**
**Source:** `supabase.rpc('get_monthly_comparison')`  
**Frequency:** Pre-aggregated RPC function  
**Purpose:** Inverter vs CEB monthly comparison

**Fields:**
- `month_label` - Short month label (e.g., "Nov '24")
- `period_label` - Billing period (e.g., "Oct 05 - Nov 04")
- `inverter_kwh` - Total inverter generation for period (kWh)
- `ceb_kwh` - Total CEB import for period (kWh)

**Time Range:** Last 12 months (rolling)

---

### 4. **CEB Billing Data**
**Source:** `supabase.from('ceb_data')`  
**Frequency:** Manual entry (monthly)  
**Table:** `ceb_data`

**Fields:**
- `id` - Unique record ID
- `bill_date` - Billing cycle start date
- `meter_reading` - Meter reading
- `units_exported` - Units exported to grid (kWh)
- `earnings` - Earnings from export (LKR)
- `created_at` - Record creation timestamp

**Time Range:** Historical (all billing cycles)

---

### 5. **System Settings**
**Source:** `supabase.from('system_settings')`  
**Table:** `system_settings`

**Fields:**
- `setting_name` - Setting identifier
- `setting_value` - Value (string/number)

**Key Settings:**
- `rate_per_kwh` - Current tariff rate (LKR per kWh) - default 37

---

### 6. **User/Auth Context**
**Source:** Clerk authentication  
**Available via:** `useUser()` hook

**Fields:**
- `id` - User ID
- `emailAddresses[0].emailAddress` - User email
- `firstName` - First name
- `lastName` - Last name
- `createdAt` - Account creation timestamp

---

## 📈 DERIVED/CALCULATED METRICS

### Current Period Metrics (from DataContext)

**Total Earnings:**
- Source: Sum of all `ceb_data.earnings`
- Calculation: `SUM(earnings)`
- Format: LKR

**Monthly Generation (Current Billing Cycle):**
- Source: `inverter_data_daily_summary` 
- Period: Latest `ceb_data.bill_date` to today
- Calculation: `SUM(total_generation_kwh)` between dates
- Format: kWh

**Inverter Potential Value:**
- Source: Live total generation × tariff
- Calculation: `(totalGeneration MWh × 1000) × rate_per_kwh`
- Format: LKR

---

## 🔄 AVAILABLE TIME GRANULARITIES

### Daily
- **Available:** `inverter_data_daily_summary`
- **Fields:** Date, generation (kWh), peak power (kW)
- **Range:** Full history
- **Use Cases:** Daily trends, day-to-day comparison, seasonal patterns

### Monthly (Billing Cycle)
- **Available:** `get_monthly_comparison` RPC
- **Fields:** Period label, inverter vs CEB (kWh)
- **Range:** Last 12 months
- **Use Cases:** Monthly comparison, billing cycle analysis

### Monthly (Calendar)
- **Available:** Aggregate from daily summary
- **Calculation:** Group by `DATE_TRUNC('month', summary_date)`
- **Use Cases:** Calendar month reports, year-over-year

### Yearly
- **Available:** Aggregate from daily or monthly
- **Calculation:** Group by year
- **Use Cases:** Annual reports, multi-year trends

### Custom Range
- **Available:** Query daily summary with date filters
- **Parameters:** `start_date`, `end_date`
- **Use Cases:** Specific period analysis, quarterly reports

---

## 📊 REPORTABLE DATA COMBINATIONS

### 1. **Generation Reports**
**Daily Generation:**
- Time series of daily kWh
- Peak power trends
- Day-of-week patterns

**Monthly Generation:**
- Total kWh per billing cycle or calendar month
- Average daily generation
- Month-over-month comparison

**Yearly Generation:**
- Annual total kWh
- Monthly breakdown
- Year-over-year growth

---

### 2. **Earnings Reports**
**Total Earnings:**
- Sum of all CEB export earnings
- Lifetime total (LKR)

**Monthly Earnings:**
- Earnings per billing cycle
- Trend over time

**Projected Earnings:**
- Based on current generation × tariff
- Inverter potential value vs actual CEB earnings

---

### 3. **Comparison Reports**
**Inverter vs CEB:**
- Monthly comparison (current implementation)
- Solar self-consumption percentage
- Import reduction statistics

**Tariff Analysis:**
- Earnings at different rates
- ROI calculations
- Break-even projections

---

### 4. **Performance Reports**
**System Health:**
- Inverter status history
- Downtime analysis
- Temperature trends

**Efficiency Metrics:**
- Peak power utilization
- Capacity factor
- Performance ratio (if rated capacity available)

---

### 5. **Environmental Impact** (Calculated)
**Carbon Offset:**
- Total generation × carbon factor
- Trees equivalent
- CO2 saved

**Currently in Dashboard:**
- Source: `EnvironmentalImpact.jsx`
- Lifetime CO2 saved, trees planted equivalent

---

## 🎯 RECOMMENDED REPORT TYPES

### User Reports (Standard Access)
1. **Monthly Energy Summary**
   - Period: Last billing cycle or custom month
   - Data: Inverter generation, CEB comparison, earnings
   - Charts: Bar/line comparison, daily trend
   
2. **Daily Generation Report**
   - Period: Last 30/60/90 days or custom
   - Data: Daily kWh, peak power
   - Charts: Time series, heatmap

3. **Yearly Performance**
   - Period: Calendar year or last 12 months
   - Data: Monthly totals, averages, growth
   - Charts: Monthly bars, cumulative line

4. **Earnings Statement**
   - Period: All time or date range
   - Data: CEB earnings, billing cycles
   - Table: Detailed transactions

---

### Admin Reports (Elevated Access)
1. **All of above** plus:

2. **System Health Report**
   - Inverter status logs
   - Downtime periods
   - Temperature anomalies

3. **User Activity Report**
   - Export counts per user (future)
   - Access logs (if implemented)

4. **Data Export (CSV)**
   - Raw daily summary data
   - Raw CEB billing data
   - For external analysis

---

## 🗂️ DATA FIELDS BY REPORT TYPE

### PDF Reports - Recommended Sections

**Header:**
- Logo, system branding
- Report title and type
- Generated timestamp
- Requested by (user email)
- Report ID

**Summary Cards:**
- Total Generation (kWh)
- Total Earnings (LKR)
- Solar Coverage (%)
- Average Daily (kWh/day)
- Peak Power (kW)

**Charts:**
- Monthly comparison (bar/line)
- Daily trend (line)
- Cumulative generation (area)

**Detailed Table:**
- Date/Period | Generation | Earnings | Status

**Footer:**
- Period covered
- Data sources
- Copyright: anujajay
- Support contact

---

### CSV Exports - Column Structure

**Daily Generation:**
```
Date, Inverter_SN, Generation_kWh, Peak_Power_kW, Avg_Power_kW
```

**Monthly Summary:**
```
Period, Month, Inverter_kWh, CEB_kWh, Total_kWh, Solar_Percentage, Earnings_LKR
```

**CEB Billing:**
```
Bill_Date, Meter_Reading, Units_Exported, Earnings_LKR, Billing_Period
```

**Combined Report:**
```
Date, Type, Generation_kWh, Import_kWh, Export_kWh, Earnings_LKR, Notes
```

---

## 🔐 ACCESS CONTROL

### Public/User Access:
- Own generation data
- Monthly summaries
- Earnings statements
- No raw CEB billing details

### Admin Access:
- All user data
- System health metrics
- Raw database exports
- Aggregate statistics

---

## 💡 MISSING DATA / LIMITATIONS

**Not Currently Available:**
1. Hourly generation (only daily aggregates)
2. Grid import usage (only export earnings)
3. Power factor, voltage, current details
4. Weather correlation data
5. Equipment maintenance logs
6. Multiple inverters differentiation (if applicable)

**Potential Future Additions:**
1. Hourly summary table
2. Weather API integration
3. Predictive analytics
4. Anomaly detection alerts

---

## 🎨 FILTER DESIGN MATRIX

### Axes:
**Time Period:**
- Daily (last 7/30/60/90 days)
- Monthly (billing cycle or calendar)
- Yearly (current, last, all time)
- Custom date range

**Data Type:**
- Generation only
- Earnings only
- Comparison (inverter vs CEB)
- System health
- Environmental impact

**Granularity:**
- Raw daily records
- Weekly aggregates
- Monthly aggregates
- Yearly totals

**Output Format:**
- PDF (visual summary)
- CSV (data export)
- Excel (formatted tables) - future

---

## ✅ NEXT STEPS

1. **Confirm data inventory** - Is this complete?
2. **Define report page filters** - Which combinations?
3. **Design Reports page UI** - Layout and controls
4. **Update template** - Add real logo, theme, user context
5. **Build filter logic** - Date pickers, checkboxes, dropdowns
6. **Implement generation** - PDF/CSV creation
7. **Add download handlers** - Blob downloads, filenames

---

**Status:** ✅ Data audit complete  
**Awaiting:** Confirmation and filter design approval
