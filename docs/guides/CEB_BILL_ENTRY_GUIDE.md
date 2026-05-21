# 🧾 CEB Bill Entry Process - Ingestion & OCR Guide

This guide outlines the processes for entering CEB (Ceylon Electricity Board) billing data into the Solar Analytics Dashboard, leveraging both the direct **Manual Entry** form and the **Automated OCR Ingestion Pipeline**.

---

## 1. Automated OCR Pipeline (Primary Process)

The automated OCR ingestion pipeline is a three-step workflow designed to minimize manual typing by extracting data directly from digital bills.

```mermaid
graph TD
    A[Upload Bill PDF/Image] --> B[Auto-parse via Document AI]
    B --> C[Parsing Review Queue]
    C -->|Verify & Edit| D[Approve & Save]
    D --> E[Final ceb_data Table]
```

### Step 1: File Upload
- **Trigger**: The admin selects a CEB bill file (supports `.pdf`, `.png`, `.jpg` up to 10MB) and clicks "Upload Bill" inside the Admin Dashboard.
- **Action**: The file is securely uploaded to the private Supabase Storage bucket (`ceb_bills`) via the `/api/ceb-bills/upload` endpoint.
- **Processing**: The file receives an `ingestionId`, and the system automatically triggers the background parser (`/api/ceb-bills/extract`).
- **Validation**: If a duplicate bill is uploaded, the system detects the hash overlap and alerts the user rather than creating duplicate records.

### Step 2: Parsing Review Queue
- **Location**: `VerificationQueue.jsx`
- **Function**: Once parsed, the bill lands in the **Parsing Review Queue** waiting for user verification.
- **Fields Extracted**: The system extracts critical fields: `Account Number`, `Billing Month`, `Period Start`, `Period End`, `Meter Reading`, `Units Exported`, and `Earnings`.
- **Status Indicators**:
  - ✅ **LOOKS GOOD** (`auto_approved`): High-confidence extraction.
  - ⚠️ **NEEDS REVIEW** (`pending_review`): Parsed, but requires human verification (e.g. potential validation errors or low extraction scores highlighted in yellow).
  - ❌ **PARSE FAILED**: Unable to read the document. Provides an option to "Retry Parsing".
- **Interactivity**: The user can manually edit any of the extracted fields directly within the queue grid to correct any parser mistakes.

### Step 3: Approve & Save
- **Action**: Once satisfied with the extracted values, the user clicks **"Approve & Save"**.
- **Database Update**: This pushes the finalized data into the main `ceb_data` database table, securely logging it for dashboard charts. It uses an upsert mechanism based on `account_number` and `billing_month`.
- **Completion**: The record's status in `ceb_bill_extractions` and `ceb_bill_ingestions` is updated to `'approved'`. The bill is moved out of the queue and into the **"Verified History"** log at the bottom of the page.

---

## 2. Manual Data Entry

For scenarios where a digital file is unavailable or a quick reading needs to be logged, a dedicated manual entry form is provided.

- **Location**: `CebForm.jsx`
- **Fields**: User manually inputs `BILL_DATE`, `ACCOUNT_NUMBER`, `BILLING_MONTH` (e.g., `2024 JAN`), `METER_READING`, `UNITS_EXPORTED`, and `EARNINGS`.
- **Conflict Handling**: Upon clicking **"[ COMMIT_NEW_RECORD ]"**, the system uses an "upsert" mechanism. If a record for that specific `account_number` and `billing_month` already exists, it updates the existing record rather than creating a duplicate.

---

## 3. File Storage Management

The implementation includes a collapsible **"Files In Storage"** section for administrative oversight.

- **Capabilities**:
  - View all files currently in backend storage.
  - Check processing statuses (`approved`, `pending_review`, `failed`).
  - Manually trigger a "Parse" action if a file becomes stuck.
  - Completely delete a file and its associated extractions from the system to start fresh.

---

## 4. Planned Robustness & Data Integrity Enhancements

To ensure the system remains highly robust, user-friendly, and free of "orphaned" records (e.g., a file sitting in storage when the database record is deleted), the following architectural improvements are planned:

### A. Storage Optimization & Professional Cleanup
- **Goal**: Maintain a clean, professional storage environment by ensuring that only fully vetted and approved files consume storage space.
- **Implementation**: When a file is uploaded, it is held temporarily. If a file is **rejected** in the verification queue, or left unapproved for an extended period, it is automatically and permanently purged from the storage bucket. The storage bucket must only serve as an archive for `approved` CEB bills.

### B. Intelligent Duplicate Prevention & Data Hierarchy
- **Goal**: Prevent duplicate records for the same billing month, especially during the transition from historical manual data entry to the automated pipeline.
- **Implementation**: The main `ceb_data` table enforces a strict unique constraint on `(account_number, billing_month)`. 
- **Conflict Resolution (The Hierarchy)**: If an automated bill is parsed and approved for a month that already has a `manual_entry` record, the system will **automatically override** the manual entry with the verified parsed data. Automated, proven data always takes precedence over historical manual entries.

### C. Centralized Deletion & Cascading Cleanups
- **Current Issue**: Deleting an upload from "Files in Storage" cleans up the storage bucket and extraction tables correctly. However, deleting a finalized record directly from the main CEB Table leaves the original PDF in storage.
- **Solution - Centralized API**: Create a single `/api/ceb-bills/delete-record` endpoint. When a user deletes a record from the frontend table, this endpoint will securely execute a transaction that:
  1. Deletes the row in `ceb_data`.
  2. Deletes the row in `ceb_bill_extractions`.
  3. Deletes the row in `ceb_bill_ingestions`.
  4. Deletes the physical file from the `ceb_bills` storage bucket.
- **Solution - Database Triggers**: Implement Postgres functions/triggers in Supabase that listen for `DELETE` operations on `ceb_data` and automatically remove associated ingestions and storage files.

### D. User-Friendly Data Traceability (UI/UX)
- **"View Original Bill"**: In the main CEB Data Table, add a link to view the original PDF for records created via the OCR pipeline, proving the data's source.
- **Source Indicators**: Display a small icon next to records in the main table indicating if they were "Manually Entered" ✍️ or "Auto-Parsed" 🤖.
- **Explicit Deletion Warnings**: When deleting an auto-parsed record, the confirmation dialog will explicitly warn: *"This will permanently delete the record AND the associated PDF bill from storage."*

### E. Extraction Reliability & Validation
- **Confidence Scores**: Update the parsing prompt to return a "confidence score". Low confidence parses (e.g., due to blurry images) will automatically flag as `needs_review`.
- **Strict Math Validation**: Implement a backend check before queuing: `(Meter Reading Current - Meter Reading Previous) = Units Exported`. If the math does not align with the extracted text, the system will auto-flag the bill for human review.
