# SolisCloud Explorer Refactor Plan

Date: 2026-04-19
Status: Planning
Scope: Replace current Dev Tools diagnostics panel with a SolisCloud Live Explorer panel

## 1) Goal
Build an in-app panel that can call SolisCloud API endpoints on demand and show formatted results (not raw-only), without storing returned data.

The panel should:
- let users trigger endpoint calls with buttons/forms
- show pretty cards/tables plus expandable JSON
- be safe by design (no client-side credentials, no unrestricted endpoint pass-through)

## 2) What was verified from API V2.0.3

From the extracted API specification (131 pages):
- **Protocol**: HTTPS only
- **Request Method**: All endpoints use POST (not REST GET/PUT/DELETE)
- **Request Content Type**: application/json;charset=UTF-8
- **Auth Headers Required**: Content-MD5, Content-Type, Date, Authorization
- **Signing Algorithm**: HMAC-SHA1(apiSecret, "POST\n" + Content-MD5 + "\n" + Content-Type + "\n" + Date + "\n" + CanonicalizedResource)
  - ✅ Matches existing [src/lib/solisAuth.js](src/lib/solisAuth.js) implementation
- **Response Format**: All endpoints return `{ success: bool, code: "0"|error, msg: string, data: {...} }`
- **Data Update Frequency**: ~5 minutes for live metrics
- **Endpoint Count**: 37 total endpoints documented
  - ✅ 32 are read-only (query/retrieval operations)
  - ❌ 5 are mutating (create/update/delete operations) → blocked from explorer

**UNVERIFIED:** Most endpoint response shapes and exact field content are documented in spec but not validated against live Solis API. Phase 1 must include actual test calls to confirm:
- Field presence/absence in live responses
- Null/empty value handling
- Array sizes and pagination edge cases
- Error response shapes
- Rate limit headers/behavior

## 3) Full endpoint inventory from the doc (37 total)
**IMPORTANT:** Most endpoint response shapes and exact data content are unknown until tested against live API. The following documentation is extracted from API v2.0.3 spec but needs validation in Phase 1.

All endpoints use **HTTPS POST** with JSON payloads. **Only read-only (GET-equivalent) endpoints are listed below.** Mutating endpoints (POST/PUT/DELETE ops) are explicitly blocked in MVP.

### Inverter (Read-only query endpoints)
- **/v1/api/inverterList** → Array of inverter objects  
  - Returns: paginated list of inverters with id, sn, stationId, stationName, power, eToday, eTotal, state, realtime metrics (pac, frequency, currents, voltages), status (online/offline/alarm)  
  - Format: `{ data: { page: {...}, records: [...], inverterStatus: {total, normal, offline, fault} } }`  
  - Use case: Discover all inverters under account

- **/v1/api/inverterDetail** → Single inverter with all live/historical metrics  
  - Returns: Full inverter state including power output, energy (daily/monthly/yearly/total), currents (AC R/S/T, DC 1-32), voltages (AC/DC), battery metrics (SOC, SOH, charge/discharge power), grid frequency, temperature  
  - Format: `{ data: {id, sn, stationId, stationName, eTodayStr: "kWh", pacStr: "kW", state, iAc1, iAc2, uAc1, uPv1, pow1, ...} }`  
  - Use case: View detailed live/cached state of one inverter

- **/v1/api/inverterDetailList** → Batch query for multiple inverter details  
  - Returns: Same as inverterDetail but paginated list across multiple inverters  
  - Format: `{ data: { page: {...}, records: [...] } }`  
  - Use case: Quick snapshot of multiple inverters at once

- **/v1/api/inverterDay** → Daily time-series data for one inverter  
  - Returns: Array of intraday power generation snapshots (typically 5-min intervals)  
  - Format: `{ data: [{ dataTimestamp, timeStr, eTodayStr: "kWh", pac, pacStr: "kW", facStr: "Hz", ...}, ...] }`  
  - Use case: Plot daily power curve

- **/v1/api/inverterMonth** → Monthly energy summary for one inverter  
  - Returns: Daily breakdown of monthly energy with cost/income  
  - Format: `{ data: [{date: 1685592000000, dateStr: "2023-06-01", energy: 41.6, energyStr: "kWh", money: 41.6, moneyStr: "AUD", batteryDischargeEnergy, gridPurchasedEnergy, gridSellEnergy}, ...] }`  
  - Use case: Monthly analysis, revenue tracking

- **/v1/api/inverterYear** → Yearly energy summary for one inverter  
  - Returns: Monthly breakdown of year with cumulative energy/cost  
  - Format: Similar to inverterMonth but aggregated by month  
  - Use case: Annual energy/revenue review

- **/v1/api/inverterAll** → Cumulative lifetime statistics  
  - Returns: Total energy, total revenue, full hours of operation  
  - Format: `{ data: { totalEnergy: number, totalIncome: number, fullHour: number, ...} }`  
  - Use case: Lifetime KPIs

- **/v1/api/inverter/shelfTime** → Warranty/shelf-life tracking  
  - Returns: List of inverters with warranty start/end dates and status  
  - Format: `{ data: { records: [{id, sn, shelfBeginTime, shelfEndTime, shelfState}, ...], total, pages } }`  
  - Use case: Maintenance/warranty monitoring

### Station / Plant (Read-only query endpoints)
- **/v1/api/userStationList** → All power stations/plants under user account  
  - Returns: Paginated list of stations with id, name, address, capacity, daily/monthly/yearly energy, status, weather  
  - Format: `{ data: { page: {...}, records: [...] } }`  
  - Use case: Station overview/selection

- **/v1/api/stationDetail** → Full details of one power station  
  - Returns: Station metadata (name, address, capacity, inverter count), aggregated energy (daily/monthly/yearly/total), income, weather, environmental impact (tree equivalent, CO2 avoided)  
  - Format: `{ data: {id, stationName, addr, capacity, capacityStr: "kW", dayEnergy, monthEnergy, yearEnergy, allEnergy, state, weather: {condTxtD, tmpMax, tmpMin, ...}, powerStationNumTree, ...} }`  
  - Use case: Station summary dashboard

- **/v1/api/stationDetailList** → Batch query for multiple station details  
  - Returns: Same as stationDetail but paginated  
  - Format: `{ data: { page: {...}, records: [...] } }`  
  - Use case: Multi-station overview

- **/v1/api/stationDay** → Intraday time-series for entire station  
  - Returns: Array of power snapshots (5-min intervals typical) with battery/load breakdown  
  - Format: `{ data: [{time: 1685057100000, timeStr: "07:25:00", power: 77, powerStr: "kW", familyLoadPower, batteryPower, produceEnergy, ...}, ...] }`  
  - Use case: Daily power curve for station

- **/v1/api/stationMonth** → Monthly energy breakdown  
  - Returns: Daily or aggregated monthly data with energy/cost  
  - Format: Similar to inverterMonth but station-level  
  - Use case: Monthly station analytics

- **/v1/api/stationYear** → Yearly energy breakdown  
  - Returns: Monthly aggregation for full year  
  - Format: Similar structure, yearly aggregation  
  - Use case: Annual station performance

- **/v1/api/stationAll** → Lifetime cumulative for station  
  - Returns: Total energy generated, total income, full operating hours  
  - Format: `{ data: { totalEnergy, totalIncome, fullHour, ...} }`  
  - Use case: Station lifetime KPIs

- **/v1/api/stationDayEnergyList** → Daily energy trend list  
  - Returns: Paginated list of daily energy records, one row per day  
  - Format: `{ data: { page: {...}, records: [{date, energy, money, ...}, ...] } }`  
  - Use case: Long-term trend table

- **/v1/api/stationMonthEnergyList** → Monthly energy trend list  
  - Returns: Paginated monthly aggregates  
  - Format: Similar to stationDayEnergyList but monthly granularity  
  - Use case: Revenue tracking table

- **/v1/api/stationYearEnergyList** → Yearly energy trend list  
  - Returns: Paginated yearly aggregates  
  - Format: Similar to stationMonthEnergyList but yearly  
  - Use case: Long-term comparison

### Alarm / Weather (Read-only query endpoints)
- **/v1/api/alarmList** → Device alarms/warnings/faults  
  - Returns: Paginated alarm records filterable by status (pending/processed/resolved), device, time range  
  - Format: `{ data: { page: {...}, records: [{stationId, stationName, alarmDeviceSn, alarmCode, alarmLevel: "1|2|3" (tip/general/emergency), alarmBeginTime, alarmEndTime, alarmMsg, advice, state}, ...] } }`  
  - Use case: Alerts dashboard, fault history

- **/v1/api/weatherList** → Weather forecasts/conditions  
  - Returns: Current weather at station location with forecast  
  - Format: `{ data: [{ location, condTxtD (day), condTxtN (night), tmpMax, tmpMin, humidity, windDir, windSpd, ...}, ...] }`  
  - Use case: Weather context for performance

- **/v1/api/weatherDetail** → Detailed weather for specific location  
  - Returns: Extended weather forecast and historical weather  
  - Format: Similar to weatherList but with additional detail  
  - Use case: Advanced weather analytics

### Collector (Read-only query endpoints)
- **/v1/api/collectorList** → All data collectors under account  
  - Returns: List of collectors (communication hubs) with connection state  
  - Format: `{ data: { page: {...}, records: [{id, stationName, stationId, sn, model, name, state: "1|2|3" (online/offline/alarm), rssiLevel, ...}, ...] } }`  
  - Use case: Device management / connectivity monitoring

- **/v1/api/collectorDetail** → Single collector full state  
  - Returns: Collector metadata, connected devices, signal strength, contract status  
  - Format: `{ data: {id, sn, model, name, state, rssiLevel, contractTime, ...} }`  
  - Use case: Collector diagnostics

- **/v1/api/collector/day** → Daily collector statistics  
  - Returns: Collector uptime/downtime metrics for a day  
  - Format: Unknown (spec incomplete) - likely `{ data: [{timestamp, uptime, downtime, ...}, ...] }`  
  - Use case: Collector reliability tracking

### EPM (Read-only query endpoints)
- **/v1/api/epmList** → Electrical Power Meter list  
  - Returns: All EPMs (grid meter devices) under account  
  - Format: `{ data: { page: {...}, records: [{id, sn, model, name, stationId, state}, ...] } }`  
  - Use case: Meter inventory

- **/v1/api/epmDetail** → Single EPM current reading  
  - Returns: Live grid voltage, current, frequency, power import/export  
  - Format: `{ data: {id, sn, uAc, iAc, fac, pac, direction, state, ...} }`  
  - Use case: Grid metering dashboard

- **/v1/api/epm/day** → Daily EPM aggregates  
  - Returns: Intraday energy import/export  
  - Format: `{ data: [{timestamp, timeStr, energy, direction, ...}, ...] }`  
  - Use case: Daily grid balance

- **/v1/api/epm/month** → Monthly EPM aggregates  
  - Returns: Monthly energy import/export  
  - Format: Similar to epm/day but monthly  
  - Use case: Monthly billing data

- **/v1/api/epm/year** → Yearly EPM aggregates  
  - Returns: Yearly totals  
  - Format: Similar to epm/month but yearly  
  - Use case: Annual billing review

- **/v1/api/epm/all** → Lifetime EPM totals  
  - Returns: Total cumulative import/export  
  - Format: `{ data: { totalImport, totalExport, ...} }`  
  - Use case: Meter lifetime KPIs

### Ammeter (Read-only query endpoints)
- **/v1/api/ammeterList** → All current meters  
  - Returns: Paginated list of ammeters  
  - Format: `{ data: { page: {...}, records: [{id, sn, model, name, stationId, state}, ...] } }`  
  - Use case: Device inventory

- **/v1/api/ammeterDetail** → Single ammeter reading  
  - Returns: Live phase currents, frequencies, power  
  - Format: `{ data: {id, sn, iAc1, iAc2, iAc3, fac, pac, state, ...} }`  
  - Use case: Load monitoring

### Endpoints EXCLUDED from Explorer (Mutating operations - POST/PUT/DELETE semantics)
These are blocked at backend allowlist level and not exposed in UI:
- /v1/api/addStation (create new station)
- /v1/api/stationUpdate (modify station)
- /v1/api/addStationBindCollector (attach device)
- /v1/api/delCollector (remove device)
- /v1/api/addDevice (add inverter)

## 4) Security opinion
Yes, this is possible and can be secure **if strictly limited to read-only endpoints** and implemented server-side with strict controls.

**What is NOT secure:**
- direct browser calls to SolisCloud with signing material
- arbitrary endpoint path/body passthrough from UI to server
- exposing mutating endpoints (addStation, stationUpdate, delCollector, etc.)

**What IS secure (baseline required):**
1. Keep SOLIS_API_ID and SOLIS_API_SECRET server-side only (never send to browser)
2. Enforce allowlist:
   - ✅ Include only read-only query endpoints (32 endpoints)
   - ❌ Block all mutating endpoints (5 explicitly excluded: add*, update, del*)
3. Validate request payload schema per endpoint before forwarding
4. Set readonly flag on all whitelisted endpoints in config
5. Require authenticated admin user for explorer access
6. Apply per-user/IP rate limiting (not just API-level)
7. Mask sensitive fields in response if any (rare for read-only data)
8. Add audit logs: endpoint invoked + actor + timestamp + status + response code

## 5) Architecture plan

### Backend
Create a single safe proxy route:
- POST /api/solis/explore

Request:
- { endpointKey: string, params: object }

Server behavior:
- map endpointKey -> { path, paramSchema, formatterKey, readonly }
- validate params
- call solisFetch(path, params)
- return normalized response with display hints

Response:
- { ok, endpointKey, path, requestedAt, durationMs, formatted, raw }

### Frontend
Refactor current DevToolsPanel into Solis Explorer mode:
- tab: Explorer
- endpoint cards/buttons grouped by category
- dynamic parameter form for selected endpoint
- response UI:
  - summary cards (success/code/msg/latency)
  - table view for arrays
  - key-value detail view for objects
  - collapsible raw JSON viewer

No database writes. No local persistence except UI state (optional).

## 6) Rollout phases

### Phase 1: Safe MVP (read-only, most useful first)
Implement these 8 endpoints first (all verified as read-only, most frequently used):
- /v1/api/inverterList (get all inverters, paginated)
- /v1/api/inverterDetail (get live state of one inverter, full metrics)
- /v1/api/inverterMonth (get monthly energy breakdown for one inverter)
- /v1/api/inverterDay (get intraday power curve for one inverter)
- /v1/api/userStationList (get all power stations under account)
- /v1/api/stationDetail (get station summary + aggregates)
- /v1/api/stationDay (get intraday power for whole station)
- /v1/api/alarmList (get device alarms/warnings, filterable)

**Phase 1 also includes:**
- Documentation of actual Solis response shapes from live testing
- Response formatter implementations based on real data
- Confidence assessment of which other endpoints are safe to enable in Phase 2

Deliverables:
- secure proxy endpoint at `/api/solis/explore`
- allowlist config (read-only flag enforced)
- request validation per endpoint
- formatted UI renderers for: list tables, time-series line charts, detail cards
- documented actual response shapes for each MVP endpoint

### Phase 2: Wider read-only coverage
Add remaining read-only endpoint groups:
- station energy/month/year/all
- weather list/detail
- collector list/detail/day
- epm list/detail/day/month/year/all
- ammeter list/detail
- inverter year/all/shelfTime/detailList

Deliverables:
- endpoint forms generated from config
- more formatter adapters

### Phase 3: Controlled advanced operations (optional)
Mutating endpoints remain disabled by default.
Only consider enabling after explicit approval with extra safeguards:
- feature flag
- two-step confirmation
- dry-run simulation where possible
- elevated role check

## 7) Pretty formatting strategy
Each endpoint maps to a formatter profile:
- list formatter: pagination-aware table + filters
- time-series formatter: date + value chart/table
- detail formatter: grouped sections (identity, status, energy, comms)

Common transforms:
- timestamp -> local date/time
- numeric units preserved (kW, kWh, °C, V, A)
- booleans/states to badges
- null/empty values shown consistently

## 8) API endpoint config model (single source)
Use a config object in backend (and mirrored labels in UI):
- endpointKey
- path
- category
- readonly
- paramsSchema
- sampleParams
- formatterKey
- enabled

This keeps button generation and security allowlist aligned.

## 9) Acceptance criteria
1. Explorer visible only when devtools feature flag is enabled and user is authorized
2. At least 8 MVP read-only endpoints callable successfully
3. No Solis credentials exposed to browser
4. Invalid params are rejected with clear messages
5. Returned data is shown in formatted view plus optional raw JSON
6. Mutating endpoints are blocked in MVP

## 10) Risks and mitigations

Risk: Undocumented or inconsistent response shapes from live Solis API
- Mitigation: Phase 1 includes live testing of all 8 MVP endpoints; document actual vs. spec shapes; fallback renderers for unexpected structures

Risk: accidental execution of mutating operations
- Mitigation: block mutating endpoints in backend allowlist ONLY (not UI-only); deny-list approach for add*/update/del* operations

Risk: Solis API rate/availability constraints
- Mitigation: rate limiter + request timeout + retry logic + clear error messages to user

Risk: inconsistent response shapes across endpoints
- Mitigation: per-endpoint formatter mapping + generic object/array fallback renderer

Risk: security drift over time
- Mitigation: centralized endpoint config with read-only flag enforcement + audit logging + unit tests for allowlist validation

Risk: API changes break our formatters
- Mitigation: wrap formatters in try/catch, show preview of raw JSON on error, log formatter failures for debugging

## 11) Recommendation
Proceed with Phase 1 immediately.
It delivers clear user value fast (live exploratory visibility) while keeping risk low.
Then expand endpoint coverage in Phase 2 once formatting patterns are stable.

## 12) Next implementation order
1. Add endpoint config + validator layer (backend)
2. Implement /api/solis/explore secure proxy
3. Replace DevToolsPanel UI with Explorer shell
4. Add MVP endpoint buttons/forms
5. Add formatters and raw JSON toggle
6. Add auth guard + rate limit + logs
7. QA against known working endpoints (inverterList, inverterMonth)

## 13) Endpoint Response Documentation (To Be Updated Post-Testing)
During Phase 1 live testing, capture and document actual response shapes here:

### inverterList (✅ Known working in production code)
**Expected from spec:** Paginated array with { inverterStatus, records: [...], page: {...} }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** id, sn, stationId, stationName, power, eToday, eTotal, pac, state, dataTimestamp  
**Formatter:** Paginated table, sort by eToday desc, display state as badge

### inverterDetail  
**Expected from spec:** Single object with full live metrics and historical (daily/monthly/yearly)  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** id, sn, eTodayStr, eMonthStr, eYearStr, eTotalStr, pacStr, state, iAc1/2/3, uAc1/2/3, temperature  
**Formatter:** Grouped sections (identity, power metrics, energy, battery, AC/DC voltages, status)

### inverterMonth (✅ Known working in production code)  
**Expected from spec:** Array of daily records with { date, dateStr, energy, energyStr, money, moneyStr, batteryChargeEnergy, gridSellEnergy, ... }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** date, dateStr, energy, energyStr, money, moneyStr  
**Formatter:** Date-energy table, optional cost breakdown, export to CSV option

### inverterDay  
**Expected from spec:** Array of 5-min interval snapshots with { timeStr, pac, pacStr, eTodayStr, facStr, iAc1, iAc2, iAc3, ... }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** timeStr, pac, pacStr, facStr, iAc1, iAc2, iAc3, iPv1, iPv2, uPv1  
**Formatter:** Line chart (power vs. time), table with key metrics, optional zoom/filter

### userStationList  
**Expected from spec:** Paginated array with { records: [{id, stationName, addr, capacity, dayEnergy, monthEnergy, yearEnergy, allEnergy, state}, ...] }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** id, stationName, capacity, capacityStr, dayEnergy, monthEnergy, yearEnergy, state  
**Formatter:** Table with inline click-to-drill into stationDetail

### stationDetail  
**Expected from spec:** Single object with { id, stationName, addr, capacity, dayEnergy, monthEnergy, yearEnergy, allEnergy, weather: {...}, powerStationNumTree, powerStationAvoidedCo2, ... }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** stationName, addr, capacity, capacityStr, dayEnergy, monthEnergy, yearEnergy, allEnergy, state, weather conditions, environmental impact  
**Formatter:** Summary card with KPIs, weather widget, environmental impact badge

### stationDay  
**Expected from spec:** Array of power + load snapshots with { time, timeStr, power, powerStr, familyLoadPower, batteryPower, consumeEnergy, produceEnergy, ... }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** timeStr, power, powerStr, familyLoadPower, batteryPower, producedEnergy  
**Formatter:** Stacked area chart (produce vs. consume), time-based table

### alarmList  
**Expected from spec:** Paginated array with pagination + recordsArray of { stationId, stationName, alarmDeviceSn, alarmCode, alarmLevel (1/2/3), alarmBeginTime, alarmMsg, advice, state (0/1/2 = pending/processed/resolved) }  
**Actual (from live call):** [TO BE CONFIRMED]  
**Key fields:** stationName, alarmDeviceSn, alarmCode, alarmLevel, alarmMsg, advice, state  
**Formatter:** Filterable/searchable table, severity as color badge (yellow/orange/red), status filter tabs
