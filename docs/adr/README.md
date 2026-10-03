# Architecture Decision Records

Short records of decisions that shaped v3, each with the context that forced it and what it
costs. Newest last. A decision is changed by writing a new ADR that supersedes the old one, not
by editing history.

| # | Decision | Status |
|---|---|---|
| [001](./001-uptime-from-solis-history.md) | Derive uptime from SolisCloud `inverterDay`, not our own polling | Accepted |
| [002](./002-shared-pure-domain-modules.md) | Domain logic lives in dependency-free `shared/` modules | Accepted |
| [003](./003-private-reads-through-the-api.md) | Real data is private; the browser reads through an authenticated API | Accepted (revoke of `anon` SELECT staged to cutover) |
| [004](./004-demo-runs-the-real-code.md) | The demo runs the real resource code against generated 2035+ data | Accepted |
| [005](./005-null-is-not-zero.md) | Unknown is `null`, a missing day is not a zero, and the UI says which tariff produced a figure | Accepted |
