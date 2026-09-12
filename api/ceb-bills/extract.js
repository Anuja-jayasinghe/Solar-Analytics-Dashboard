import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';
import { PDFParse } from 'pdf-parse';
import { parseCebBillText, validateExtraction } from '../_lib/cebBillParser.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);



export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  try {
    const adminUser = await verifyAdminToken(req, res)
    if (!adminUser) return

    const { ingestionId } = req.body;
    if (!ingestionId) {
       return res.status(400).json({ error: 'Missing ingestionId in request body.' });
    }

    // 1. Fetch ingestion details
    const { data: ingestion, error: fetchError } = await supabase
      .from('ceb_bill_ingestions')
      .select('*')
      .eq('id', ingestionId)
      .single();

    if (fetchError || !ingestion) {
       return res.status(404).json({ error: 'Ingestion record not found.' });
    }

    if (ingestion.status === 'approved') {
       return res.status(400).json({ error: 'Ingestion is already approved and cannot be re-parsed.' });
    }

    // Delete any existing extraction records for this ingestion so we can re-parse cleanly
    await supabase.from('ceb_bill_extractions').delete().eq('ingestion_id', ingestionId);

    // 2. Fetch file buffer from Storage
    const { data: fileData, error: storageError } = await supabase
       .storage
       .from(BUCKET)
       .download(ingestion.file_path);

    if (storageError || !fileData) {
       return res.status(500).json({ error: 'Failed to download file from storage.' });
    }

    // Verify it's a PDF before parsing
    if (!ingestion.file_path.toLowerCase().endsWith('.pdf')) {
        await supabase.from('ceb_bill_ingestions').update({ status: 'failed_extraction' }).eq('id', ingestionId);
        return res.status(400).json({ error: 'Only PDF files are supported for programmatic parsing.' });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 3. Parse PDF using pdf-parse v2.4.5 class-based API
    // PDFParse accepts { data: Buffer } and getText() returns a TextResult with .text
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    // Use raw text directly — v2.4.5 preserves real tabs as delimiters
    const text = pdfData.text;
    await parser.destroy();

    // Parsing lives in api/_lib/cebBillParser.js so it can be covered by fixtures without a
    // database or a live upload. See the tests in tests/cebBillParser.test.js.
    const extractedData = parseCebBillText(text);

    // 4. Fetch the current tariff
    //
    // A `select * from ceb_data order by bill_date desc limit 1` used to run here too, passed
    // into validateExtraction as `latestDbRecord` and then never read by it. Removed — it was
    // a round-trip per upload for nothing.
    const { data: settingsRow } = await supabase
       .from('system_settings')
       .select('setting_value')
       .eq('setting_name', 'rate_per_kwh')
       .maybeSingle();
    
    const currentTariff = settingsRow ? parseFloat(settingsRow.setting_value) : 37.00;

    // 5. Run Validation
    const validationResult = validateExtraction(extractedData, currentTariff);

    // 6. Save to ceb_bill_extractions & update status
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

    await supabase
        .from('ceb_bill_ingestions')
        .update({ status: validationResult.status })
        .eq('id', ingestionId);

    return res.status(200).json({ 
        success: true, 
        extraction: extractionInsert,
        validation: validationResult
    });

  } catch (err) {
      console.error('Extraction flow error', err);
      // Ensure ingestion doesn't stay 'received' forever if things crash
      try {
          if (req.body?.ingestionId) {
             await supabase.from('ceb_bill_ingestions').update({ status: 'failed_extraction' }).eq('id', req.body.ingestionId);
          }
      } catch (e) {
          console.error('Secondary crash updating status:', e);
      }
      return res.status(500).json({ error: 'Extraction failed internally.', details: err?.message });
  }
}
