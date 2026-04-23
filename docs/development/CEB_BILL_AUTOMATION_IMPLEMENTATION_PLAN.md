# CEB Bill Automation Implementation Plan

## 1. Purpose

This document describes how to evolve CEB bill entry from manual CRUD to an automated, event-driven pipeline in two phases:

- Phase 1: Bill upload + event-driven OCR extraction (Google Document AI) + assisted confirmation
- Phase 2: Email-driven ingestion + automatic extraction + verification email loop

This plan is written for developers, QA, DevOps, and non-project stakeholders.

## 2. Executive Summary

Current CEB data entry works for manual operation, but it does not support file ingestion, OCR, or email workflows yet. Given the constraints of a purely client-side Vite application, the recommended path is to leverage the existing Supabase backend for a fully serverless, event-driven architecture.

Fastest low-risk path:

1. Keep existing `ceb_data` logic intact.
2. Add a new ingestion pipeline around it using Supabase Storage, Webhooks, and Edge Functions.
3. Insert into `ceb_data` only after validation confidence checks and/or admin approval.
4. Add email automation only after Phase 1 OCR quality is stable.

This incremental approach avoids breaking dashboards and analytics that already depend on `ceb_data`.

## 3. Current State (Verified in Repository)

### 3.1 Existing Capabilities

- Manual CEB CRUD exists in `src/components/admin/CebDataManagement/index.jsx`.
- CEB fields currently entered manually: `bill_date`, `meter_reading`, `units_exported`, `earnings`.
- Dashboard analytics already read from `ceb_data`.
- Supabase data and auth context are already integrated.

### 3.2 What Is Missing Today

- No file upload endpoint or secure storage vault for bills.
- No OCR integration (no bill parsing service).
- No inbound email webhook/receiver for bills.
- No extraction-review queue/state machine.
- Deduplication safeguards and proper billing cycle attribution (for example, distinguishing bill issue date from actual generation period).

## 4. Target Architecture

### 4.1 Design Principle

Preserve `ceb_data` as the canonical analytics table while adding an ingestion pipeline sidecar. Use an event-driven serverless architecture (Supabase) to avoid the need for an always-on backend.

### 4.2 High-Level Flow (Serverless Event-Driven)

1. The Vault: Admin uploads a PDF to a private Supabase Storage bucket (`ceb_bills`).
2. The Watcher: A Supabase Database Webhook listens for `INSERT` on the storage table.
3. The Engine: The webhook triggers a Supabase Edge Function (or Vercel Serverless Function).
4. OCR Processing: The function sends the document to Google Cloud Document AI.
5. Validation and Formatting: Parse multi-lingual JSON output, map to schema, and run duplicate checks.
6. Staging: Insert into `ceb_bill_extractions` with `pending_review`.
7. Approval: Admin approves extraction and writes final values to `ceb_data`.

## 5. Data Model Changes

Create new tables without immediately altering existing analytics logic.

### 5.1 New Table: `ceb_bill_ingestions`

Purpose: Track each source bill file and pipeline lifecycle.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Primary key |
| `source_type` | text | `manual_upload`, `email_forward`, `auto_mailbox` |
| `source_message_id` | text nullable | Email provider message id |
| `file_path` | text | Supabase Storage path |
| `file_sha256` | text | Raw file deduplication |
| `received_at` | timestamptz | Ingestion timestamp |
| `status` | text | `received`, `ocr_done`, `pending_review`, `approved`, `rejected`, `failed` |
| `error_message` | text nullable | Processing failure details |
| `created_by` | text nullable | Admin user id/email |

### 5.2 New Table: `ceb_bill_extractions`

Purpose: Store OCR output before final posting to `ceb_data`, including exact billing periods and NET++ specific metrics.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Primary key |
| `ingestion_id` | UUID FK | References `ceb_bill_ingestions.id` |
| `account_number` | text nullable | Service account identifier |
| `billing_period_start` | date nullable | Example: `2026-02-03` |
| `billing_period_end` | date nullable | Example: `2026-03-05` |
| `bill_issue_date` | date nullable | Example: `2026-03-05` |
| `meter_reading` | numeric nullable | Extracted meter value |
| `units_consumed` | numeric nullable | Required for full NET++ picture |
| `units_exported` | numeric nullable | Exported generation units |
| `earnings` | numeric nullable | Bill payout value |
| `confidence_overall` | numeric nullable | Overall extraction confidence |
| `confidence_json` | jsonb nullable | Field-level confidence map |
| `parsed_json` | jsonb nullable | Structured extracted payload |
| `review_status` | text | `unreviewed`, `approved`, `corrected`, `rejected` |
| `reviewed_by` | text nullable | Reviewer id/email |

### 5.3 Additions to Existing `ceb_data`

To maintain lineage, support new NET++ metrics, and enforce strict deduplication:

- `source_ingestion_id` UUID nullable
- `units_consumed` numeric (to track actual usage vs export)
- `entry_mode` text default `manual` (`manual`, `ocr_assisted`, `email_automated`)

Constraint:

- Add a composite unique index on (`account_number`, `billing_period_start`) to prevent double-entry of the same billing cycle, even if file hash differs.

## 6. API and Service Changes (Supabase / Serverless)

### Storage Bucket Policies

- Create `ceb_bills` bucket.
- Enforce RLS so only authenticated users with admin roles can `INSERT` and `SELECT`.

### Supabase Edge Function: `process-ceb-bill`

- Triggered automatically via Supabase Webhook on storage `INSERT`.
- Retrieves file, calls Google Document AI, and processes response.
- Writes to `ceb_bill_extractions` with `pending_review` status.

### Vercel API: `POST /api/ceb-bills/approve/:extractionId`

- Admin-authenticated endpoint.
- Writes confirmed values to `ceb_data`.
- Updates ingestion status.

### Supabase Edge Function: `inbound-email-webhook` (Phase 2)

- Webhook endpoint for Postmark or Mailgun.
- Extracts PDF attachment and uploads to Supabase Storage.
- Upload automatically triggers `process-ceb-bill`.

## 7. Tooling Options and Recommendation

### 7.1 OCR Engine: Google Cloud Document AI (Selected)

Why selected:

- CEB bill is highly structured but multi-lingual (English, Sinhala, Tamil interleaved).
- Standard OCR tools struggle with mixed-script lines.
- Document AI performs well on complex South Asian layouts and multilingual form extraction.
- Bonus: approximately USD 65/month free tier can cover expected volume.

### 7.2 Email Ingestion: Postmark or Mailgun (Selected)

Why selected:

- Inbound webhook model is simple and reliable.
- Configure dedicated mailbox such as `bills@yourdomain.com`.
- Provider receives email, parses attachment, and POSTs directly to Supabase Edge Function.
- Frontend is bypassed for ingestion, reducing client-side risk.

## 8. Phase Plan

### 8.1 Phase 1: Upload + Event-Driven OCR + Assisted Approval

Goal: Eliminate manual typing while keeping human confirmation.

Deliverables:

- `ceb_bills` Storage bucket and DB migrations
- Webhook and `process-ceb-bill` Edge Function setup
- Google Document AI integration
- Admin queue UI for review/approve/reject
- Write approved records to existing `ceb_data`

Exit criteria:

- Document uploads trigger background extraction successfully
- Zero analytics regressions in charts/cards
- Deduplication catches repeated uploads

### 8.2 Phase 2: Email Automation

Goal: Remove manual upload step so bills auto-enter the pipeline from email.

Deliverables:

- Postmark/Mailgun inbound routing to `inbound-email-webhook`
- End-to-end automation: email -> storage -> OCR -> review queue
- Outbound verification email sent to admin via Resend/Postmark

## 9. Validation and Business Rules

Required fields:

- `billing_period_start`
- `meter_reading`
- `units_exported`

Numeric sanity:

- `meter_reading`, `units_consumed`, and `units_exported` must be non-negative
- `earnings` should align closely with `units_exported * export_tariff`

Deduplication guards:

1. Level 1: `file_sha256` prevents exact file reprocessing.
2. Level 2: (`account_number`, `billing_period_start`) prevents duplicate monthly bill insertion from a different scan.

## 10. Security and Compliance

- Keep bill files in private Supabase bucket with strict RLS.
- Verify webhook signatures for inbound email to prevent spoofing.
- Log who approved or corrected each extraction.

## 11. Known Bottlenecks and Mitigation

1. Timeout limits: Serverless functions have execution limits. If files are large, configure Edge Function timeout appropriately (for example, 60 seconds).
2. Duplicate storms: Webhook retries can create race conditions. Enforce DB unique constraints to fail safely and idempotently.

## 12. Immediate Next Steps

1. Run DB migrations to add `ceb_bill_ingestions`, `ceb_bill_extractions`, and update `ceb_data` (`units_consumed` + composite key).
2. Set up Supabase `ceb_bills` storage bucket.
3. Create Google Cloud project, enable Document AI, and provision service account/API access.
4. Scaffold first Supabase Edge Function connecting Storage uploads to Document AI.

---

**Document owner:** Engineering  
**Last updated:** 2026-04-23  
**Status:** Proposed and Revised (Serverless/Supabase Architecture)
