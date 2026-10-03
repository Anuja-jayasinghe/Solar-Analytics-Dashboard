# CEB bill entry

How a CEB bill becomes a row in `ceb_data`, from the operator's side. For how the pieces work
underneath, see [`ARCHITECTURE.md` §4](../ARCHITECTURE.md#4-pipeline-b--ceb-bills); for the exact
requests, [`API.md`](../API.md).

> **The extractor is not OCR and not AI.** It reads the PDF's text layer with `pdfjs-dist` and
> applies nine regular expressions pinned to the bill's layout. Both the pre-2026 format and the
> 2026 `ebill-edl-v.1.0.2` format are supported. It cannot read a scanned image.

## 1. Adding a bill from a PDF (the normal path)

Admin dashboard → **CEB Billing**.

1. **Upload the PDF.** PDF only, up to 10 MB. The file is checked by its bytes, not just its
   name. Uploading the same file twice is safe: it is recognised by SHA-256 and rejected as a
   duplicate before anything is stored.
2. **Parsing runs automatically.** The result lands in the **Parsing Review Queue**. If parsing
   fails, the bill appears there as a failed parse with a **Retry** option.
3. **Review it — even when it says Looks good.** The queue shows:

   | Status | Meaning |
   |---|---|
   | `auto_approved` | Parsed, and the three internal checks passed |
   | `pending_review` | Parsed, but a check failed; the reason is listed |
   | `failed_extraction` | The PDF could not be read or saved |

   The three checks are: units × rate = earnings, meter reading difference = units exported,
   and period start before period end. Passing them proves the bill is **internally consistent**.
   It cannot prove the right bill was parsed or that the expressions matched the right table
   rows. That judgement is why a person still approves every bill.

   Every extracted field is editable in the queue. To compare against the original, open the
   PDF from the bill's row in the main records table (see *Files and previews* below).
4. **Approve & Save.** This writes the `ceb_data` row and marks the extraction and the upload
   approved, in one step. An existing row for the same account and month is **updated**, not
   duplicated. The bill moves to *Verified History*.

### Missing versus zero

A field the parser could not read is left **blank** in the queue, with the reason listed. A `0` in a field
means the bill printed zero. Do not type `0` to get past a blank field — a fabricated zero is
indistinguishable from a real one once saved. If a figure is genuinely missing from the bill,
leave it flagged and investigate.

### If the figures are wrong or empty

Almost always the bill layout changed. See the runbook:
[Bill extraction produces wrong or empty figures](../RUNBOOK.md#bill-extraction-produces-wrong-or-empty-figures).

## 2. Manual entry

For a bill you have no PDF for. The form (`CebForm.jsx`) takes bill date, account number, billing
month (e.g. `2026 SEP`), meter reading, units exported and earnings.

Saving **upserts** on account number + billing month, so entering a month that already exists
updates it. Always fill in the account number: the uniqueness rule cannot see a row whose
account number is blank, so a blank one can create a duplicate of an existing month.

Manual entries have no PDF and no upload record. A later PDF for the same month, once approved,
replaces the manual row.

## 3. Files in storage

The collapsible **Files in storage** panel lists every upload with its status. From it you can:

- **Parse** an upload that is stuck at `received`.
- **Delete** an upload. This is destructive: it removes the file, its extraction **and the
  `ceb_data` row it produced**. The dashboard's figures for that month change immediately.

Deleting a finalised row from the main table does the same thing from the other end: the row,
its extraction, its upload record and the stored PDF all go.

### Files and previews

A row in the main records table that came from a PDF has a **preview** action. It opens the
original bill through a link that lasts five minutes and is generated for you each time; only
admins can request one.

## 4. Things that are not automatic

- An upload that is never approved stays in storage until someone deletes it. Nothing purges it.
- There is no email ingestion. Bills are downloaded from CEB and uploaded by hand.
- Approval is the only step that touches the figures on the dashboard.
