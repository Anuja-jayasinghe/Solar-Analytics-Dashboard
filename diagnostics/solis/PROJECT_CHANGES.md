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

The focused Pro tests, lint of changed source files and production build pass.
Before merging, review the UI wording with the owner. A deployment would
require the normal CI and release process; this investigation does not write
to the production database or issue Solis control commands.
