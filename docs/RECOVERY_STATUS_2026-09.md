# Recovery Status — September 2026

**Written:** 2026-09-07 · **Branch scanned:** `chore/add-ci` (clean, in sync with `main`)

Re-orientation and triage after ~5 months away. Read this before touching anything else.

---

## TL;DR

You came back for the CEB bill parser. That is real and it is broken — but it is **not the
worst thing wrong with this project**.

Your inverter data collection has been dead since **2026-04-15**. Both scheduled GitHub
Actions workflows are in state `disabled_inactivity` and have not run in ~5 months. Every
number on the dashboard that comes from the inverter side is frozen at April.

Fix that first. You cannot judge whether the CEB pipeline is producing correct numbers when
the other half of every comparison is empty.

---

## 1. What this project actually is (the 5-minute refresher)

A React 19 + Vite SPA on Vercel, backed by Supabase, that compares **what the solar inverter
generated** against **what the electricity company paid for**.

### Two data sources, joined by billing period

| Side | Source | Lands in | Collected by |
|---|---|---|---|
| Inverter | SolisCloud API | `inverter_data_live` (5-min), `inverter_data_daily_summary` (daily) | GitHub Actions cron |
| CEB | Bill PDFs, uploaded by admin | `ceb_data` | Admin dashboard upload → parse → approve |

### The join rule (the core business logic)

`docs/logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md` is the one doc worth
re-reading in full. The rule in one line:

> **A bill received in month N reports generation from month N−1.**

Period windows are derived from bill dates, not calendar months: `periodEnd = bill_date`,
`periodStart = previous bill_date + 1 day`. Inverter kWh is summed over exactly that window.
`null` means pending; `0` means a measured zero. Implemented in `src/lib/dataService.js`
(`buildAlignedEnergyComparisonRows`) and consumed by `src/contexts/DataContext.jsx` →
`src/components/dashboard/EnergyCharts.jsx`.

### The CEB bill pipeline

```
Admin uploads PDF
  → POST /api/ceb-bills/upload      (SHA-256 dedupe → Supabase Storage bucket `ceb_bills`
                                     → row in ceb_bill_ingestions, status 'received')
  → POST /api/ceb-bills/extract     (pdf-parse text + regex → validate
                                     → row in ceb_bill_extractions
                                     → status 'auto_approved' or 'pending_review')
  → VerificationQueue.jsx           (admin reviews / edits the extracted fields)
  → "Approve & Save"                (upsert into ceb_data, onConflict account_number+billing_month)
```

**Important and easy to misremember:** `extract.js` is **not** OCR and **not** AI. The repo
still ships `@google/generative-ai` in `package.json` and
`docs/development/CEB_BILL_AUTOMATION_IMPLEMENTATION_PLAN.md` still describes a Google
Document AI architecture — **neither is what got built.** Git history records the decision:

> `ba7bf51` — "revert the automation till the document upload step cause we are migrating to
> code base PDF parshing method insted of AI use extracting since the AI extraction isn't
> reliable for our statistics"

What actually runs is `pdf-parse@2.4.5` text extraction plus six hand-tuned regexes matched
against the exact text layout of the old bill. That plan document is now misleading — treat
it as a historical artifact, not a spec.

### Auth

Clerk (migrated off Supabase Auth). `src/contexts/AuthContext.jsx` is live;
`src/lib/auth/AuthFactory.js` picks an adapter. Server endpoints authenticate through
`api/middleware/verifyAdminToken.js`, which tries session-verify, then template JWT, then
plain JWT.

---

## 2. Where we stand

### Codebase health: fine

- `pnpm lint` → **0 errors**, 20 warnings
- `pnpm build` → **succeeds**, ~49s, 3995 modules
- CI green on `main`; working tree clean; no open PRs

Nothing is structurally broken. Both breakages below are runtime/data, not code that fails to
compile.

### ✅ Breakage 1 — Inverter data collection stopped 2026-04-15 — *workflows re-enabled 2026-09-07*

```
Fetch Live Inverter Data (Every 5 Minutes)   disabled_inactivity   last run 2026-04-15T07:01Z
Generate Daily Inverter Summary              disabled_inactivity   last run 2026-04-15T14:52Z
```

**Root cause, confirmed:** `main` had no commits between **2026-01-20 and 2026-04-18** — an
88-day gap. GitHub disables scheduled workflows after 60 days of repository inactivity;
workflow runs do not count as activity, only commits do. They stay disabled until manually
re-enabled — resuming commits in April did not bring them back, and feature work continued
through May and July without this being noticed.

It went unnoticed because **a disabled workflow does not fail — it produces nothing.** No run,
no red X, no email. Nothing was checking whether data had actually arrived.

Both workflows are now `active` again. Prevention and detection are covered in
[`DATA_PIPELINE_SAFEGUARDS.md`](./DATA_PIPELINE_SAFEGUARDS.md).

There is no fallback path: `vercel.json` declares no `crons`, so `api/fetch-inverter-data.js`
only ever runs when something calls it.

Consequences:

- `inverter_data_live` — no rows for ~5 months. Current Power card, live tracking: dead.
- `inverter_data_daily_summary` — ~5-month hole. EnergyCharts, monthly comparison, total
  generation, Daily Target Tracker: all reading a gap.

**Recoverable?** The daily summaries, yes — `scripts/backfill_all_missing_daily.js` fetches
from the **Solis API month history**, not from the live table, so the gap can be refilled
properly. The 5-minute live history is gone for good, which matters little since it only ever
represented "right now."

### 🔴 Breakage 2 — CEB bill parser vs. the new bill format

`api/ceb-bills/extract.js` keys off six literal anchors in the old bill's extracted text:

| # | Field | Pattern | What it depends on |
|---|---|---|---|
| 1 | Account no. | `/Electricity A\/C No\.:\s*(\d+)/i` | exact label wording |
| 2 | Billing month | `/([0-9]{4} [A-Z]{3})\s+Month:/i` | the string `2024 SEP\tMonth:` |
| 3 | Bill date | `/Bill Date:\s*([0-9\/]+)/i` | exact label wording |
| 4 | Units exported | `/No\. of Units Exported \(kWh\)\s+(\d+)/i` | exact label wording |
| 5 | Earnings | `/Charge for Units Exported \(Rs\.\)\s+([\d,]+\.\d{2})/i` | exact label wording |
| 6 | Meter readings | `/\t(\d+)\t(\d{4}-\d{2}-\d{2})/g` | **literal tab-delimited table columns** |

Any relabelling or reflow kills 1–5. #6 is the most fragile of the set: it depends on
pdf-parse emitting real tab characters between table cells, which is a property of the PDF's
internal text layout — a pure visual redesign is enough to change it.

**Expected symptom today (safe):** regexes miss → zeros → `validateExtraction()` raises errors
→ status `pending_review`. Bills land in the queue for manual retyping rather than crashing.
The pipeline degrades to manual entry.

**Two ways it can be worse than that:**

1. **Silently wrong meter readings.** #6 is positional — it collects every `tab-digits-tab-ISO-date`
   match, sorts by date, and takes first as *previous* and last as *current*. If the new
   layout puts more rows of that shape in the table, it can pick the wrong pair and still pass
   the math check. This must be verified against a real new bill, not assumed.
2. **The bill is now an image/scan rather than a text PDF.** Then `parser.getText()` returns
   nothing usable and the regex approach is dead entirely — which reopens the OCR decision
   that was deliberately abandoned in `ba7bf51`.

### 🟠 Breakage 2b — the tariff validation rule is independently at risk

`validateExtraction()` flags a bill unless:

```
| units_exported × rate_per_kwh − earnings | < 1.00
```

with `rate_per_kwh` read from `system_settings` (default 37.00). This assumes **one flat
export rate**. If the redesigned bill came with tiered or time-of-use export rates, or added
adjustments/levies, then *every* bill will flag `pending_review` even when extraction is
perfect. Same for the meter-delta check
(`current − previous == units_exported`). Confirm the tariff structure on the new bill before
concluding the parser is at fault.

### ⚠️ Blocking unknown

**Nothing further can be fixed on the CEB side without a sample of the new bill PDF** — ideally
one new-format and one old-format bill to diff. Every remaining decision (patch the regexes /
rewrite the parser / add OCR) depends on what the new text extraction actually looks like.

---

## 3. Secondary issues worth knowing about

Not blocking, but they cost time if you hit them unaware.

| | Issue | Where | Why it matters |
|---|---|---|---|
| 1 | No `.env` present locally | repo root | Nothing runs or backfills until env is restored |
| 2 | `vercel.env.example` is stale | `vercel.env.example` | Missing every Clerk var (`CLERK_SECRET_KEY`, `CLERK_JWT_TEMPLATE_NAME`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_JWT_TEMPLATE_NAME`) and `SUPABASE_STORAGE_BUCKET_BILLS`. It still describes the pre-Clerk world — the top orientation trap for returning-you |
| 3 | Open issue #114 — conditional Clerk hooks | `src/contexts/AuthContext.jsx:16-18` | Real rules-of-hooks violation; `useUser`/`useAuth`/`useClerk` called conditionally |
| 4 | `AuthContext.adapter.jsx` is dead code | `src/contexts/` | Nothing imports it; near-duplicate of `AuthContext.jsx`. Deleting halves the #114 surface |
| 5 | Vercel Hobby function cap nearly full | `api/` | 11 of 12 slots used. `api/middleware/verifyAdminToken.js` counts as a function (no `_` prefix). Adding a debug endpoint takes the last slot; renaming `middleware/` → `_middleware/` would free one — verify before relying on it |
| 6 | `ceb_data` schema exists only in Supabase | `scripts/sql/` | Migrations are checked in for `ceb_bill_ingestions` and `ceb_bill_extractions` but **not** `ceb_data`, despite code depending on a composite unique index on `(account_number, billing_month)` and on `billing_period_start/end`, `data_source`, `file_path`, `ingestion_id`. Dump it to `scripts/sql/` |
| 7 | Zero tests, zero fixtures | repo-wide | No `test` script, so CI's Test step silently no-ops. The extractor was tuned by hand against live uploads — which is exactly why a format change turned into a months-long outage |
| 8 | `scripts/extract_solis_pdf.{mjs,cjs}` are stale | `scripts/` | Written against pdf-parse v1's callable API; installed version is 2.4.5's class-based `PDFParse`. They will throw |
| 9 | Docs index points at the wrong things | `docs/START_HERE.md`, `docs/DOCUMENTATION_INDEX.md` | Both are entirely about local Clerk dev tooling, not the project. This is why re-orientation is hard. The genuinely useful three are `logic-registry/LR-001-*`, `guides/CEB_BILL_ENTRY_GUIDE.md`, and this file |
| 10 | No `CLAUDE.md` | repo root | Worth adding once the above settles |

---

## 4. Recommended order

Sequenced so each step unblocks the next.

**1 · Re-enable the two workflows and backfill the gap** — *partly done 2026-09-07*

✅ **Done.** Both workflows are `active` again; live collection resumed on the next 5-minute
tick. Safeguards against recurrence are in `DATA_PIPELINE_SAFEGUARDS.md`.

⏳ **Backfill still outstanding.** The ~5-month hole in `inverter_data_daily_summary` is
recoverable but has not been filled yet — it needs credentials. Two ways:

```bash
# (a) locally, once .env has SUPABASE_URL / SUPABASE_SERVICE_KEY / SOLIS_*
node scripts/backfill_all_missing_daily.js --dry   # preview the gap, writes nothing
node scripts/backfill_all_missing_daily.js

# (b) on GitHub, using the repo secrets — no local .env needed
gh workflow run backfill-daily-summaries.yml -f dry_run=true
```

Do this before anything else. Until the inverter side has data, you cannot tell a CEB parsing
bug from a missing-data artifact.

**2 · Restore `.env` and refresh `vercel.env.example`** — *~15 min*

Nothing local runs without it, and the example file will mislead you again next time.

**3 · Get a new-format bill and see what actually changed** — *blocked on you*

Provide one new-format CEB bill PDF, plus an old one if you still have it. First move is a
text-dump harness — a small script running pdf-parse 2.4.5 over a bill and writing the raw
text to disk — so the new anchors can be read directly instead of guessed at. Then diff old vs
new and answer: still a text PDF, or now a scan?

**4 · Rewrite the extractor against the new format** — *scoped once step 3 lands*

Whatever the shape, do it with a checked-in fixture and a test this time, so the next CEB
redesign is a ten-minute fix.

**5 · Revisit the tariff validation rule** — *small, do alongside 4*

Confirm the new bill's rate structure before assuming flat-rate math still holds.

**6 · Then the debt** — issue #114, delete `AuthContext.adapter.jsx`, dump the `ceb_data`
schema, prune the docs index.

---

## 5. Verified during this scan

| Check | Result |
|---|---|
| `pnpm lint` | 0 errors, 20 warnings |
| `pnpm build` | succeeds, 49s |
| Working tree | clean, `chore/add-ci` in sync with `main` |
| Open PRs | none |
| Open issues | #114 only |
| Workflow states | `ci` active; both data workflows `disabled_inactivity` |
| Last inverter data | 2026-04-15 |
| Last feature commit | 2026-07-15 (PR #112) |

Not verified — requires credentials or a sample file: actual row counts in Supabase, the live
behaviour of the deployed site, and the new bill's layout.
