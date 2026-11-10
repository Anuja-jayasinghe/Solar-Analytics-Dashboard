# LR-005: CEB Bill Intake by Email

Status: **In progress (#242).** Steps 1–3, 6 and 7 of the checklist are built; nothing receives email yet. Add it to the
registry index (`README.md`) when it ships.
Owner: CEB bill pipeline
Primary files (planned):
- `api/ceb-bills/[action].js`: the six bill endpoints merged into one function, plus the new `inbound` action
- `api/_lib/billIntake.js`: the upload → extract → gate → record steps, shared by the admin page and the webhook
- `api/_lib/billGate.js`: the auto-record gate (pure, no I/O)
- `api/_lib/notify.js`: the "needs you" email, sent through Resend
- `.github/workflows/data-freshness-check.yml`: gains the missing-bill check
- `tests/billGate.test.js`, `tests/billIntake.test.js`

Reuses, unchanged: `api/_lib/pdfText.js`, `api/_lib/cebBillParser.js` (`parseCebBillText`, `validateExtraction`),
`api/_lib/cebRecordRules.js` (`sanitizeRecord`), the `approve_ceb_extraction()` RPC, LR-001 (the bill period window).

## Purpose
CEB emails the solar export bill as a PDF once a month. Today someone downloads it and uploads it on the admin page,
then approves it in the review queue. This spec makes that hands-off:

1. The email reaches the system on its own (a Gmail filter forwards it to a Resend inbound address).
2. The PDF goes through the same pipeline the admin page uses.
3. A bill that passes every check is **recorded without a person**.
4. A person is emailed **only when they are needed**: the bill needs review, something failed, or something needs
   an action (a tariff change, a bill that never arrived).

Not in scope: the two home-consumption bills CEB sends to the same inbox. They are not solar data and must not be
stored (rule 1).

## Data sources and actors
| Actor | Role |
|---|---|
| CEB, as **EDL** (Electricity Distribution Lanka) | Emails the bills from `EDL e-Bill <eBill@edl.lk>`: one solar export bill and the home-consumption bills, each with its PDF attached. The subject names the account: `EDL e-Bill for the month of November-2026 - <account number>`, and the PDF's filename starts with it |
| Gmail filter | Forwards **only the solar bill** to the intake address (the main gate, rule 1): `from:eBill@edl.lk subject:<SOLAR_CEB_ACCOUNT> has:attachment`. The account number lives only in the owner's Gmail filter and in Vercel, never in this repository |
| Resend (inbound) | Receives the forwarded email at a private address and POSTs an `email.received` webhook. The webhook carries metadata only; the PDF is fetched with a second API call |
| `POST /api/ceb-bills/inbound` | Verifies, fetches the PDF, runs the pipeline and the gate |
| Resend (outbound) | Sends the "needs you" email |
| Data Freshness Check (daily, GitHub Actions) | Raises the missing-bill alert (rule 9) |
| `ceb_data`, `ceb_bill_ingestions`, `ceb_bill_extractions`, `ceb_bills` bucket | Same tables and bucket as the manual upload |

Configuration (Vercel env, server-only, **never** `VITE_`):
| Name | Meaning |
|---|---|
| `RESEND_API_KEY` | Fetching inbound attachments and sending the alert email |
| `RESEND_WEBHOOK_SECRET` | Verifies the webhook signature |
| `BILL_INTAKE_ADDRESS` | The private intake address, with a random part (e.g. `bills-<random>@in.<domain>`) |
| `BILL_SENDER_DOMAINS` | The bill sender's domain(s), comma-separated: `edl.lk` |
| `SOLAR_CEB_ACCOUNT` | The solar bill's account number. Not committed to the repository |
| `BILL_ALERT_TO` | Where the "needs you" email goes |
| `BILL_INTAKE_MODE` | `shadow` (default), `auto` or `off` (rule 8) |
| `BILL_RATIO_MIN`, `BILL_RATIO_MAX` | The bounds for check 5.6, `0 < min < max`. Unset or invalid: check 5.6 is unknown, so nothing is recorded automatically |

## Canonical rules

1. **Only the solar bill is kept.** The Gmail filter forwards only the solar bill. The server checks again: after
   extraction, the bill's `account_number` must equal `SOLAR_CEB_ACCOUNT`. Any other bill is **discarded**:
   - the PDF is not stored
   - no ingestion row is written
   - nothing is emailed
   - the log line shows only the last 3 digits of the account
   Because of this second check, a loose filter can cost some privacy (the bill passes through Resend) but can never
   write wrong data.

2. **Only real CEB mail from the owner's forward is processed.** All of these must hold, or the email is ignored:
   - The webhook signature verifies with `RESEND_WEBHOOK_SECRET`.
   - The recipient is `BILL_INTAKE_ADDRESS`.
   - The original `From` domain is in `BILL_SENDER_DOMAINS`.
   - The original message's DKIM result for that domain is `pass`. Gmail keeps the original signature when it
     auto-forwards.

   An ignored email is only logged and gets a 200 response (no retry). There is no email for it, so spam cannot
   flood the owner's inbox. There is one exception: an email that passes the signature and sender checks but
   **fails DKIM** is held for review (rule 7), because it may be a real bill.

3. **One PDF per email.** The email needs exactly one attachment that:
   - starts with `%PDF-`
   - is at most 5 MB

   A CEB email that passes rule 2 but has no PDF, or more than one, gets a review email ("the bill email had no PDF").
   A download link in place of an attachment is not supported in this version.

4. **Repeats do nothing.** The upload step already removes duplicates by SHA-256, and the ingestion also stores
   Resend's `email_id` (`source_type = 'email_forward'`, `source_message_id`, unique together). A retried webhook or a re-forwarded email answers 200 and changes nothing.

5. **The auto-record gate.** A bill is recorded without a person only when **every** check passes. Any failure sends
   the bill to the review queue with the failing checks listed.
   1. `validateExtraction()` returns `auto_approved`. This covers:
      - all fields found
      - units × rate = earnings, within Rs 1
      - current − previous meter reading = units
      - period start before period end
   2. The account matches (rule 1).
   3. The bill is new. Its `bill_date` is after the latest bill on record for this account, and no `ceb_data` row
      exists yet for (account, `billing_month`).
   4. The bill continues the last one. Its previous meter reading equals the latest bill's `meter_reading`.
      A previous reading of 0 or missing fails this check.
   5. The period is plausible. LR-001's window (previous `bill_date` + 1 day … this `bill_date`) is 25 to 35 days.
   6. The units are plausible.
      - It applies only when the inverter has data for every day of the LR-001 window. The ratio
        `units_exported ÷ inverterKwh` must then fall within `[RATIO_MIN, RATIO_MAX]`.
      - If any day is missing, this check **fails as unknown**. It does not pass by default.
      - The bounds are set from the bills on record before `auto` mode is switched on (open question 4).
   7. The bill is not older than the latest bill on record. A backfilled, corrected or reissued bill always goes to
      review.

   In `api/_lib/billGate.js` the checks are named `extraction` (5.1), `account` (5.2), `new_month` (5.3, the
   billing-month part), `order` (5.3's date part together with 5.7, since "after the latest bill" covers both),
   `continuity` (5.4), `period` (5.5) and `units` (5.6). Each is `ok`, failed, or `unknown`, and unknown counts as
   failed. The bill date is `billing_period_end`, as in the admin approve.

6. **Recording works exactly like the admin approve.** The same `sanitizeRecord()` runs, and the same
   `approve_ceb_extraction()` RPC writes `ceb_data`, the extraction and the ingestion in one transaction. The record
   carries `data_source: 'email'`, and the audit log names the actor `email-intake`.

7. **Email the owner only when needed.**

   | Event | Email? |
   |---|---|
   | Bill recorded, no notes | No |
   | Bill recorded, but `validateExtraction()` left a note (e.g. the bill's tariff differs from Settings) | Yes: "recorded, but update the tariff" |
   | Gate failed (rule 5) | Yes: which checks failed, the extracted figures, a link to the review queue |
   | CEB email with no PDF / several PDFs / failed DKIM | Yes: what was wrong, a link to the queue |
   | Extraction crashed or the PDF could not be read | Yes |
   | Ignored mail (rule 2), discarded home bill (rule 1), duplicate (rule 4) | No |
   | No bill by the expected day + 7 (rule 9) | Yes |

   The email never attaches the PDF. It holds only figures and reasons, and it is sent only to `BILL_ALERT_TO`.

8. **Rollout modes** (`BILL_INTAKE_MODE`):
   - `shadow` (default): every bill goes to the review queue, as today. The email always says what auto mode
     *would* have done ("would have recorded" or "would need review because …"). This mode runs for at least two
     bills.
   - `auto`: rules 5 to 7 apply as written.
   - `off`: the endpoint answers 200 and does nothing. This is the kill switch.

9. **Missing-bill alert.** The daily Data Freshness Check raises an alert (a GitHub issue, which emails the owner)
   when today is later than the latest `bill_date` + the median gap of the last 6 bills + 7 days, and no ingestion is
   pending. This catches a broken Gmail filter or a changed CEB sender address. Without it, forwarding fails silently.

10. **Failing loudly, never quietly.**
    - An unexpected error (storage down, database down) answers non-2xx so Resend retries.
    - Every deliberate outcome (recorded, held for review, ignored, discarded, duplicate) answers 200.
    - A field the parser did not find is `null`, never 0 (ADR-005).

## How it works technically

```
Gmail filter (from eBill@edl.lk AND subject has the solar account) → auto-forward → bills-<random>@in.<domain>
Resend inbound ─ webhook email.received (metadata) ─▶ POST /api/ceb-bills/inbound
  1. verify signature, recipient, sender domain            (rule 2)  ─ fail → log, 200
  2. mode off → 200
  3. GET the email and attachment from Resend              (rule 3)
  4. findByMessage(email_id) + findDuplicate(sha256)        (rule 4; store() comes after the account check)
  5. billIntake.extract(ingestionId)                       (pdfText + parseCebBillText + validateExtraction)
  6. account ≠ SOLAR_CEB_ACCOUNT → delete stored PDF + ingestion, 200   (rule 1)
  7. billGate(extraction, latestBill, inverterWindow)      (rule 5, pure)
  8. mode auto and gate passed → approve_ceb_extraction()  (rule 6)
  9. notify(...) when rule 7 says so
```

Rule 1 discards a home bill only after reading its PDF, so steps 4 to 6 must hold the PDF in memory first. Storage and
the ingestion row are written **after** the account check. In practice step 4 splits in two: the hash and duplicate
check run before extraction, and the Storage write and ingestion row after the account check.

- **Function count.** Vercel Hobby allows 12 functions, and 11 are in use. The six `api/ceb-bills/*` files are first
  merged into one `api/ceb-bills/[action].js`, the way `api/data/[resource].js` serves every read. That is 6 → 1,
  which leaves room for this endpoint and future ones. It is its own PR, made before this one, with no behaviour
  change.
- **Auth.** `inbound` is the only bill action that does not use Clerk. Its credential is the Resend signature. The
  other actions keep `verifyAdminToken`. Add it to the endpoint list in `docs/SECURITY.md`.
- **Receiving domain.** Use a subdomain (e.g. `in.<domain>`) for Resend's MX records, so the main domain's mail is
  untouched. Sending needs the domain verified with Resend (SPF and DKIM records).
- **Gmail forwarding.** Gmail sends a confirmation code to the forwarding address once. It lands in Resend's dashboard
  (with mode `off`, or ignored by rule 2), where the owner reads it.
- **Limits.** Vercel request bodies are capped at 4.5 MB. The webhook carries no attachment, so it is far below that.
  Bills are well under 1 MB.
- **Dates.** All comparisons use `YYYY-MM-DD` date keys (Asia/Colombo), never `.toISOString()` on a local midnight.

## Worked examples
| # | What arrives | Outcome |
|---|---|---|
| 1 | Solar bill, everything consistent, inverter complete, ratio in bounds | `auto`: recorded, no email. `shadow`: in queue, email "would have recorded" |
| 2 | A home-consumption bill (filter too loose) | Discarded after reading the account; nothing stored, no email |
| 3 | Solar bill whose previous reading ≠ last bill's reading | Queue; email "Meter continuity: bill says previous 48,210, last bill ended at 48,190" |
| 4 | Same webhook delivered twice | Second is a duplicate: 200, nothing changes |
| 5 | Email to the intake address from an unknown sender | Ignored, logged, no email |
| 6 | Solar bill stating Rs 37.00/kWh while Settings says Rs 35.00 | `auto`: recorded (the bill's own maths holds), email "update the tariff in Settings" |
| 7 | Solar bill for a month already recorded (a reissue) | Queue; email "a bill for this month is already recorded" |
| 8 | Two inverter days missing in the bill's window | Queue; email "units check unknown: inverter data incomplete (2 of 30 days missing)" |
| 9 | No bill 7 days past the expected date | GitHub issue from the freshness check, which emails the owner |

## Formula summary
```
record automatically  ⇔  mode = auto
                        ∧ authentic(email)                       (rule 2)
                        ∧ exactlyOnePdf(email)                    (rule 3)
                        ∧ account = SOLAR_CEB_ACCOUNT             (rule 1)
                        ∧ validateExtraction.status = auto_approved
                        ∧ billDate > latestBillDate ∧ ¬exists(account, billing_month)
                        ∧ previousReading = latestBill.meter_reading ∧ previousReading > 0
                        ∧ 25 ≤ windowDays ≤ 35
                        ∧ inverterComplete(window) ∧ RATIO_MIN ≤ units ÷ inverterKwh ≤ RATIO_MAX

expectedNextBill = latestBillDate + median(gaps of last 6 bills)
missingBillAlert ⇔ today > expectedNextBill + 7 days ∧ no pending ingestion
```

## Implementation checklist
1. PR A, no behaviour change: merge the six bill endpoints into `api/ceb-bills/[action].js`. Keep every URL the same
   (rewrites in `vercel.json` if needed). The existing tests stay green.
2. Move the upload and extract steps into `api/_lib/billIntake.js`, and make the admin endpoints call it.
3. `api/_lib/billGate.js`: rule 5 as a pure function returning `{ pass, checks: [{ id, ok, unknown, message }] }`,
   with unit tests for each check and each example above.
4. `api/_lib/notify.js`: one Resend send, plain text plus simple HTML, and a link to the review queue.
5. The `inbound` action, rules 1 to 4 and 6 to 8. Tests drive it with recorded webhook payloads and fixture PDFs
   (the two existing bill formats, a home bill, a PDF with no account match).
6. A migration: a unique index on `ceb_bill_ingestions (source_type, source_message_id)`. The columns already exist
   from the 2026-04-23 design: `source_type` is `manual_upload` or `email_forward`, `source_message_id` the Resend
   `email_id`. Record it in `docs/MIGRATIONS.md`.
7. The missing-bill check in the freshness workflow (rule 9).
8. Docs: `docs/API.md` (the `inbound` action), `docs/SECURITY.md` (the non-Clerk endpoint), `docs/RUNBOOK.md`
   (setting up Gmail, Resend and DNS; switching modes; replaying a held email), and the CHANGELOG.
9. Ship in `shadow` mode. Switch to `auto` after two bills where "would have" matched what the owner did.

## Edge cases
- **Gmail pauses forwarding** (it can, if the forwarding address bounces): the missing-bill alert catches it.
- **EDL changes its sender address or domain** (it already moved from CEB to EDL once): rule 2 ignores the email, and rule 9 catches the missing bill. The fix is to
  update `BILL_SENDER_DOMAINS`.
- **Password-protected or scanned PDF:** extraction finds nothing, so it goes to review with "could not read the PDF".
- **A redesigned bill format:** fields come back `null`, so `validateExtraction` sends it to review. It is never
  guessed at.
- **Two bills in one email:** rule 3 sends it to review.
- **Resend is down:** Resend keeps the email and retries. Bills are monthly, so a few hours' delay is harmless.
- **The owner also uploads the same PDF by hand:** the SHA-256 dedupe makes the second copy a no-op, whichever comes
  first.
- **The bill arrives while that month's inverter summary is still incomplete** (the summary job runs twice a day):
  check 6 fails as unknown and the bill goes to review. In shadow mode, watch whether this happens often. If it
  does, re-run the gate when the summary lands instead of sending the bill to review.

## Acceptance criteria
- A forwarded solar bill appears in `ceb_data` within a minute in `auto` mode, with no email sent.
- A home bill sent to the intake address leaves no row, no Storage object and no email.
- Every gate failure produces exactly one email that names the failing checks.
- A replayed webhook changes nothing.
- An email from any other sender produces no email and no stored data.
- In `shadow` mode the review queue behaves exactly as today, and every bill produces one "would have" email.
- No bill for the expected day + 7 opens a GitHub issue.
- The function count stays at or under 12. No secret is prefixed `VITE_`.

## Open questions (before implementation)
1. ~~What marks the solar email apart?~~ **Answered 2026-11-10:** the subject ends with the account number
   (`EDL e-Bill for the month of <Month>-<YYYY> - <account number>`), so the filter matches the solar account exactly.
2. ~~The sending address and domain?~~ **Answered 2026-11-10:** `eBill@edl.lk` (EDL, Electricity Distribution Lanka),
   so `BILL_SENDER_DOMAINS=edl.lk`.
3. **Does Resend's received-email API return the original headers** (`Authentication-Results`, ARC) needed for the
   DKIM check in rule 2? If not, use ARC from the forwarded message, or settle for sender domain plus the private
   address.
4. **The `BILL_RATIO_MIN` / `BILL_RATIO_MAX` bounds** for check 5.6, set from the bills on record (LR-004's per-bill data has
   the ratios).
5. **Which domain** to use for receiving and sending.

## Current implementation files
- `api/ceb-bills/[action].js`: one function for the six bill endpoints (step 1, #247). The `inbound` action is not
  added yet.
- `api/_lib/billIntake.js`: `findDuplicate`, `read` (in memory, writes nothing), `store`, `download`, `loadTariff`,
  `saveExtraction`. The admin `upload` and `extract` endpoints use it (step 2). Tests: `tests/billIntake.test.js`.
- `api/_lib/billGate.js`: `evaluateBillGate()` for rule 5 and `ratioBoundsFromEnv()` (step 3). Not called by
  anything yet. Tests: `tests/billGate.test.js`.
- `scripts/sql/2026-11-10_bill_intake_source.sql`: the unique `(source_type, source_message_id)` index (step 6).
  `billIntake.findByMessage()` looks an email up, and `store({ sourceMessageId })` records it.
- `shared/domain/billSchedule.js` (`evaluateBillArrival`, tests `tests/billSchedule.test.js`) and
  `scripts/check_missing_bill.js`: rule 9 (step 7). The expected date is the latest bill plus the median of the last
  6 gaps; the alert fires 7 days later unless an upload waits for review. It runs as the `bill` job of
  `data-freshness-check.yml` and opens its own `missing-bill` issue, separate from the inverter outage issue.
