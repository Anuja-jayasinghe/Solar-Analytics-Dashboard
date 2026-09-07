# Data Pipeline Safeguards

**Added:** 2026-09-07 · **Context:** [`RECOVERY_STATUS_2026-09.md`](./RECOVERY_STATUS_2026-09.md)

Why inverter data collection died for five months without anyone noticing, and the five
mechanisms now in place so it cannot happen the same way twice.

---

## What actually happened

| | |
|---|---|
| **Trigger** | `main` had no commits between **2026-01-20 and 2026-04-18** — an 88-day gap |
| **Mechanism** | GitHub disables *scheduled* workflows after **60 days of repository inactivity**. Workflow runs do not count as activity; only commits do |
| **Effect** | Both data workflows moved to state `disabled_inactivity`. Last runs: **2026-04-15** |
| **Why it went unnoticed** | A disabled workflow does not fail — it produces *nothing*. There was no run, no red X, no email. The only signal was rows quietly not arriving in Supabase |
| **Why re-activity didn't fix it** | Committing again does **not** re-enable them. They stay off until someone manually turns them back on |
| **Duration** | ~5 months (2026-04-15 → 2026-09-07) |

### …and two more faults hiding underneath

Re-enabling the workflows on 2026-09-07 did **not** restore collection. Manually dispatching
them exposed two further problems that the five-month silence had been concealing:

**`SUPABASE_SERVICE_KEY` is not a service_role key.** The live fetcher now reaches Solis fine
(the inverter is alive and generating) but Supabase refuses the write:
`new row violates row-level security policy for table "inverter_data_live"`. A genuine
`service_role` key bypasses RLS on every table, so the key in that secret is being evaluated
as a normal role — almost certainly the anon key. The `api_logs` insert in the same run
succeeded, which proves the key authenticates and is simply subject to RLS.
`scripts/sql/2026-04-23_ceb_bill_ingestions_anon_mode_policies.sql` — *"use this script only
when backend uses SUPABASE_ANON_KEY instead of service_role"* — confirms the project was
being run in anon-key mode.

**The daily summary job reported SUCCESS while doing nothing.** It aggregates
`inverter_data_live`; that table was empty, so it logged "No live data rows found" thirty
times, wrote nothing, printed `DAILY SUMMARY GENERATOR - SUCCESS` and exited `0`.

That last one is the important one. Even once someone *did* look at the Actions tab, they
would have seen green.

### The central lesson

**The outage was invisible because the monitoring watched the machinery, not the output** —
and where it did watch the machinery, the machinery lied. Nothing was checking whether data
had actually arrived. Every safeguard below follows from that.

---

## Safeguard 1 — Keepalive (prevention)

`.github/workflows/keepalive.yml`

Two independent triggers, deliberately:

**Heartbeat commit — every 10 days.** Writes a UTC timestamp to `.github/last-keepalive` and
commits it. The repository's inactivity clock never gets near 60 days, so nothing is ever
disabled. This is the direct fix for the exact failure above.

**Self-heal on push — every push to `main`.** Calls the Actions API to re-enable all three
scheduled workflows. Idempotent: enabling an already-active workflow is a no-op.

The second trigger matters because of a bootstrapping problem: if every scheduled workflow in
the repo is disabled, a *scheduled* recovery job is disabled too and cannot rescue anything.
**Push events are never disabled by GitHub.** So even in the worst case — all schedules off —
the next commit anyone makes automatically switches them back on.

> Deleting this workflow re-opens the original failure mode.

Note: commits pushed by `GITHUB_TOKEN` do not trigger further workflow runs, so the heartbeat
cannot loop.

---

## Safeguard 2 — Data freshness check (detection)

`.github/workflows/data-freshness-check.yml` → `scripts/check_data_freshness.js`

Runs daily at 08:00 Sri Lanka time, after the morning summary job has had its chance.

It asserts on **the data, not the machinery** — which is the whole point. Every one of these
failure modes looks identical from the dashboard's side (rows stop arriving), and every one
trips this check:

- workflows disabled or deleted
- `SOLIS_*` / `SUPABASE_*` secrets rotated or expired
- SolisCloud API contract change
- Supabase project paused (the free tier pauses when idle)
- silent partial failures that still exit 0

**Thresholds** (override via env):

| Table | Freshness column | Limit | Why |
|---|---|---|---|
| `inverter_data_daily_summary` | `summary_date` | 2 days | The generator skips today's row before 23:00 local, so yesterday is the freshest possible. 2 days tolerates one missed run |
| `inverter_data_live` | `data_timestamp` | 12 hours | The 5-min fetcher has a 20:00–04:59 local quiet window, so a ~9h overnight gap is normal |

**When stale**, it opens a GitHub issue labelled `data-outage` — which emails you — containing
the freshness report, a triage checklist, and the recovery commands. Repeat alerts comment on
the existing issue rather than opening duplicates. **When healthy again**, it closes that issue
automatically with a timestamp.

Run it by hand any time:

```bash
node scripts/check_data_freshness.js
node scripts/check_data_freshness.js --json   # machine-readable
```

Exit code `0` = fresh, `1` = stale.

---

## Safeguard 3 — Recovery on demand

`.github/workflows/backfill-daily-summaries.yml`

`scripts/backfill_all_missing_daily.js` can rebuild `inverter_data_daily_summary` from the
SolisCloud month-history API, so any gap in daily generation is recoverable — but it needs the
`SOLIS_*` and `SUPABASE_*` credentials, and those live as repo secrets, not on a laptop.

This workflow runs it where the secrets already are. **Dry run is the default**: it reads from
Solis and Supabase, reports exactly which dates are missing, and writes nothing. Uncheck
`dry_run` to actually insert.

Actions tab → *Backfill Daily Summaries* → Run workflow. The report lands in the run summary
and as a downloadable artifact.

> Only daily summaries are recoverable. `inverter_data_live` has no upstream history endpoint
> and cannot be backfilled — but it only ever represents "right now", so a gap in it has no
> lasting effect on the dashboard.

---

## Safeguard 4 — Jobs may not report success for doing nothing

`functions/generate_daily_summary/index.js`

The freshness check catches a dead pipeline within a day. This closes the gap *inside* the job
itself: reconciling zero days across the whole 30-day window now throws instead of printing
`SUCCESS`.

A healthy run classifies every past day as insert / update / unchanged, so touching **zero**
days means the upstream source is empty and something is wrong. The error message names the
likely cause directly — an anon key being rejected by RLS — because that is what it turned out
to be.

The general rule this encodes, worth applying to any job added later:

> A batch job that processes nothing has not succeeded. It has failed to find its input.

## Safeguard 5 — Snapshot before you write

`.github/workflows/db-snapshot.yml` → `scripts/snapshot_db.js`

Read-only export of `ceb_data`, `ceb_bill_ingestions`, `ceb_bill_extractions`,
`inverter_data_daily_summary`, `inverter_data_live` and `system_settings` to JSON, uploaded as
a downloadable workflow artifact. Run it before any operation that writes to the database — a
backfill, a migration, a bulk approval.

Actions tab → *DB Snapshot* → Run workflow.

It applies the same rule as safeguard 4, for the same reason. A snapshot taken with an
RLS-bound key comes back **empty rather than erroring**, which would hand you a restore point
containing nothing. So tables that should hold data must return rows or the run fails:

```
❌ SNAPSHOT NOT TRUSTWORTHY — do not treat this as a restore point.
   Unexpectedly empty: ceb_data, system_settings
```

> This is a safety net, not an authoritative backup. For a true point-in-time restore use
> **Supabase Dashboard → Database → Backups**. The snapshot captures only what the configured
> key is permitted to read.

---

## Verifying a backfill before it writes

`scripts/backfill_all_missing_daily.js --dry` reports which dates are missing **and what
values it would write** — totals, mean daily generation, peak range, and a sample of dated
rows you can check against the Solis portal.

It also flags one real accuracy trap. When Solis returns no record for a date, the script
still inserts a row with `total_generation_kwh: 0`. Per
[`LR-001`](./logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md) that is wrong:

> `null` means unavailable/pending · `0` means an actual measured zero

A zero-filled row asserts "this system generated nothing that day" when the truth is "we don't
know". On the dashboard it reads as a real zero and drags monthly averages down. The dry run
now counts these separately and lists the dates:

```
│ Rows to insert        : 145
│   backed by Solis data: 141
│   zero-filled         :   4
│ ⚠️  4 date(s) would be written as 0 kWh despite Solis returning no record
```

Decide what those dates should be before running without `--dry`.

---

## Alerting policy

| Workflow | Frequency | On failure |
|---|---|---|
| Fetch Live Inverter Data | every 5 min | **Log only.** 288 runs/day — alerting per failure would bury the signal. One transient SolisCloud timeout is not worth an alert |
| Generate Daily Inverter Summary | 2×/day | Opens/comments the `data-outage` issue |
| Data Freshness Check | daily | Opens/comments the `data-outage` issue — **this is the alert to trust** |

Sustained failure of the 5-minute job shows up within a day as stale `inverter_data_live`, so
it is covered without the noise.

---

## What is still not covered

Being honest about the edges:

- **Everything here lives inside GitHub Actions.** A billing suspension or an org-wide Actions
  outage silences the monitor along with the thing it monitors. A truly independent watchdog
  would have to run elsewhere — Vercel Cron is the obvious candidate, though the Hobby plan
  caps at one run per day and the project is at 11 of 12 serverless function slots.
- **Alerts go to GitHub notifications only.** If you do not read repo email, add a webhook.
- **The freshness check does not validate *correctness*** — only that rows are recent. A
  systematically wrong value that keeps arriving on schedule looks perfectly healthy here.
