# [TEMP] CEB Bill Entry Process - Current Implementation

> **Note:** This is a temporary document outlining the currently implemented processes for entering CEB billing data into the Solar Analytics Dashboard, based on the `CebDataManagement` components.

There are two primary pathways for data entry: a direct **Manual Entry** method and an **Automated OCR Pipeline**.

## 1. Automated OCR Pipeline (Primary Process)

This is a three-step process designed to minimize manual data entry by extracting data directly from digital bills.

### Step 1: File Upload
- **Trigger**: User selects a CEB bill file (supports `.pdf`, `.png`, `.jpg` up to 10MB) and clicks "Upload Bill" (`index.jsx`).
- **Action**: The file is securely uploaded to the backend storage via the `/api/ceb-bills/upload` endpoint.
- **Processing**: Once stored, it receives an `ingestionId`. The system immediately triggers the programmatic parser (`/api/ceb-bills/extract`) to read the structured data from the document in the background.
- **Validation**: If a duplicate bill is uploaded, the system detects it and warns the user instead of creating duplicate records.

### Step 2: Parsing Review Queue
- **Location**: `VerificationQueue.jsx`
- **Function**: Once parsed, the bill lands in the **Parsing Review Queue**.
- **Data Extracted**: The system attempts to auto-extract critical fields: `Account Number`, `Billing Month`, `Period Start`, `Period End`, `Meter Reading`, `Units Exported`, and `Earnings`.
- **Status Indicators**: The UI provides visual cues on the extraction quality:
  - ✅ **LOOKS GOOD** (`auto_approved`): High confidence extraction.
  - ⚠️ **NEEDS REVIEW** (`pending_review`): Parsed, but requires human verification (e.g., potential validation errors are highlighted in yellow).
  - ❌ **PARSE FAILED**: Unable to read the document. Provides an option to "Retry Parsing".
- **Interactivity**: The user can manually edit any of the extracted fields directly within the queue grid to correct any parser mistakes.

### Step 3: Approve & Save
- **Action**: Once satisfied with the extracted numbers, the user clicks **"Approve & Save"**.
- **Database Update**: This pushes the cleaned and verified data into the main `ceb_data` database table, securely logging it for dashboard charts. It uses an upsert mechanism based on `account_number` and `billing_month`.
- **Completion**: The record's status in `ceb_bill_extractions` and `ceb_bill_ingestions` is updated to 'approved'. The bill is moved out of the queue and into the **"Verified History"** log at the bottom of the page.

---

## 2. Manual Data Entry

For scenarios where a digital file is unavailable or a quick reading needs to be logged, a dedicated manual entry form is provided.

- **Location**: `CebForm.jsx`
- **Fields**: User manually inputs `BILL_DATE`, `ACCOUNT_NUMBER`, `BILLING_MONTH` (e.g., `2024 JAN`), `METER_READING`, `UNITS_EXPORTED`, and `EARNINGS`.
- **Conflict Handling**: Upon clicking **"[ COMMIT_NEW_RECORD ]"**, the system uses an "upsert" mechanism. If a record for that specific `account_number` and `billing_month` already exists, it updates the existing record rather than creating a duplicate.

---

## 3. File Storage Management

The implementation includes a collapsible **"Files In Storage"** section (`index.jsx`) for administrative oversight.

- **Capabilities**:
  - View all files currently in backend storage.
  - Check processing statuses (`approved`, `pending_review`, `failed`).
  - Manually trigger a "Parse" action if a file becomes stuck.
  - Completely delete a file and its associated extractions from the system to start fresh.

---
*Note: The `ceb_data` table acts as the final source of truth for the dashboard charts, which are populated securely through either the manual form or an approved queue item.*
