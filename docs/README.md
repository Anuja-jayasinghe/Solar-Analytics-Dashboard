# Documentation

Start with the root [`README.md`](../README.md), then [`ARCHITECTURE.md`](./ARCHITECTURE.md).
The v3 refactor is tracked in [`V3_REFACTOR_PLAN.md`](./V3_REFACTOR_PLAN.md).

## Reference — how it works now

| Document | What it covers |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, both pipelines, data model, security |
| [`adr/`](./adr) | Architecture decision records for v3 (uptime source, shared modules, private reads, demo, null≠0) |
| [`WORKING_RULES.md`](./WORKING_RULES.md) | The rulebook: data honesty, dates, security, DB changes, gates, tracking |
| [`API.md`](./API.md) | Every endpoint, auth model, error shapes |
| [`RUNBOOK.md`](./RUNBOOK.md) | Operating procedures and incident response |
| [`logic-registry/`](./logic-registry) | Specs for the non-obvious domain rules (LR-001 …) |
| [`LOGIC_REGISTRY.md`](./LOGIC_REGISTRY.md) | Index of the logic registry |
| [`DATA_PIPELINE_SAFEGUARDS.md`](./DATA_PIPELINE_SAFEGUARDS.md) | What prevents a silent data outage |
| [`DAILY_SUMMARY_BACKFILL.md`](./DAILY_SUMMARY_BACKFILL.md), [`DAILY_SUMMARY_QUICK_REFERENCE.md`](./DAILY_SUMMARY_QUICK_REFERENCE.md) | Rebuilding daily summaries |
| [`guides/CEB_BILL_ENTRY_GUIDE.md`](./guides/CEB_BILL_ENTRY_GUIDE.md) | Entering / reviewing CEB bills |
| [`guides/DEPLOYMENT_CHECKLIST.md`](./guides/DEPLOYMENT_CHECKLIST.md) | Deploying to production |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history |

## Vendor material

`SolisCloud Platform API Document V2.0.3.pdf`, the S5-GC(25-40)K datasheet and their `*_meta.json`.

## v3 refactor (in progress)

| Document | What it covers |
|---|---|
| [`V3_REFACTOR_PLAN.md`](./V3_REFACTOR_PLAN.md) | Decisions, phase checklists, progress log, deferred register |
| [`UI_CURRENT_STATE_AUDIT.md`](./UI_CURRENT_STATE_AUDIT.md) | What the v2.1.0 UI shows and what is wrong with it |
| [`UI_REDESIGN_DIRECTION.md`](./UI_REDESIGN_DIRECTION.md) | Earlier redesign decisions (to be reconciled in the design phase) |
| [`COMPACT_ANALYTICAL_DATA_LIST.md`](./COMPACT_ANALYTICAL_DATA_LIST.md), [`INVERTER_HEALTH_PANEL_SPEC.md`](./INVERTER_HEALTH_PANEL_SPEC.md) | Earlier data / health-panel notes (superseded by the uptime spec, LR-002) |

## History — a record, not the present

[`archive/`](./archive) holds earlier audits, implementation plans and recovery write-ups. Where they
disagree with the reference documents above, the reference documents are right.

## Conventions

- New domain rule → a spec in `logic-registry/` **before** the code, with tests.
- Skipped or deferred work → a row in the plan's deferred register **and** a `v3-deferred` GitHub issue.
- Superseded documents move to `archive/`; documents with no remaining value are deleted.
