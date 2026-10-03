# SolisCloud API: Field Catalog and Findings

**Date:** 2026-10-03 · **Issue:** #153 · **Source:** `SolisCloud Platform API Document V2.0.3.pdf`
(131 pp, 45 endpoints) plus **live read-only probes** of our own station (36 calls, all `code=0`
except two, noted below).

Method: every endpoint applicable to a single-site account was called read-only against the
real station. A hard allowlist in the probe script made it impossible to call a write endpoint.
Raw responses contain the owner, address, GPS and device identifiers, so they are **not
committed**; this catalog records field *names, types and findings* only. The probe script is
reproducible from this document (§7).

---

## 1. Headline findings

| # | Finding | Consequence |
|---|---|---|
| F1 | **`inverterDay` returns every logger upload for a day: 129 fields per point, 40 populated** (PDF documents ~25) | It is the source for the uptime log *and* for per-string, AC, temperature and frequency data |
| F2 | **History reaches back ≥ 2 years** (a day in Oct 2024 returned 148 points) | The whole uptime log can be backfilled from the inverter's installation (shelf begin 2024-08-02), not just from today |
| F3 | **Sampling cadence has changed over time**: ~1 min (Jul 2026), 5 min (now), ~18 min (Oct 2025, 41 points for the day) | Downtime detection must be **cadence-aware** per day; the minimum detectable outage differs by period (LR-002) |
| F4 | **Night produces no points at all**, not `state=2` rows. Points span ≈ 05:56–18:30 local | Downtime = missing points *inside the daylight window*; night is never downtime |
| F5 | **`timeZone` parameter has no effect** (tz 5, 5.5, 6, 8 returned byte-identical timestamps). `timeStr` is **UTC+8**, not local | Always derive local time from `dataTimestamp` (epoch ms) in Asia/Colombo. Existing code that trusts `timeStr` is off by 2.5 h |
| F6 | **199 alarms in ~3 months (since 2026-07-01), 97+ are `UN-G-V01` / code 1011, grid under-voltage**, level 1 | Real, recurring interruptions exist. This is the headline reason for the uptime log, and it points at a *grid* problem, not an inverter fault |
| F7 | **`alarmList` is paginated; `total` (199) > page (100)** | Existing explorer code reads only the first page. The collector must paginate |
| F8 | **`alarmLong` is milliseconds** (e.g. 300303 ≈ 5 min; 10 566 075 ≈ 2.9 h); latest open alarm has `state=0` (pending) with a moving end time | Treat `state=0` as ongoing; close it when `state=2` |
| F9 | **Solis stores the array size: `capacity = 41.76 kWp`**, inverter `40 kW`, tariff `price = 37` | kWh/kWp and capacity factor must use **41.76**, not the 40 kW AC rating in `system_settings` |
| F10 | `pac` unit is carried per record (`pacStr`, `pacPec`): `pac=31230`, `pacPec=0.001` → 31.23 kW | Always normalise with the unit fields; never assume kW |
| F11 | `inverterMonth/Year/All` carry **Solis-computed `money`, `energy`, `fullHour`** per day/month/year | Independent cross-check of our daily summary; `moneyStr` says "K LKR" but `money` is plain LKR (150.2 kWh × 37 = 5557.4) |
| F12 | `collector/day` gives **logger RSSI every ~5 min** (295 pts/day) and `collectorDetail` gives `dataUploadCycle`, `state`, working time | Lets us tell *inverter off* from *logger/WiFi down* (`comms_lost`) |
| F13 | `epmList`, `weatherList`, `ammeterList` return **0 records**, no such hardware | Skip. No on-site irradiance or meter data exists from Solis |
| F14 | `stationMonthEnergyList` / `stationYearEnergyList` → `I0000 The necessary parameters are empty or invalid` | Fleet endpoints; skip |
| F15 | `inverterDetail.stateExceptionFlag` = 0 (normal) and `faultCodeDesc` (e.g. `UV-G-V01`) give a human fault name | Use as the abnormal-offline discriminator and for alarm text |

## 2. Endpoint verdicts

Legend: **Used** = called by our code today · **Adopt** = add to v3 · **Skip**

| Endpoint | Records | Used today | Verdict | Why |
|---|---|---|---|---|
| `inverterList` | 1 (148 fields, 81 populated) | Yes: live fetcher | Keep | Cheap "now" status; also supplies `sn`, `id`, `stationId`, `collectorSn` |
| `inverterDetail` | 781 fields, 344 populated | Edge fn (state only) | **Adopt** | `eMonth/eYear`, `fullHour`, `inverterTemperature`, `faultCodeDesc`, `pLimitSet` (power limit 110), firmware, DC bus |
| `inverterDetailList` | same as above | No | Skip | Duplicate of `inverterDetail` for one device |
| **`inverterDay`** | 146 pts/day | Explorer only | **Adopt (core)** | F1–F5. Telemetry + uptime source |
| `inverterMonth` | one row per day | Backfill script | **Adopt** | Daily energy + Solis money + full-load hours; cross-check and gap fill |
| `inverterYear` | 10 rows | No | **Adopt** | Monthly energy/money for degradation (YoY) and validation |
| `inverterAll` | 3 rows | No | **Adopt** | Yearly totals; lifetime validation against our sums |
| `inverter/shelfTime` | 1 | No | **Adopt (small)** | Warranty window (2024-08-02 → 2034-08-02) for the Pro page |
| **`alarmList`** | 199 / 3 months | Explorer (page 1 only) | **Adopt (core)** | F6–F8. Paginate; key on `alarmCode + alarmBeginTime` |
| `collectorList` | 1 (65 fields) | No | Adopt (low) | Logger model/firmware/connection operator for the health card |
| `collectorDetail` | 24 fields | No | **Adopt** | `dataUploadCycle`, `state`, uptime counters (F12) |
| **`collector/day`** | 295 pts/day | No | **Adopt** | RSSI series → `comms_lost` discrimination |
| `userStationList` / `stationDetail` / `stationDetailList` | 1 | No | **Adopt (config)** | `capacity` 41.76 kWp, `price` 37, timezone, commissioning date: seeds settings (F9) |
| `stationDay` | 146 pts | No | Skip | Same series as `inverterDay` at plant level (one inverter) |
| `stationMonth/Year/All` | 3/10/3 | No | Skip | Duplicates of `inverter*` for a single inverter |
| `stationDayEnergyList` | 1 | No | Skip | Fleet endpoint |
| `stationMonthEnergyList`, `stationYearEnergyList` | error | No | Skip | F14 |
| `epm*`, `weatherList/Detail`, `ammeterList/Detail` | 0 | No | Skip | F13 (no hardware) |
| `addStation`, `stationUpdate`, `addStationBindCollector`, `delCollector`, `addDevice` | n/a | No | **Never call** | Write endpoints. Excluded from every allowlist |

## 3. Time semantics (read before writing any collector code)

- `dataTimestamp` is epoch **milliseconds**; the only trustworthy time field.
- `timeStr` and `time` are **UTC+8** (verified: first point `08:24:58` = `00:24:58Z` = 05:54 local).
- The request `time` parameter selects a **local calendar day**: the day returned is the
  Asia/Colombo date that was asked for (verified for yesterday; both ends of the range fall on
  that date). `timeZone` is accepted but does nothing (F5), so pass `8` as documented to avoid
  schema rejection and ignore it.
- Day window observed: first point ≈ 05:56–06:06, last ≈ 18:09–18:48 local (Oct 2024 → Oct 2026).
- Duplicate protection: key telemetry on `(inverter_sn, dataTimestamp)`.

## 4. Cadence (F3), evidence

| Probe day (local) | Points | Median gap | Minimum detectable outage (≈ 2× gap) |
|---|---|---|---|
| 2024-10-03 | 148 | 5 min | ~10 min |
| 2025-04-11 | 152 | ~5 min | ~10 min |
| 2025-10-03 | **41** | ~18 min | ~36 min |
| 2026-07-05 | **468** | ~1 min | ~2 min |
| 2026-10-02 | 146 | 5 min | ~10 min |

Implication: LR-002 stores, per day, the **median interval and the resulting detection
resolution**, so a "no outages found" result on a coarse day is never presented as proof.

## 5. What is worth adding to the product (from the data we now know exists)

| Metric | Source field(s) | Page |
|---|---|---|
| Uptime %, outage timeline, down minutes | `inverterDay` gaps in daylight window | Pro + status chip |
| Fault / grid-event log with advice text | `alarmList` (`alarmCode`, `alarmMsg`, `advice`, `alarmLong`) | Pro |
| Grid-event frequency (under/over-voltage count by week) | `alarmList` code 1010/1011 | Pro: most actionable insight (F6) |
| Revenue lost to downtime | missing-interval energy estimated from neighbouring days, **labelled an estimate** | Pro |
| Per-string current/voltage balance (8 strings populated: `uPv1–8`, `iPv1–8`) | `inverterDay` | Pro: spots a failing string |
| Inverter temperature curve | `inverterTemperature` | Pro |
| Grid voltage (3-phase) & frequency | `uAc1–3`, `iAc1–3`, `fac` | Pro: ties to under-voltage trips |
| Power factor, DC bus | `powerFactor`, `dcBus`, `dcBusHalf` | Pro |
| Power-limit state | `plimitSet`, `pfactorLimitSet` (110 / 10) | Pro: detects curtailment |
| Specific yield (kWh/kWp), capacity factor | `capacity=41.76`, daily energy | Explore |
| Full-load hours | `inverterMonth.fullHour` | Explore |
| Logger signal health | `collector/day.rssi`, `collectorDetail` | Pro |
| Peak kW per day (fixes `peak_power_kw = null` on backfilled days) | `max(pac × pacPec)` | Everywhere |
| Warranty countdown | `inverter/shelfTime` | Pro |
| Solis-vs-ours energy reconciliation | `inverterMonth.energy` vs `total_generation_kwh` | Data-quality badge |

## 6. Consequences for the plan

1. **Schema (#155)**: telemetry table needs the per-string columns (8), 3-phase AC, `fac`, `pf`, temp,
   `dc_bus`, `plimit`, `pac_kw` (normalised), `e_today`, plus `raw jsonb`; alarms table needs
   `duration_ms`, `state`, `advice`, `fault_code_desc`; collector table for RSSI.
2. **Collector (#156)**: paginate `alarmList`; cadence-aware; dedupe on `dataTimestamp`;
   **full backfill is feasible**: ~790 days × (inverterDay + collector/day) at 0.7 s ≈ 35 min,
   plus alarms by month. Run as a gated, dry-run-first workflow.
3. **Settings**: seed `capacity_kwp = 41.76` (new), keep `solar_grid_capacity = 40` (AC rating).
4. **Existing bugs confirmed**: explorer `timeZone: '8'` is harmless (F5) but its day-boundary
   logic using `timeStr` is wrong; explorer alarm view misses 99 of 199 alarms (F7); its health
   score penalises the normal evening `state=2`.
5. **LR-002 (#154)** must encode F3–F5, F8, F15.

## 7. Reproducing the probe

Read-only; signs with `api/_lib/solisAuth.js` using the local `.env`. The probe allowlist is
`inverterList, inverterDetail(List), inverterDay/Month/Year/All, inverter/shelfTime, alarmList,
collectorList/Detail, collector/day, epm*, weather*, ammeter*, userStationList, stationDetail(List),
station{Day,Month,Year,All}, station*EnergyList`. Anything else throws before a request is made.
Rate: 1 call per 0.7 s (limit is 2/s). The script is committed as `scripts/solis_probe.mjs`
(values are never written to the repo).

## 8. Appendix: populated field inventory (names and types only)

`t` = type initial (n number, s string, b boolean, o object). Fields that were empty or zero in
every record are omitted; counts are in each heading.

## userStationList
code=0 · records=1 · fields=112 (81 populated, 31 always empty/zero)

```
id:s dataTimestamp:s dataTimestampStr:s fullHour:n dayPowerGeneration:n monthCarbonDioxide:n installerId:s installer:s stationName:s userId:s userEmail:s sno:s countryStr:s regionStr:s cityStr:s countyStr:s addrOrigin:s state:n dip:n timeZone:n timeZoneName:s timeZoneStr:s timeZoneStrNew:s timeZoneId:s powerStr:s price:n module:s capacity:n capacityStr:s capacity1:n picName:s pic1Url:s dayEnergy:n dayEnergyStr:s dayIncome:n monthEnergy:n monthEnergyStr:s yearEnergy:n yearEnergyStr:s allEnergy:n allEnergyStr:s allEnergy1:n allIncome:n updateDate:n shareProcess:n alarmLongStr:s alarmState:n alarmLevel:s alarmMsg:s dcInputType:n homeLoadTotalEnergy:n oneSelf:n homeLoadTodayEnergy:n oneSelfTotal:n money:s condTxtD:s condCodeD:s simFlowState:n groupId:s createDate:n createDateStr:s connectTime:n connectTimeStr:s accessTime:n accessTimeStr:s fisPowerTime:n fisPowerTimeStr:s fisGenerateTime:n fisGenerateTimeStr:s inverterCount:n alarmCount:n alarmDate:n alarmDateStr:s dayEnergy1:n batteryCapacityEnergyUnit:s monthEnergy1:n yearEnergy1:n batteryTodayChargeEnergyUnit:s batteryTodayDischargeEnergyUnit:s batteryTotalChargeEnergyUnit:s batteryTotalDischargeEnergyUnit:s
```

## stationDetail
code=0 · records=1 · fields=389 (224 populated, 165 always empty/zero)

```
id:s dataTimestamp:s fullHour:n monthCarbonDioxide:n installerId:s installer:s stationName:s userId:s userEmail:s sno:s countryStr:s regionStr:s cityStr:s countyStr:s state:n dip:n timeZone:n timeZoneName:s timeZoneStr:s timeZoneId:s powerStr:s price:n module:s capacity:n capacityStr:s picName:s dayEnergy:n dayEnergyStr:s monthEnergy:n monthEnergyStr:s yearEnergy:n yearEnergyStr:s allEnergy:n allEnergyStr:s allEnergy1:n updateDate:n shareProcess:n alarmLevel:s dcInputType:n homeLoadTotalEnergy:n homeLoadTodayEnergy:n money:s condTxtD:s condTxtN:s condCodeD:s condCodeN:s simFlowState:n groupId:s createDate:n createDateStr:s connectTime:n accessTime:n fisPowerTime:n fisPowerTimeStr:s fisGenerateTime:n fisGenerateTimeStr:s generateDays:n generateDaysContinuous:n inverterCount:n orgCode:s isJoined:b timeZoneStandardId:s fullHourStr:s capacityPec:s dipStr:s azimuthStr:s dateTime:s offsetStr:s dayInCome:n dayInComeUnit:s monthInCome:n monthInComeUnit:s yearInCome:n yearInComeUnit:s allInCome:n allInCome1:n allInComeUnit:s powerStationNumTree:n powerStationAvoidedCo2:n powerStationAvoidedTce:n powerPec:s batteryPowerStr:s batteryPowerPec:s batteryDirection:n psumStr:s psumPec:s gridPurchasedTotalEnergyStr:s gridSellTotalEnergyStr:s gridPurchasedEnergyStr:s gridSellEnergyStr:s gridPurchasedDayEnergyStr:s gridSellDayEnergyStr:s gridPurchasedMonthEnergyStr:s gridSellMonthEnergyStr:s gridPurchasedYearEnergyStr:s gridSellYearEnergyStr:s batteryDischargeEnergyStr:s batteryChargeEnergyStr:s batteryDischargeMonthEnergyStr:s batteryChargeMonthEnergyStr:s batteryDischargeYearEnergyStr:s batteryChargeYearEnergyStr:s batteryDischargeTotalEnergyStr:s batteryChargeTotalEnergyStr:s familyLoadPowerStr:s familyLoadPowerPec:s homeGridTodayEnergyStr:s homeGridMonthEnergyStr:s homeGridYearEnergyStr:s homeGridTotalEnergyStr:s backupTodayEnergyStr:s backupMonthEnergyStr:s backupYearEnergyStr:s backupTotalEnergyStr:s totalLoadPowerStr:s bypassLoadPowerStr:s homeLoadEnergy:n homeLoadEnergyStr:s homeLoadTodayEnergyStr:s homeLoadMonthEnergy:n homeLoadYearEnergy:n picUrl:s weather:s sr:s ss:s tmpMax:s tmpMin:s tmpUnit:s hum:s weatherUpdateDate:s weatherUpdateDateStr:s pcpn:s pres:s windSpd:s windDir:s screenTitle:s screenMapShow:s screenGuideState:n countryShortName:s inverterPower:n priceMap:o sysGridPriceList:o generatorPowerStr:s generatorPowerPec:s generatorTodayEnergyStr:s generatorTodayEnergyPec:s generatorMonthEnergyStr:s generatorMonthEnergyPec:s generatorYearEnergyStr:s generatorYearEnergyPec:s generatorTotalEnergyStr:s generatorTotalEnergyPec:s doubleAmmeterStorageDayEnergy:n backup2PowerStr:s acCoupledPowerStr:s backup2TodayEnergyStr:s backup2MonthEnergyStr:s backup2YearEnergyStr:s backup2TotalEnergyStr:s acCoupledTodayEnergyStr:s acCoupledMonthEnergyStr:s acCoupledYearEnergyStr:s acCoupledTotalEnergyStr:s parallelOnoffValid:b touscdVersion:n extraInfo:s dnspRegisterFlag:b showLfdiSfdi:b touscdPageVersion:n firstOldBatterySn:s sscCurrentFlowMap:o currentFlowMapV3:o industryCurrentFlowMapV2:o industryCurrentFlowMapGplot:o energyUnit:s batteryCapacityEnergyUnit:s homeLoadMonthEnergyStr:s homeLoadYearEnergyStr:s homeLoadTotalEnergyStr:s batteryTodayChargeEnergyUnit:s batteryTodayDischargeEnergyUnit:s batteryTotalChargeEnergyUnit:s batteryTotalDischargeEnergyUnit:s inverterPowerStr:s hybridInverterPowerStr:s chargerPowerStr:s totalAndSmartLoadPowerStr:s powerStrV2:s pvAndAcCoupledPowerStr:s psumStrV2:s batteryPowerStrV2:s familyLoadPowerStrV2:s generatorPowerStrV2:s generatorTodayEnergyUnitV2:s powerAmmeter2Str:s powerAmmeter2Pec:s dayEnergyAmmeter2Str:s dayEnergyAmmeter2Pec:s monthEnergyAmmeter2Str:s monthEnergyAmmeter2Pec:s yearEnergyAmmeter2Str:s yearEnergyAmmeter2Pec:s totalEnergyAmmeter2Str:s totalEnergyAmmeter2Pec:s doubleAmmeterStoragePowerStr:s doubleAmmeterStoragePowerPec:s doubleAmmeterStorageDayEnergyStr:s doubleAmmeterStorageDayEnergyPec:s batteryCapacityEnergyStr:s batteryCapacityStr:s inverterBatteryCapacityStr:s pvStorageGridInvPowerStr:s notPvStorageGridInvPowerStr:s hybridPowerStr:s powerStorageStr:s pvStorageGridInvTodayEnergyStr:s dayEnergyStorageStr:s pvStorageGridInvMonthEnergyStr:s pvStorageGridInvYearEnergyStr:s pvStorageGridInvTotalEnergyStr:s compatibleCityStr:s acCoupledAllTodayEnergyStr:s acCoupledAllMonthEnergyStr:s acCoupledAllTotalEnergyStr:s
```

## stationDetailList
code=0 · records=1 · fields=388 (224 populated, 164 always empty/zero)

```
id:s dataTimestamp:s fullHour:n monthCarbonDioxide:n installerId:s installer:s stationName:s userId:s userEmail:s sno:s countryStr:s regionStr:s cityStr:s countyStr:s state:n dip:n timeZone:n timeZoneName:s timeZoneStr:s timeZoneId:s powerStr:s price:n module:s capacity:n capacityStr:s picName:s dayEnergy:n dayEnergyStr:s monthEnergy:n monthEnergyStr:s yearEnergy:n yearEnergyStr:s allEnergy:n allEnergyStr:s allEnergy1:n updateDate:n shareProcess:n alarmLevel:s dcInputType:n homeLoadTotalEnergy:n homeLoadTodayEnergy:n money:s condTxtD:s condTxtN:s condCodeD:s condCodeN:s simFlowState:n groupId:s createDate:n createDateStr:s connectTime:n accessTime:n fisPowerTime:n fisPowerTimeStr:s fisGenerateTime:n fisGenerateTimeStr:s generateDays:n generateDaysContinuous:n inverterCount:n orgCode:s isJoined:b timeZoneStandardId:s fullHourStr:s capacityPec:s dipStr:s azimuthStr:s dateTime:s offsetStr:s dayInCome:n dayInComeUnit:s monthInCome:n monthInComeUnit:s yearInCome:n yearInComeUnit:s allInCome:n allInCome1:n allInComeUnit:s powerStationNumTree:n powerStationAvoidedCo2:n powerStationAvoidedTce:n powerPec:s batteryPowerStr:s batteryPowerPec:s batteryDirection:n psumStr:s psumPec:s gridPurchasedTotalEnergyStr:s gridSellTotalEnergyStr:s gridPurchasedEnergyStr:s gridSellEnergyStr:s gridPurchasedDayEnergyStr:s gridSellDayEnergyStr:s gridPurchasedMonthEnergyStr:s gridSellMonthEnergyStr:s gridPurchasedYearEnergyStr:s gridSellYearEnergyStr:s batteryDischargeEnergyStr:s batteryChargeEnergyStr:s batteryDischargeMonthEnergyStr:s batteryChargeMonthEnergyStr:s batteryDischargeYearEnergyStr:s batteryChargeYearEnergyStr:s batteryDischargeTotalEnergyStr:s batteryChargeTotalEnergyStr:s familyLoadPowerStr:s familyLoadPowerPec:s homeGridTodayEnergyStr:s homeGridMonthEnergyStr:s homeGridYearEnergyStr:s homeGridTotalEnergyStr:s backupTodayEnergyStr:s backupMonthEnergyStr:s backupYearEnergyStr:s backupTotalEnergyStr:s totalLoadPowerStr:s bypassLoadPowerStr:s homeLoadEnergy:n homeLoadEnergyStr:s homeLoadTodayEnergyStr:s homeLoadMonthEnergy:n homeLoadYearEnergy:n picUrl:s weather:s sr:s ss:s tmpMax:s tmpMin:s tmpUnit:s hum:s weatherUpdateDate:s weatherUpdateDateStr:s pcpn:s pres:s windSpd:s windDir:s screenTitle:s screenMapShow:s screenGuideState:n countryShortName:s inverterPower:n priceMap:o sysGridPriceList:o generatorPowerStr:s generatorPowerPec:s generatorTodayEnergyStr:s generatorTodayEnergyPec:s generatorMonthEnergyStr:s generatorMonthEnergyPec:s generatorYearEnergyStr:s generatorYearEnergyPec:s generatorTotalEnergyStr:s generatorTotalEnergyPec:s doubleAmmeterStorageDayEnergy:n backup2PowerStr:s acCoupledPowerStr:s backup2TodayEnergyStr:s backup2MonthEnergyStr:s backup2YearEnergyStr:s backup2TotalEnergyStr:s acCoupledTodayEnergyStr:s acCoupledMonthEnergyStr:s acCoupledYearEnergyStr:s acCoupledTotalEnergyStr:s parallelOnoffValid:b touscdVersion:n extraInfo:s dnspRegisterFlag:b showLfdiSfdi:b touscdPageVersion:n firstOldBatterySn:s sscCurrentFlowMap:o currentFlowMapV3:o industryCurrentFlowMapV2:o industryCurrentFlowMapGplot:o energyUnit:s batteryCapacityEnergyUnit:s inverterPowerStr:s hybridInverterPowerStr:s chargerPowerStr:s totalAndSmartLoadPowerStr:s powerStrV2:s pvAndAcCoupledPowerStr:s psumStrV2:s batteryPowerStrV2:s familyLoadPowerStrV2:s generatorPowerStrV2:s generatorTodayEnergyUnitV2:s powerAmmeter2Str:s powerAmmeter2Pec:s dayEnergyAmmeter2Str:s dayEnergyAmmeter2Pec:s monthEnergyAmmeter2Str:s monthEnergyAmmeter2Pec:s yearEnergyAmmeter2Str:s yearEnergyAmmeter2Pec:s totalEnergyAmmeter2Str:s totalEnergyAmmeter2Pec:s doubleAmmeterStoragePowerStr:s doubleAmmeterStoragePowerPec:s doubleAmmeterStorageDayEnergyStr:s doubleAmmeterStorageDayEnergyPec:s batteryCapacityEnergyStr:s batteryCapacityStr:s inverterBatteryCapacityStr:s pvStorageGridInvPowerStr:s notPvStorageGridInvPowerStr:s hybridPowerStr:s powerStorageStr:s pvStorageGridInvTodayEnergyStr:s dayEnergyStorageStr:s pvStorageGridInvMonthEnergyStr:s pvStorageGridInvYearEnergyStr:s pvStorageGridInvTotalEnergyStr:s compatibleCityStr:s acCoupledAllTodayEnergyStr:s acCoupledAllMonthEnergyStr:s acCoupledAllTotalEnergyStr:s batteryTodayChargeEnergyUnit:s batteryTodayDischargeEnergyUnit:s batteryTotalChargeEnergyUnit:s batteryTotalDischargeEnergyUnit:s homeLoadMonthEnergyStr:s homeLoadYearEnergyStr:s homeLoadTotalEnergyStr:s
```

## inverterList
code=0 · records=1 · fields=148 (81 populated, 67 always empty/zero)

```
id:s sn:s collectorSn:s userId:s productModel:s model:s nationalStandards:s inverterSoftwareVersion:s inverterSoftwareVersion2:s dcInputType:n dcInputTypeMppt:n acOutputType:n inverterSeries:s stationName:s stationId:s tag:s rs485ComAddr:s simFlowState:n power:n power1:n powerStr:s powerPercentStr:s pacStr:s state:n alarmLevel:n ivSupport:n fullHour:n totalFullHour:n maxDcBusTime:s maxUac:n maxUacTime:s maxUpv:n maxUpvTime:s timeZone:n timeZoneStr:s timeZoneStrNew:s timeZoneName:s dataTimestamp:s dataTimestampStr:s fisTime:s fisTimeStr:s fisGenerateTime:n fisGenerateTimeStr:s inverterMeterModel:n updateShelfBeginTime:n updateShelfEndTime:n updateShelfEndTimeStr:s updateShelfTime:s machine:s collectorId:s dispersionRate:n currentState:s gridPurchasedTodayEnergyStr:s gridSellTodayEnergyStr:s psumCalPec:s batteryPowerStr:s batteryPowerPec:s batteryTodayChargeEnergyStr:s batteryTotalChargeEnergyStr:s batteryTodayDischargeEnergyStr:s batteryTotalDischargeEnergyStr:s bypassLoadPowerStr:s backupTodayEnergyStr:s backupTotalEnergyStr:s familyLoadPowerStr:s totalLoadPowerStr:s homeLoadTodayEnergyStr:s rfState:n picUrl:s isESV2:b etodayStr:s psumCalStr:s inverterSn:s etoday:n inverterId:s etotalStr:s psumStr:s etotal:n etoday1:n etotal1:n offlineLongStr:s
```

## inverterDetail
code=0 · records=1 · fields=781 (344 populated, 437 always empty/zero)

```
chartAllParams:s id:s userId:s sn:s inverterMeterModel:n collectorsn:s collectorId:s state:n alarmLevel:n collectorState:n collectorModel:s simFlowState:n simErrorDayConfig:n simNoticeDayConfig:n fullHour:n fullHourStr:s currentState:s alarmState:n warningInfoData:n shelfBeginTime:n shelfEndTime:n updateShelfEndTime:n updateShelfEndTimeStr:s timeZone:n timeZoneStr:s timeZoneStandardId:s model:s productModel:s ctrlCommand:n nationalStandards:s nationalStandardstr:s inverterTemperature:n inverterTemperatureUnit:s inverterTemperatureUnit2:s temp:n tempName:s stationName:s stationCreateDate:n sno:s money:s stationId:s version:s version2:s acOutputType:n dcInputtype:n rs485ComAddr:s rs485addr:s dataTimestamp:s timeStr:s tag:s uInitGndStr:s dcBus:n dcBusStr:s dcBusHalf:n dcBusHalfStr:s power:n powerStr:s powerPec:s pacStr:s pacPec:s eToday:n eTodayStr:s eMonth:n eMonthStr:s eYear:n eYearStr:s eTotal:n eTotalStr:s dayInCome:n monthInCome:n yearInCome:n allInCome:n uPv1:n uPv1Str:s iPv1Str:s uPv2:n uPv2Str:s iPv2Str:s uPv3:n uPv3Str:s iPv3Str:s uPv4:n uPv4Str:s iPv4Str:s uPv5:n uPv5Str:s iPv5Str:s uPv6:n uPv6Str:s iPv6Str:s uPv7Str:s iPv7Str:s uPv8Str:s iPv8Str:s uPv9Str:s iPv9Str:s uPv10Str:s iPv10Str:s uPv11Str:s iPv11Str:s uPv12Str:s iPv12Str:s uPv13Str:s iPv13Str:s uPv14Str:s iPv14Str:s uPv15Str:s iPv15Str:s uPv16Str:s iPv16Str:s uPv17Str:s iPv17Str:s uPv18Str:s iPv18Str:s uPv19Str:s iPv19Str:s uPv20Str:s iPv20Str:s uPv21Str:s iPv21Str:s uPv22Str:s iPv22Str:s uPv23Str:s iPv23Str:s uPv24Str:s iPv24Str:s uPv25Str:s iPv25Str:s uPv26Str:s iPv26Str:s uPv27Str:s iPv27Str:s uPv28Str:s iPv28Str:s uPv29Str:s iPv29Str:s uPv30Str:s iPv30Str:s uPv31Str:s iPv31Str:s uPv32Str:s iPv32Str:s pow1Str:s pow2Str:s pow3Str:s pow4Str:s pow5Str:s pow6Str:s pow7Str:s pow8Str:s pow9Str:s pow10Str:s pow11Str:s pow12Str:s pow13Str:s pow14Str:s pow15Str:s pow16Str:s pow17Str:s pow18Str:s pow19Str:s pow20Str:s pow21Str:s pow22Str:s pow23Str:s pow24Str:s pow25Str:s pow26Str:s pow27Str:s pow28Str:s pow29Str:s pow30Str:s pow31Str:s pow32Str:s uAc1:n uAc1Str:s iAc1Str:s uAc2:n uAc2Str:s iAc2Str:s uAc3:n uAc3Str:s iAc3Str:s batteryDischargeEnergyStr:s batteryChargeEnergyStr:s homeLoadEnergyStr:s gridPurchasedEnergyStr:s gridSellEnergyStr:s fac:n facStr:s batteryPowerStr:s batteryPowerPec:s storageBatteryVoltageStr:s storageBatteryCurrentStr:s batteryVoltageStr:s bstteryCurrentStr:s batteryPowerBmsStr:s batteryChargingCurrentStr:s batteryDischargeLimitingStr:s batteryTotalChargeEnergyStr:s batteryTodayChargeEnergyStr:s batteryMonthChargeEnergyStr:s batteryYearChargeEnergyStr:s batteryYesterdayChargeEnergyStr:s batteryTotalDischargeEnergyStr:s batteryTodayDischargeEnergyStr:s batteryMonthDischargeEnergyStr:s batteryYearDischargeEnergyStr:s batteryYesterdayDischargeEnergyStr:s gridPurchasedTotalEnergyStr:s gridPurchasedYearEnergyStr:s gridPurchasedMonthEnergyStr:s gridPurchasedTodayEnergyStr:s gridPurchasedYesterdayEnergyStr:s gridSellTotalEnergyStr:s gridSellYearEnergyStr:s gridSellMonthEnergyStr:s gridSellTodayEnergyStr:s gridSellYesterdayEnergyStr:s homeLoadTodayEnergyStr:s homeLoadMonthEnergyStr:s homeLoadYearEnergyStr:s homeLoadTotalEnergyStr:s totalLoadPowerStr:s homeLoadYesterdayEnergyStr:s familyLoadPowerStr:s homeGridYesterdayEnergyStr:s homeGridTodayEnergyStr:s homeGridMonthEnergyStr:s homeGridYearEnergyStr:s homeGridTotalEnergyStr:s bypassLoadPowerStr:s backupYesterdayEnergyStr:s backupTodayEnergyStr:s backupMonthEnergyStr:s backupYearEnergyStr:s backupTotalEnergyStr:s pLimitSet:n pFactorLimitSet:n batteryType:s pEpmSetStr:s epmSafe:n pEpmStr:s psumCalPec:s dispersionRate:n sirRealtime:n upvTotal:n upvTotalStr:s ipvTotalStr:s powTotalStr:s isShow:b generatorPowerStr:s generatorPowerPec:s generatorTodayEnergyStr:s generatorTodayEnergyPec:s generatorMonthEnergyStr:s generatorMonthEnergyPec:s generatorYearEnergyStr:s generatorYearEnergyPec:s generatorTotalEnergyStr:s generatorTotalEnergyPec:s generatorWarningMsg:s pvShow:n mpptShow:n mpptUpv1:n mpptUpv2:n mpptUpv3:n dcInputTypeMppt:n afciTypeStr:s fisTimeStr:s fisGenerateTime:n fisGenerateTimeStr:s outDateStr:s g100v2State:n faultCodeDesc:s machine:s backupLookedPowerStr:s batteryList:o batteries:o batteryJump:o backup2PowerStr:s backup2LookedPowerStr:s backup2TodayEnergyStr:s backup2MonthEnergyStr:s backup2YearEnergyStr:s backup2TotalEnergyStr:s acCoupledTodayEnergyStr:s acCoupledMonthEnergyStr:s acCoupledYearEnergyStr:s acCoupledTotalEnergyStr:s hmiVersionAll:s dspmVersionAll:s dspsVersionAll:s hmilcdVersionAll:s cpldVersionAll:s sphVersionAll:s afciVersionAll:s humanMachineParam:o dataTimestampStr:s isESV2:b invType35000:n existEpm:b isSupportReadHisEnergy:n readHisEnergyTimeOut:s afciSAT:n showNationalStandard:n bypassState:n picUrl:s belongAllInOneMachine:b outputType:n allEnergyOriginal:n ammeter2SellTodayEnergyStr:s sscCurrentFlowMap:o industryCurrentFlowMapV2:o batteryTotalDischargeEnergyDeviceUploadStr:s homeGridTotalEnergyDeviceUploadStr:s acCoupledTotalEnergyDeviceUploadStr:s totalAndSmartLoadPowerStr:s pvAndAcCoupledPowerStr:s psumStrV2:s batteryPowerStrV2:s familyLoadPowerPec:s familyLoadPowerStrV2:s generatorPowerStrV2:s generatorTodayEnergyUnitV2:s acCoupledPowerStr:s batteryDirection:n psumStr:s psumCalStr:s backupTotalEnergyDeviceUploadStr:s backup2TotalEnergyDeviceUploadStr:s gridSellTotalEnergyDeviceUploadStr:s reactivePowerStr:s ammeter2PowerStr:s batteryTodayChargeEnergyUnit:s batteryTodayDischargeEnergyUnit:s homeLoadTotalEnergyDeviceUploadStr:s generatorTotalEnergyDeviceUploadStr:s apparentPowerStr:s ammeter2PurchasedTodayEnergyStr:s eTotalDeviceUploadStr:s gridPurchasedTotalEnergyDeviceUploadStr:s dcPacStr:s batteryTotalChargeEnergyDeviceUploadStr:s
```

## inverterDetailList
code=0 · records=1 · fields=781 (344 populated, 437 always empty/zero)

```
chartAllParams:s id:s userId:s sn:s inverterMeterModel:n collectorsn:s collectorId:s state:n alarmLevel:n collectorState:n collectorModel:s simFlowState:n simErrorDayConfig:n simNoticeDayConfig:n fullHour:n fullHourStr:s currentState:s alarmState:n warningInfoData:n shelfBeginTime:n shelfEndTime:n updateShelfEndTime:n updateShelfEndTimeStr:s timeZone:n timeZoneStr:s timeZoneStandardId:s model:s productModel:s ctrlCommand:n nationalStandards:s nationalStandardstr:s inverterTemperature:n inverterTemperatureUnit:s inverterTemperatureUnit2:s temp:n tempName:s stationName:s stationCreateDate:n sno:s money:s stationId:s version:s version2:s acOutputType:n dcInputtype:n rs485ComAddr:s rs485addr:s dataTimestamp:s timeStr:s tag:s uInitGndStr:s dcBus:n dcBusStr:s dcBusHalf:n dcBusHalfStr:s power:n powerStr:s powerPec:s pacStr:s pacPec:s eToday:n eTodayStr:s eMonth:n eMonthStr:s eYear:n eYearStr:s eTotal:n eTotalStr:s dayInCome:n monthInCome:n yearInCome:n allInCome:n uPv1:n uPv1Str:s iPv1Str:s uPv2:n uPv2Str:s iPv2Str:s uPv3:n uPv3Str:s iPv3Str:s uPv4:n uPv4Str:s iPv4Str:s uPv5:n uPv5Str:s iPv5Str:s uPv6:n uPv6Str:s iPv6Str:s uPv7Str:s iPv7Str:s uPv8Str:s iPv8Str:s uPv9Str:s iPv9Str:s uPv10Str:s iPv10Str:s uPv11Str:s iPv11Str:s uPv12Str:s iPv12Str:s uPv13Str:s iPv13Str:s uPv14Str:s iPv14Str:s uPv15Str:s iPv15Str:s uPv16Str:s iPv16Str:s uPv17Str:s iPv17Str:s uPv18Str:s iPv18Str:s uPv19Str:s iPv19Str:s uPv20Str:s iPv20Str:s uPv21Str:s iPv21Str:s uPv22Str:s iPv22Str:s uPv23Str:s iPv23Str:s uPv24Str:s iPv24Str:s uPv25Str:s iPv25Str:s uPv26Str:s iPv26Str:s uPv27Str:s iPv27Str:s uPv28Str:s iPv28Str:s uPv29Str:s iPv29Str:s uPv30Str:s iPv30Str:s uPv31Str:s iPv31Str:s uPv32Str:s iPv32Str:s pow1Str:s pow2Str:s pow3Str:s pow4Str:s pow5Str:s pow6Str:s pow7Str:s pow8Str:s pow9Str:s pow10Str:s pow11Str:s pow12Str:s pow13Str:s pow14Str:s pow15Str:s pow16Str:s pow17Str:s pow18Str:s pow19Str:s pow20Str:s pow21Str:s pow22Str:s pow23Str:s pow24Str:s pow25Str:s pow26Str:s pow27Str:s pow28Str:s pow29Str:s pow30Str:s pow31Str:s pow32Str:s uAc1:n uAc1Str:s iAc1Str:s uAc2:n uAc2Str:s iAc2Str:s uAc3:n uAc3Str:s iAc3Str:s batteryDischargeEnergyStr:s batteryChargeEnergyStr:s homeLoadEnergyStr:s gridPurchasedEnergyStr:s gridSellEnergyStr:s fac:n facStr:s batteryPowerStr:s batteryPowerPec:s storageBatteryVoltageStr:s storageBatteryCurrentStr:s batteryVoltageStr:s bstteryCurrentStr:s batteryPowerBmsStr:s batteryChargingCurrentStr:s batteryDischargeLimitingStr:s batteryTotalChargeEnergyStr:s batteryTodayChargeEnergyStr:s batteryMonthChargeEnergyStr:s batteryYearChargeEnergyStr:s batteryYesterdayChargeEnergyStr:s batteryTotalDischargeEnergyStr:s batteryTodayDischargeEnergyStr:s batteryMonthDischargeEnergyStr:s batteryYearDischargeEnergyStr:s batteryYesterdayDischargeEnergyStr:s gridPurchasedTotalEnergyStr:s gridPurchasedYearEnergyStr:s gridPurchasedMonthEnergyStr:s gridPurchasedTodayEnergyStr:s gridPurchasedYesterdayEnergyStr:s gridSellTotalEnergyStr:s gridSellYearEnergyStr:s gridSellMonthEnergyStr:s gridSellTodayEnergyStr:s gridSellYesterdayEnergyStr:s homeLoadTodayEnergyStr:s homeLoadMonthEnergyStr:s homeLoadYearEnergyStr:s homeLoadTotalEnergyStr:s totalLoadPowerStr:s homeLoadYesterdayEnergyStr:s familyLoadPowerStr:s homeGridYesterdayEnergyStr:s homeGridTodayEnergyStr:s homeGridMonthEnergyStr:s homeGridYearEnergyStr:s homeGridTotalEnergyStr:s bypassLoadPowerStr:s backupYesterdayEnergyStr:s backupTodayEnergyStr:s backupMonthEnergyStr:s backupYearEnergyStr:s backupTotalEnergyStr:s pLimitSet:n pFactorLimitSet:n batteryType:s pEpmSetStr:s epmSafe:n pEpmStr:s psumCalPec:s dispersionRate:n sirRealtime:n upvTotal:n upvTotalStr:s ipvTotalStr:s powTotalStr:s isShow:b generatorPowerStr:s generatorPowerPec:s generatorTodayEnergyStr:s generatorTodayEnergyPec:s generatorMonthEnergyStr:s generatorMonthEnergyPec:s generatorYearEnergyStr:s generatorYearEnergyPec:s generatorTotalEnergyStr:s generatorTotalEnergyPec:s generatorWarningMsg:s pvShow:n mpptShow:n mpptUpv1:n mpptUpv2:n mpptUpv3:n dcInputTypeMppt:n afciTypeStr:s fisTimeStr:s fisGenerateTime:n fisGenerateTimeStr:s outDateStr:s g100v2State:n faultCodeDesc:s machine:s backupLookedPowerStr:s batteryList:o batteries:o batteryJump:o backup2PowerStr:s backup2LookedPowerStr:s backup2TodayEnergyStr:s backup2MonthEnergyStr:s backup2YearEnergyStr:s backup2TotalEnergyStr:s acCoupledTodayEnergyStr:s acCoupledMonthEnergyStr:s acCoupledYearEnergyStr:s acCoupledTotalEnergyStr:s hmiVersionAll:s dspmVersionAll:s dspsVersionAll:s hmilcdVersionAll:s cpldVersionAll:s sphVersionAll:s afciVersionAll:s humanMachineParam:o dataTimestampStr:s isESV2:b invType35000:n existEpm:b isSupportReadHisEnergy:n readHisEnergyTimeOut:s afciSAT:n showNationalStandard:n bypassState:n picUrl:s belongAllInOneMachine:b outputType:n psumStr:s psumCalStr:s homeGridTotalEnergyDeviceUploadStr:s generatorTotalEnergyDeviceUploadStr:s allEnergyOriginal:n apparentPowerStr:s reactivePowerStr:s ammeter2PowerStr:s ammeter2PurchasedTodayEnergyStr:s ammeter2SellTodayEnergyStr:s eTotalDeviceUploadStr:s acCoupledTotalEnergyDeviceUploadStr:s backupTotalEnergyDeviceUploadStr:s batteryTotalChargeEnergyDeviceUploadStr:s batteryTotalDischargeEnergyDeviceUploadStr:s gridPurchasedTotalEnergyDeviceUploadStr:s dcPacStr:s gridSellTotalEnergyDeviceUploadStr:s homeLoadTotalEnergyDeviceUploadStr:s sscCurrentFlowMap:o industryCurrentFlowMapV2:o totalAndSmartLoadPowerStr:s pvAndAcCoupledPowerStr:s psumStrV2:s batteryPowerStrV2:s familyLoadPowerPec:s familyLoadPowerStrV2:s generatorPowerStrV2:s generatorTodayEnergyUnitV2:s acCoupledPowerStr:s batteryDirection:n batteryTodayChargeEnergyUnit:s batteryTodayDischargeEnergyUnit:s backup2TotalEnergyDeviceUploadStr:s
```

## inverterDay_tz8
code=0 · records=146 · fields=129 (40 populated, 89 always empty/zero)

```
dataTimestamp:s timeStr:s acOutputType:n dcInputType:n state:n time:s pac:n pacStr:s pacPec:s eToday:n eTotal:n uPv1:n iPv1:n uPv2:n iPv2:n uPv3:n iPv3:n uPv4:n iPv4:n uPv5:n iPv5:n uPv6:n iPv6:n uPv7:n uPv8:n iPv8:n uAc1:n iAc1:n inverterTemperature:n powerFactor:n uAc2:n iAc2:n uAc3:n iAc3:n fac:n dcBus:n dcBusHalf:n timeZone:n plimitSet:n pfactorLimitSet:n
```

## inverterMonth
code=0 · records=3 · fields=46 (15 populated, 31 always empty/zero)

```
inverterId:s id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n date:n dateStr:s timeZone:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b
```

## inverterYear
code=0 · records=10 · fields=46 (15 populated, 31 always empty/zero)

```
inverterId:s id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n date:n dateStr:s timeZone:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b
```

## inverterAll
code=0 · records=3 · fields=46 (15 populated, 31 always empty/zero)

```
inverterId:s id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n dateStr:s year:n timeZone:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b
```

## inverter_shelfTime
code=0 · records=1 · fields=12 (8 populated, 4 always empty/zero)

```
id:s sn:s machine:s shelfBeginTime:n updateShelfBeginTimeStr:s shelfEndTime:n updateShelfEndTimeStr:s shelfTime:n
```

## alarmList_365d
code=0 · records=100 · fields=35 (27 populated, 8 always empty/zero)

```
id:s pk:s stationId:s alarmDeviceSn:s alarmDeviceId:s stationName:s alarmDeviceType:s alarmLevel:s alarmCode:s alarmBeginTime:n alarmEndTime:n alarmLong:s state:s advice:s alarmMsg:s model:s machine:s warningInfoData:n countryId:s countryStr:s regionId:s regionStr:s cityId:s cityStr:s countyStr:s eTodayStr:s theoryEnergyStr:s
```

## collectorList
code=0 · records=1 · fields=65 (54 populated, 11 always empty/zero)

```
id:s userId:s sn:s stationId:s state:n gprsPackage:s simFlowState:n model:s runingTime:s currentWorkingTime:s totalWorkingTime:s dataUploadCycle:s factoryTime:s dataTimestamp:s dataTimestampStr:s stationName:s rssiLevel:n rssi:n code:s collectorActiveDate:n outDate:n outDateStr:s monitorCode:s monitorName:s monitorModel:s dataloggerModel:n connectionOperator:s countryStr:s regionId:n regionStr:s cityId:n cityStr:s countyStr:s addr:s buildAddr:s timeZone:n timeZoneStr:s timeZoneName:s shelfTime:n shelfBeginTime:n shelfBeginTimeStr:s shelfEndTime:n shelfEndTimeStr:s updateShelfTime:n updateShelfBeginTime:n updateShelfBeginTimeStr:s updateShelfEndTime:n updateShelfEndTimeStr:s version:s tag:s fisTime:s machine:s picUrl:s recentChangeType:n
```

## collectorDetail
code=0 · records=1 · fields=24 (22 populated, 2 always empty/zero)

```
id:s sn:s userId:s model:s stationName:s stationId:s version:s actualNumber:n maximumNumber:n connectionOperator:s state:n factoryTime:s dataUploadCycle:n currentWorkingTime:s totalWorkingTime:s gprsPackage:s dataTimestamp:s rssiLevel:n rssi:n timeZone:n timeZoneStr:s collectorMode:n
```

## collector_day
code=0 · records=295 · fields=11 (8 populated, 3 always empty/zero)

```
dataTimestamp:s timeStr:s collectorId:s collectorSn:s rssiLevel:n rssi:n pec:n collectorMode:n
```

## stationDay
code=0 · records=146 · fields=24 (11 populated, 13 always empty/zero)

```
oneSelf:n consumeEnergy:n produceEnergy:n time:n timeStr:s moneyStr:s moneyPec:s power:n powerStr:s powerPec:s timeZone:n
```

## stationMonth
code=0 · records=3 · fields=49 (18 populated, 31 always empty/zero)

```
id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n condCodeD:s date:n dateStr:s timeZone:n homeLoadEnergy:n oneSelf:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b totalAndSmartLoadEnergy:n
```

## stationYear
code=0 · records=10 · fields=48 (17 populated, 31 always empty/zero)

```
id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n date:n dateStr:s timeZone:n homeLoadEnergy:n oneSelf:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b totalAndSmartLoadEnergy:n
```

## stationAll
code=0 · records=3 · fields=48 (17 populated, 31 always empty/zero)

```
id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n dateStr:s year:n timeZone:n homeLoadEnergy:n oneSelf:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b totalAndSmartLoadEnergy:n
```

## stationDayEnergyList
code=0 · records=1 · fields=50 (19 populated, 31 always empty/zero)

```
id:s money:n moneyStr:s moneyPec:s energy:n energyStr:s energyPec:s fullHour:n condCodeD:s date:n dateStr:s timeZone:n homeLoadEnergy:n oneSelf:n chain:n isEnergyStorage:b pvAndAcCoupledEnergy:n showIncomeInfo:b totalAndSmartLoadEnergy:n
```

## stationMonthEnergyList
code=I0000 · records=0 · fields=0 (0 populated, 0 always empty/zero)

```

```

## stationYearEnergyList
code=I0000 · records=0 · fields=0 (0 populated, 0 always empty/zero)

```

```

