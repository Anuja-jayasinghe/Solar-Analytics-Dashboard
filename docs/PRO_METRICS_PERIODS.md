# Pro metrics: period and data definitions

The Pro page has separate controls because its panels answer different
questions. Every displayed date is an Asia/Colombo calendar date.

| Control | Changes | Does not change |
| --- | --- | --- |
| Uptime and alarm period: 14, 30 or 60 completed days | Uptime and stopped-time rings, unresolved alarms that **began in the selected period**, the daily uptime strip, alarm history, and period logger/alarms-known figures. | All-time daily-record completeness, electrical readings, bill rates, generation comparisons. |
| Electrical period: last day, 7 days, 30 days or custom (up to 31 completed days) | PV input current/voltage observations, separate AC phase voltages and spread, temperature, frequency and power factor. The multi-day view lists each date and its number of stored/producing samples. | Uptime, alarms, bills and generation comparison. |
| Bill-period comparison: 3, 8, 12 pairs or all | Number of complete matching bill periods shown against the previous year. | Bill-rate history and the other Pro panels. |
| Choose months | Compare any two **completed calendar months** using daily inverter energy totals. | Bill-rate history and the other Pro panels. |

“What each bill really paid” uses all available bills and has no period
selector. The all-time completeness figure is derived from stored daily totals
since the first reading. Missing daily totals remain unknown.

## Electrical availability and limits

The existing `inverter_telemetry` table stores `pv_a`, `pv_v`, `ac_v`,
`fac_hz`, `power_factor` and `temp_c` per timestamp. The existing
`telemetry?date=...` resource supplies one day. The new authenticated
`electrical?from=...&to=...` resource reads up to 31 completed days and
returns compact daily and whole-range summaries. A range can be chosen even
when storage has gaps: the response reports sample counts and marks days with
no telemetry, rather than treating them as zero-current days. The actual
coverage of a historical range must be read from the deployed database;
the SolisCloud source probe alone cannot confirm stored rows.

Electrical calculations include only timestamps with AC power above 1 kW.
PV input current is the mean over those samples; AC phase voltage and
simultaneous phase spread are medians; temperature is the highest recorded
value and frequency is the recorded minimum–maximum range. Whole-range
statistics weight dates by their number of stored producing readings. The
page states this and lists daily results because sampling density varies.
It flags dates with no stored telemetry separately from dates with telemetry
but no reading above 1 kW. The physical
string-to-input map is unknown, so no PV fault is inferred from an input's
current. Cloud phase readings require qualified onsite confirmation before
diagnosing an electrical cause.

## Alarm interpretation

The alarm table shows a plain-language meaning alongside Solis's original
message. Its expandable guide counts each code in the selected alarm period.
If the API's 500-record cap is reached, the page marks the list as incomplete,
shows code counts for returned records only, and suppresses an exact unresolved
alarm count.
Solis's published alarm list identifies grid overvoltage (`1010`), grid
undervoltage (`1011`), missing grid (`1015`) and the F017 line-to-earth check.
The `1D4C2` logger internet-loss label comes from this account's observed
SolisCloud alarm message; it is not listed in that inverter alarm reference.
Unknown codes retain their Solis message and are explicitly marked as
unmapped. References: [Solis alarm codes](https://usservice.solisinverters.com/support/solutions/articles/73000560423-solis-inverter-alarm-codes-complete-list-)
and the [dated source investigation](../diagnostics/solis/FINDINGS-2026-10-06.md).

## Month comparisons

Calendar-month comparisons use the existing authenticated `range` resource
and its `presentDays`/`daysInRange` fields. Partial month totals may be shown
for context, but a percentage change is shown only when **both months are
complete**. Calendar months may have different day counts and weather; the
comparison measures recorded energy, not inverter health or normalized yield.
The April 2025 Solis archive gap is a concrete reason to enforce completeness.
