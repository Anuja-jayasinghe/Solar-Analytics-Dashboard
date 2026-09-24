# Documentation

Start with [`START_HERE.md`](./START_HERE.md). The project [`README`](../README.md) has the
overview and the quick start; [`CLAUDE.md`](../CLAUDE.md) is the condensed version for working
in the codebase.

## Reference — how it works now

| Document | Contents |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, both pipelines, status lifecycle, data model, security, failure modes |
| [`API.md`](./API.md) | Every endpoint: auth model, request and error shapes |
| [`SECURITY.md`](./SECURITY.md) | Trust boundaries, the RLS / storage policy matrix, the new-endpoint checklist |
| [`MIGRATIONS.md`](./MIGRATIONS.md) | How schema changes are made, and the ledger of what has been applied |
| [`RUNBOOK.md`](./RUNBOOK.md) | Incident response and routine procedures |
| [`logic-registry/`](./logic-registry/README.md) | Specs for the non-obvious domain rules (LR-001: CEB versus inverter alignment) |
| [`CHANGELOG.md`](./CHANGELOG.md) | What changed, by release |

## Guides

| Guide | For |
|---|---|
| [`guides/LOCAL_DEVELOPMENT.md`](./guides/LOCAL_DEVELOPMENT.md) | Running the app, the API and Clerk sign-in locally; tests |
| [`guides/CEB_BILL_ENTRY_GUIDE.md`](./guides/CEB_BILL_ENTRY_GUIDE.md) | Adding, reviewing and deleting bills |
| [`guides/DEPLOYMENT_CHECKLIST.md`](./guides/DEPLOYMENT_CHECKLIST.md) | What to check around a deploy |
| [`guides/DATA_REFRESH_AND_CACHING_GUIDE.md`](./guides/DATA_REFRESH_AND_CACHING_GUIDE.md) | Polling, stale-while-revalidate caching and the circuit breaker (November 2025 specification — check against `DataContext.jsx` before relying on details) |

## History — why it is the way it is

A record, not a description of the present. Where these disagree with the reference documents,
the reference documents are right.

| Document | Contents |
|---|---|
| [`PROJECT_AUDIT_2026-09.md`](./PROJECT_AUDIT_2026-09.md) | The September 2026 audit: security, API, data, UI, CI, docs |
| [`RECOVERY_STATUS_2026-09.md`](./RECOVERY_STATUS_2026-09.md) | The five-month data outage and its three stacked causes |
| [`DATA_PIPELINE_SAFEGUARDS.md`](./DATA_PIPELINE_SAFEGUARDS.md) | What now prevents a silent recurrence |
| [`REPO_AUDIT_2026-09-24.md`](./REPO_AUDIT_2026-09-24.md) | Dead code, stale docs, symptom fixes, security and validation — findings and remediation |

## Vendor reference

`SolisCloud Platform API Document V2.0.3.pdf`, `Solis_datasheet_S5-GC(25-40)K_GBR_V1,5_202507.pdf`
and the two `*_meta.json` files beside them are the inverter vendor's documentation.

## Archive

[`archive/`](./archive/README.md) holds everything that has been superseded — completed
refactors, the finished Clerk migration, old plans and specs — kept for history and grouped by
topic. Every file there carries a banner saying so. Nothing in the archive describes the current
system reliably.
