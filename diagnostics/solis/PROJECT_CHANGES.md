# Project changes from the 2026-10-06 Solis investigation

The dated [findings](FINDINGS-2026-10-06.md) contain the evidence and limits.
The [endpoint matrix](ENDPOINTS.md) records which vendor calls were tested.
No raw response, credential, device identifier, owner information or location
belongs in Git.

## Implemented in this branch

| Area | Change | Reason |
| --- | --- | --- |
| Pro electrical card | Show PV input current and reported voltage without an eight-input deviation warning. Label positions as PV inputs rather than verified strings. | Occupied inputs and physical string wiring are unknown; a low-current position can be unused. |
| Pro AC display | Show the three reported AC phase-voltage medians and the median simultaneous phase spread, instead of one blended voltage. | The observed spread was hidden by the average. The UI does not diagnose its cause. |
| Pro scope | Say explicitly that the electrical card uses the latest completed day and the range selector applies to uptime and alarms. | Prevent an apparent 14/30/60-day selection from being interpreted as a multi-day electrical assessment. |
| API evidence | Add read-only, allowlisted probe and private-response workflow under `diagnostics/solis/`. | Reproduce live contract checks without changing the collector or database. |
| Documentation | Link the dated report from the README, put an interpretation update on the older field catalog, and add PV/AC and historical-gap procedures to the runbook. | Keep the original catalog as an audit trail while correcting its health interpretation. |

## Pro metrics follow-up

The [period and data guide](../../docs/PRO_METRICS_PERIODS.md) records the
contract for the new controls and distinguishes data availability from health
interpretation.

| Area | Change | Evidence and limit |
| --- | --- | --- |
| Period clarity | Identify exactly which panels the 14/30/60-day selector changes. Give electrical readings and generation comparisons independent controls. | The API returns range-tagged uptime and alarms; the UI rejects stale responses when the selected range changes. |
| Alarm codes | Show verified plain-language meanings and an expandable code guide alongside the original Solis message. | The dated investigation and Solis alarm reference support the listed mappings. Unmapped codes stay unmapped. The API caps returned alarms at 500, so a truncated list cannot give an exact unresolved count. |
| Electrical history | Add a server-side summary resource for up to 31 completed days of stored telemetry, with last day, 7-day, 30-day and custom controls. Show daily coverage, PV input current and voltage, AC phase values and spread, temperature, frequency and power factor. | The existing `inverter_telemetry` columns provide these readings. Missing stored days remain unknown. The feature cannot identify a physical string fault without the wiring map. |
| Generation comparison | Let the user select 3, 8, 12 or all matching bill-period pairs, or any two completed calendar months. | The existing `range` resource supplies daily energy totals and completeness. Percentage comparison requires every day in both chosen months; weather and month length remain confounders. |

## Open checks before further product logic

1. **Stored-data reconciliation:** With an authorized dashboard viewer session,
   compare `/api/data/telemetry` for selected timestamps against the private
   raw Solis responses. Check `/api/data/totals` and `/api/data/range` for
   April 14–21, 2025. Confirm whether missing dates are absent/unknown and
   whether relevant billing periods are incomplete. Solis credentials alone
   cannot access this API. Record only redacted comparisons.
2. **Historical energy:** Do not backfill the April 2025 missing days with zero
   or spread the approximately 1,301 kWh counter step across them. Solis's
   inverter and plant month endpoints both omit those days, so the existing
   monthly backfill cannot supply exact daily figures. An external meter or
   recovered source history would be needed for exact per-day amounts.
3. **Physical PV map:** Record occupied terminals, MPPT pairing, panel model,
   module count, orientation and shading through installer records or a
   qualified inspection. Only then add peer-string imbalance thresholds or
   fault labels. The April 11 and June 6, 2026 telemetry changes are
   investigation dates, not confirmed maintenance events.
4. **AC review:** Have a qualified installer compare onsite phase-voltage and
   grounding measurements, grid configuration and the `1010`/`1011`/F017
   alarms. Numeric UI readings should not become automatic fault thresholds
   until the applicable settings and measurement basis are validated.
5. **Vendor contract monitoring:** Keep the current working signer and
   `pageNo` alarm pagination. Recheck the official charset/minId behavior on
   future API revisions before changing production request code. The current
   [vendor docs](https://developer.soliscloud.com/guide/data-access-user.html)
   conflict with this account's observed responses in specific places.

## Verification gate

The Pro and API tests, lint and production build pass in this branch.
Before merging, review the UI wording with the owner. A deployment would
require the normal CI and release process; this investigation does not write
to the production database or issue Solis control commands.
