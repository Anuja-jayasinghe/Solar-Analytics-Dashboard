import { verifyAdminToken } from '../_lib/verifyAdminToken.js';
import { extractPdfText } from '../_lib/pdfText.js';
import { parseCebBillText, validateExtraction } from '../_lib/cebBillParser.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

// Ingestion states from which a failure is recorded as `failed_extraction`. An ingestion that
// already has an extraction keeps its status when a re-parse fails: the earlier result is still
// on file, and flipping the label would make the review queue list the bill twice.
const NEVER_EXTRACTED = 'received';

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  // Hoisted so the catch block can tell whether this ingestion was ever extracted.
  let ingestion = null;
  const ingestionId = req.body?.ingestionId;

  const markFailed = async () => {
    if (ingestion?.status !== NEVER_EXTRACTED) return;
    const { error } = await supabase
      .from('ceb_bill_ingestions')
      .update({ status: 'failed_extraction' })
      .eq('id', ingestion.id);
    if (error) console.error('Could not mark ingestion failed_extraction:', error.message);
  };

  try {
    const adminUser = await verifyAdminToken(req, res)
    if (!adminUser) return

    if (blockOnConfigProblem(res)) return;

    if (!ingestionId || typeof ingestionId !== 'string') {
      return res.status(400).json({ error: 'Missing ingestionId in request body.' });
    }

    // 1. Fetch ingestion details
    const { data: fetched, error: fetchError } = await supabase
      .from('ceb_bill_ingestions')
      .select('*')
      .eq('id', ingestionId)
      .maybeSingle();

    if (fetchError) throw new Error(`Ingestion lookup failed: ${fetchError.message}`);
    if (!fetched) {
      return res.status(404).json({ error: 'Ingestion record not found.' });
    }
    ingestion = fetched;

    if (ingestion.status === 'approved') {
      return res.status(400).json({ error: 'Ingestion is already approved and cannot be re-parsed.' });
    }

    // Everything that can reject the request happens BEFORE anything is changed. The previous
    // version deleted the existing extraction first, so a download or parse failure lost it.
    if (!ingestion.file_path.toLowerCase().endsWith('.pdf')) {
      await markFailed();
      return res.status(400).json({ error: 'Only PDF files are supported for programmatic parsing.' });
    }

    // 2. Fetch file buffer from Storage
    const { data: fileData, error: storageError } = await supabase
       .storage
       .from(BUCKET)
       .download(ingestion.file_path);

    if (storageError || !fileData) {
       return res.status(500).json({ error: 'Failed to download file from storage.' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 3. Extract text. pdfjs-dist directly — see api/_lib/pdfText.js for why not pdf-parse.
    //    Tabs between table cells are load-bearing for the meter-reading regex.
    const text = await extractPdfText(buffer);

    // Parsing lives in api/_lib/cebBillParser.js so it can be covered by fixtures without a
    // database or a live upload. See the tests in tests/cebBillParser.test.js.
    const extractedData = parseCebBillText(text);

    // 4. The configured tariff — a fallback for bills that do not state their own rate.
    //    There is no default: when the setting is missing or unreadable the validator reports
    //    "no tariff available" rather than checking earnings against an invented number.
    const { data: settingsRow, error: settingsError } = await supabase
       .from('system_settings')
       .select('setting_value')
       .eq('setting_name', 'rate_per_kwh')
       .maybeSingle();

    if (settingsError) console.warn('rate_per_kwh lookup failed:', settingsError.message);

    const parsedTariff = settingsRow ? parseFloat(settingsRow.setting_value) : NaN;
    const currentTariff = Number.isFinite(parsedTariff) ? parsedTariff : null;

    // 5. Run Validation
    const validationResult = validateExtraction(extractedData, currentTariff);

    // 6. Save the new extraction, THEN remove the ones it replaces — so a failed insert leaves
    //    the previous extraction in place instead of nothing.
    const extractionPayload = {
        ingestion_id: ingestionId,
        account_number: extractedData.account_number,
        billing_month: extractedData.billing_month,
        billing_period_start: extractedData.billing_period_start || null,
        billing_period_end: extractedData.billing_period_end || null,
        bill_issue_date: extractedData.bill_issue_date || null,
        meter_reading: extractedData.meter_reading_current,
        meter_reading_previous: extractedData.meter_reading_previous,
        units_exported: extractedData.units_exported,
        earnings: extractedData.earnings,
        review_status: validationResult.status,
        validation_errors: validationResult.validation_errors,
        confidence_score: validationResult.confidence_score,
        // Column name is a leftover from the abandoned Document AI plan; it holds the
        // regex extractor's raw output. See docs/ARCHITECTURE.md.
        raw_ai_json: extractedData
    };

    const { data: extractionInsert, error: dbError } = await supabase
        .from('ceb_bill_extractions')
        .insert(extractionPayload)
        .select()
        .single();

    if (dbError) {
        throw new Error(`Failed to save extraction record: ${dbError.message}`);
    }

    const { error: cleanupError } = await supabase
        .from('ceb_bill_extractions')
        .delete()
        .eq('ingestion_id', ingestionId)
        .neq('id', extractionInsert.id);

    if (cleanupError) {
        // The new extraction is saved; a stale sibling is a nuisance, not a failure.
        console.warn('Could not remove superseded extractions:', cleanupError.message);
    }

    const { error: statusError } = await supabase
        .from('ceb_bill_ingestions')
        .update({ status: validationResult.status })
        .eq('id', ingestionId);

    if (statusError) throw new Error(`Failed to update ingestion status: ${statusError.message}`);

    return res.status(200).json({
        success: true,
        extraction: extractionInsert,
        validation: validationResult
    });

  } catch (err) {
      console.error('Extraction flow error', err);
      try {
          await markFailed();
      } catch (e) {
          console.error('Secondary crash updating status:', e);
      }
      return res.status(500).json({ error: 'Extraction failed internally.' });
  }
}
