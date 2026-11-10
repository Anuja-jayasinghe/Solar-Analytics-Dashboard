// api/_lib/billIntake.js
//
// The steps of taking in a CEB bill PDF, shared by the admin endpoints (upload, extract) and,
// later, the email intake (LR-005, docs/logic-registry/LR-005-email-bill-intake.md).
//
// Why the steps are separate: the two paths run them in a different order.
//   admin upload   findDuplicate → store            (then, on request) download → read → saveExtraction
//   email intake   findDuplicate → read → (account check) → store → saveExtraction
// The email path reads the PDF from memory BEFORE anything is stored, so a home-consumption bill that
// slipped through the Gmail filter is discarded without ever being written (LR-005 rule 1).
//
// Nothing here talks to the network directly: the database client and the PDF text reader are passed
// in, so tests/billIntake.test.js covers every step with fakes.

import { buildStoragePath, createSha256, looksLikePdf } from './cebBillUploadUtils.js';
import { parseCebBillText, validateExtraction } from './cebBillParser.js';

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

/** Why a buffer cannot be a bill PDF, or null when it can. */
export function pdfProblem(buffer) {
  if (!buffer || buffer.length === 0) return 'empty';
  if (!looksLikePdf(buffer)) return 'not_pdf';
  return null;
}

/** The extraction row written to ceb_bill_extractions for one parse. */
export function extractionRow(ingestionId, extracted, validation) {
  return {
    ingestion_id: ingestionId,
    account_number: extracted.account_number,
    billing_month: extracted.billing_month,
    billing_period_start: extracted.billing_period_start || null,
    billing_period_end: extracted.billing_period_end || null,
    bill_issue_date: extracted.bill_issue_date || null,
    meter_reading: extracted.meter_reading_current,
    meter_reading_previous: extracted.meter_reading_previous,
    units_exported: extracted.units_exported,
    earnings: extracted.earnings,
    review_status: validation.status,
    validation_errors: validation.validation_errors,
    confidence_score: validation.confidence_score,
    // Column name is a leftover from the abandoned Document AI plan; it holds the regex
    // extractor's raw output. See docs/ARCHITECTURE.md.
    raw_ai_json: extracted
  };
}

/**
 * @param {{ db: object, extractText: (buffer: Buffer) => Promise<string>, bucket?: string }} deps
 *   db           a Supabase client (service role, server-side only)
 *   extractText  api/_lib/pdfText.js#extractPdfText, or a fake in tests
 */
export function createBillIntake({ db, extractText, bucket = DEFAULT_BUCKET }) {
  return {
    sha256: createSha256,

    /** The newest ingestion holding the same file, or null. Throws if the lookup fails. */
    async findDuplicate(fileSha256) {
      const { data, error } = await db
        .from('ceb_bill_ingestions')
        .select('id, file_path, received_at, status')
        .eq('file_sha256', fileSha256)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Duplicate check failed: ${error.message}`);
      return data ?? null;
    },

    /**
     * Write the PDF to Storage and create its ingestion row. If the row cannot be written the file is
     * removed again, so Storage never holds a bill no row points to. Throws on failure.
     */
    async store({ buffer, filename, contentType = 'application/pdf', ownerId, createdBy, sourceType, fileSha256 }) {
      const filePath = buildStoragePath({ adminId: ownerId, filename });

      const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(filePath, buffer, { contentType, upsert: false, cacheControl: '3600' });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: row, error: insertError } = await db
        .from('ceb_bill_ingestions')
        .insert({
          source_type: sourceType,
          file_path: filePath,
          file_sha256: fileSha256 ?? createSha256(buffer),
          status: 'received',
          created_by: createdBy
        })
        .select('id, received_at, status')
        .single();

      if (insertError) {
        await db.storage.from(bucket).remove([filePath]);
        throw new Error(`Failed to create ingestion row: ${insertError.message}`);
      }

      return { ingestionId: row.id, filePath, status: row.status, receivedAt: row.received_at };
    },

    /** The stored PDF as a Buffer, or null when Storage cannot return it. */
    async download(filePath) {
      const { data, error } = await db.storage.from(bucket).download(filePath);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },

    /**
     * The tariff in Settings, used only for bills that do not state their own rate. null when it is
     * missing or unreadable: the validator then says "no tariff available" instead of checking
     * earnings against an invented number.
     */
    async loadTariff() {
      const { data, error } = await db
        .from('system_settings')
        .select('setting_value')
        .eq('setting_name', 'rate_per_kwh')
        .maybeSingle();
      if (error) console.warn('rate_per_kwh lookup failed:', error.message);
      const tariff = data ? parseFloat(data.setting_value) : NaN;
      return Number.isFinite(tariff) ? tariff : null;
    },

    /**
     * Read a bill PDF held in memory: text → parsed fields → validation. Writes nothing.
     * Tabs between table cells are load-bearing for the meter-reading regex (see pdfText.js).
     */
    async read(buffer, tariff) {
      const text = await extractText(buffer);
      const extracted = parseCebBillText(text);
      return { extracted, validation: validateExtraction(extracted, tariff) };
    },

    /**
     * Save a parse as the ingestion's extraction, THEN remove the ones it replaces (so a failed insert
     * leaves the previous extraction in place), then set the ingestion's status. Throws on failure.
     */
    async saveExtraction(ingestionId, extracted, validation) {
      const { data: extraction, error } = await db
        .from('ceb_bill_extractions')
        .insert(extractionRow(ingestionId, extracted, validation))
        .select()
        .single();
      if (error) throw new Error(`Failed to save extraction record: ${error.message}`);

      const { error: cleanupError } = await db
        .from('ceb_bill_extractions')
        .delete()
        .eq('ingestion_id', ingestionId)
        .neq('id', extraction.id);
      // The new extraction is saved; a stale sibling is a nuisance, not a failure.
      if (cleanupError) console.warn('Could not remove superseded extractions:', cleanupError.message);

      const { error: statusError } = await db
        .from('ceb_bill_ingestions')
        .update({ status: validation.status })
        .eq('id', ingestionId);
      if (statusError) throw new Error(`Failed to update ingestion status: ${statusError.message}`);

      return extraction;
    }
  };
}
