# Solar Analytics - Reportable Data Selection List

## 1. Energy Production Analytics
* **Specific Yield (kWh/kWp):** Daily generation / 40 kW system capacity capacity can be entered before report genereation question set.
* **Peak Power Utilization:** `peak_power_kw` as a % of 40 kW rated capacity  capacity can be entered before report genereation question set.
* **Capacity Factor:** Ratio of actual generation vs. theoretical 24h maximum.
* **Generation Consistency:** Day-over-day variance in `total_generation_kwh`.

## 2. Financial & Billing Analytics
* **Gross Generation Value:** Total `etotal` * `rate_per_kwh` (LKR 37).
* **Revenue Growth:** Month-over-month % change in `totalIncome`.
* **Tariff Simulation:** Potential earnings calculated at alternative LKR rates alternate rate can be enterd before report generation question set.

## 3. Hardware Performance & Health
* **Thermal Efficiency:** Correlation between `inverterTemperature` and `pac` output.
* **System Uptime %:** % of time the inverter `state` remained "Normal (1)" during daylight.
* **Inverter Conversion Efficiency:** The `efficiency` percentage reported by the API.
* **DC String Health:** Monitoring `dcVoltage1` and `dcCurrent1` stability.
* **Signal Reliability:** Average `signalStrength` during the reporting period.

## 4. Environmental Impact
* **Carbon Offset:** Lifetime CO2 saved (kg) derived from `etotal`.
* **Tree Equivalent:** Number of trees required for an equivalent CO2 offset.

## 5. CSV Export Columns (Proposed)
* **Time Data:** `Timestamp`, `Date`, `Timezone`.
* **Inverter Stats:** `SN`, `Model`, `pac (kW)`, `etoday (kWh)`, `etotal (kWh)`.
* **Physical Stats:** `Temperature (C)`, `Efficiency (%)`, `DC_Voltage`, `DC_Current`.
* **Billing Stats:** `Units_Exported (kWh)`, `Earnings (LKR)`, `Rate_Used`.
* **Status:** `State_Text`, `Signal_Strength`.

## Feasibility & Scope
* All items above are feasible with current data: live snapshots (`inverter_data_live` raw JSON) and daily summaries (`inverter_data_daily_summary`).
* Uses configurable settings (`rate_per_kwh`, `solar_grid_capacity`) for yield and earnings math.

## Opted Out (not in scope now)
* Load Profile Analytics
* Seasonal & Weather-Adjusted Metrics
* Comparative & Benchmark Reports

## Data Retention Notes
* `inverter_data_live` raw JSON (real-time Solis payload) is retained ~30 days, then pruned.
* Daily summaries (`inverter_data_daily_summary`) and aggregates are kept long-term (no auto-prune today).