# SolisCloud single-inverter investigation

This workspace investigates the account's one inverter using read-only data access.
It is separate from the production dashboard and collector. Do not put API credentials,
unredacted Solis responses, owner details, location, or device identifiers in Git.

**Status (2026-10-06):** Phase 1 inventory, Phase 2 read-only environment,
and first-pass Phase 3 contract checks are complete. Signed live calls
succeeded using the repository's signing mode. Phase 4 has reconciled raw PV
warnings and identified an April 2025 Solis daily-archive gap; production
database comparison remains open. Phase 5–6 findings and limits are in
`FINDINGS-2026-10-06.md`. Physical wiring and service records are unavailable.
The [project change log](PROJECT_CHANGES.md) tracks the dashboard and
documentation corrections in this branch and the remaining checks.
The [production telemetry storage audit](TELEMETRY_STORAGE_AUDIT-2026-10-06.md)
records the read-only database coverage check for the proposed electrical
range view and its release gate.

## Phases and completion gates

| Phase | Work | Completion gate |
| --- | --- | --- |
| 1. Baseline | Inventory relevant endpoints, source versions, current Pro calculation, and prior observations. | Every candidate endpoint has a documented purpose and an evidence status. |
| 2. Test environment | Add an allowlisted, rate-limited request runner. Keep credentials outside Git and raw output outside the checkout. | A safe dry run works without credentials; a signed read-only smoke call succeeds when credentials are available. |
| 3. Contract validation | Test request parameters, signing, response codes, fields, units, timestamps, pagination, and missing values against the current vendor docs. | Each discrepancy has a redacted response example, date, and reproducible request. |
| 4. Data reconciliation | Match raw Solis records to normalized/stored telemetry and the Pro display for the same timestamps. | Every reported low channel can be reproduced from source data or traced to a pipeline defect. |
| 5. Electrical analysis | Map occupied inputs to physical strings and MPPTs, then compare suitable peers across multiple days and times. | Each anomaly has persistence, coverage, peer comparison, and alternative explanations. |
| 6. Whole-inverter health | Correlate DC inputs with AC output, grid conditions, temperature, limits, alarms, energy, and logger state. | Findings distinguish measured anomalies from possible causes and missing evidence. |
| 7. Decision | Produce a ranked evidence report, installer checks where needed, and any proposed dashboard metric corrections. | Each recommendation cites its source and can be independently checked. |

## Evidence rules

- The current Solis developer portal is the documentation baseline; the bundled V2.0.3 PDF and the 2026-10-03 field catalog are comparison sources, not proof of current behavior.
- `null`, absent, and measured zero are distinct. Preserve the raw unit and scale alongside normalized numbers.
- Interpret `dataTimestamp` as an instant and render it in `Asia/Colombo`; do not infer local time from `timeStr` without validation.
- A low current or voltage channel is not automatically a faulty physical string. Establish model and as-built string/MPPT wiring first.
- Never send control, configuration, or plant-management write requests. Do not write to the production database during diagnostics.
- The investigation does not claim a physical cause from cloud telemetry alone.

## Starting evidence

- Current Pro uses one completed day of telemetry. It filters samples to `pac_kw > 1`, averages current for each of eight normalized positions, and flags positions more than 8% below the mean across positions. It averages voltage only for the tooltip. Source: `src/v3/pages/ProPage.jsx`, `src/v3/pro/metrics.js`, and `src/v3/pro/Electrical.jsx` at `ad3a934`.
- A fresh signed `inverterDay` call returned eight populated `uPv`/`iPv` positions; the current Solis portal documents four for that endpoint. The earlier 2026-10-03 field catalog had the same observation. Source: `FINDINGS-2026-10-06.md`, `docs/SOLIS_API_FIELD_CATALOG.md`, and the vendor data-access page.
- Local Solis credentials are in an ignored `.env` with file mode `0600`.
  Do not print, commit or copy that file into reports or fixtures.

## Probe usage

The probe is a local API testing tool. It has a fixed read-only endpoint allowlist and
does not import browser code or modify the production database.

```bash
node diagnostics/solis/probe.mjs --date 2026-10-05 --dry-run
```

For a live call, load the ignored `.env` locally and provide a new private
directory **outside the repository**:

```bash
node --env-file=.env diagnostics/solis/probe.mjs --date 2026-10-05 --mode repo --out /absolute/private/solis-probe-2026-10-05
```

The default `--mode official` signs requests according to the current Solis developer
portal; on this account, that combination returned HTTP 403 for the tested
`inverterList` request. `--mode repo` uses the existing production signer and
returned API code 0; run the two modes with different empty output directories.
The probe prints only endpoint status and counts.
Raw responses and `_summary.json` are private files with mode `0600`; do not attach or
commit the raw files. The probe makes a bounded baseline set of calls;
`summarize-alarms.mjs` separately checks all observed alarm pages.

For a later targeted day, `--only inverterDay --identity-from /absolute/private/inverterList.json`
reuses the previously verified single-inverter identity. `summarize-day.mjs` prints
aggregates without identifiers, and `check-pagination.mjs` and
`summarize-alarms.mjs` reproduce the account-specific alarm paging findings.

## References

- Solis user data access: https://developer.soliscloud.com/guide/data-access-user.html
- Solis user authorization: https://developer.soliscloud.com/guide/authorization.html
- Solis release notes: https://developer.soliscloud.com/guide/release-notes.html
- Existing field catalog: `docs/SOLIS_API_FIELD_CATALOG.md`
- Existing read-only probe: `scripts/solis_probe.mjs`
