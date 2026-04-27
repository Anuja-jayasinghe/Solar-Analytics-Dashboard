import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';
import { PDFParse } from 'pdf-parse';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

function validateExtraction(result, latestDbRecord, currentTariff = 37.00) {
    const errors = [];
    let status = "auto_approved";

    // 1. Sanity Checks
    if (!result.meter_reading_current || result.meter_reading_current <= 0) errors.push("Invalid current meter reading");
    if (!result.units_exported || result.units_exported < 0) errors.push("Invalid exported units");
    if (!result.earnings || result.earnings < 0) errors.push("Invalid earnings");
    if (!result.billing_month) errors.push("Missing billing month");

    // 2. Proofing checks (from user script)
    const expectedEarnings = (result.units_exported * currentTariff).toFixed(2);
    const earningsDifference = Math.abs(parseFloat(expectedEarnings) - result.earnings);
    if (earningsDifference >= 1.00) { 
        errors.push(`Math mismatch: ${result.units_exported} units at Rs.${currentTariff} should be Rs.${expectedEarnings}, but extracted Rs.${result.earnings}`);
    }

    const calculatedUnits = result.meter_reading_current - result.meter_reading_previous;
    if (calculatedUnits !== result.units_exported) { 
        errors.push(`Meter mismatch: Current (${result.meter_reading_current}) - Prev (${result.meter_reading_previous}) = ${calculatedUnits}, but extracted units = ${result.units_exported}`);
    }

    if (result.billing_period_start && result.billing_period_end) {
        if (new Date(result.billing_period_start) >= new Date(result.billing_period_end)) {
            errors.push("Timeline error: Billing period start is not before end date.");
        }
    } else {
        errors.push("Missing billing period dates.");
    }

    if (errors.length > 0) status = "pending_review";

    return { 
        status, 
        validation_errors: errors,
        clean_data: result 
    };
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
    
    // 3. Parse PDF using pdf-parse v2.4.5 PDFParse class
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    // Use raw text directly — v2.4.5 preserves real tabs as delimiters
    const text = pdfData.text;
    parser.destroy();

    // --- REGEX EXTRACTION ---
    // Account Number: "Electricity A/C No.: 4924089702"
    const accountMatch   = text.match(/Electricity A\/C No\.:\s*(\d+)/i);
    // v2.4.5 raw: "2024 SEP\tMonth:\n"  — tab between year+month and "Month:"
    const monthMatch     = text.match(/([0-9]{4} [A-Z]{3})\s+Month:/i);
    // Bill Date is clean: "Bill Date: 9/5/2024 9:59:05 AM"
    const issueDateMatch = text.match(/Bill Date:\s*([0-9\/]+)/i);

    // Units exported: "No. of Units Exported (kWh) 3676" (space-separated on same line)
    const unitsMatch    = text.match(/No\. of Units Exported \(kWh\)\s+(\d+)/i);
    // Earnings: "Charge for Units Exported (Rs.) 136,012.00"
    const earningsMatch = text.match(/Charge for Units Exported \(Rs\.\)\s+([\d,]+\.\d{2})/i);

    // --- METER READING EXTRACTION ---
    // v2.4.5 raw meter rows: "14\t3679\t2024-09-05"
    // Pattern: capture tab-separated reading and date on the same line
    const meterReadingPattern = /\t(\d+)\t(\d{4}-\d{2}-\d{2})/g;
    let meterMatches = [];
    let hit;

    while ((hit = meterReadingPattern.exec(text)) !== null) {
        meterMatches.push({ reading: parseInt(hit[1]), date: hit[2] });
    }
    // Sort by date ascending: first entry = previous reading, last = current reading
    meterMatches.sort((a, b) => new Date(a.date) - new Date(b.date));


    const unitsExported = unitsMatch ? parseInt(unitsMatch[1]) : 0;
    let readingPrev = 0;
    let readingCurr = 0;
    let periodStart = null;
    let periodEnd   = null;

    if (meterMatches.length >= 2) {
        readingPrev = meterMatches[0].reading;
        readingCurr = meterMatches[meterMatches.length - 1].reading;
        periodStart = meterMatches[0].date;
        periodEnd   = meterMatches[meterMatches.length - 1].date;
    } else if (meterMatches.length === 1) {
        readingCurr = meterMatches[0].reading;
        periodEnd   = meterMatches[0].date;
    }

    const extractedData = {
        account_number: accountMatch ? accountMatch[1] : null,
        billing_month: monthMatch ? monthMatch[1].toUpperCase() : null,
        bill_issue_date: issueDateMatch ? issueDateMatch[1] : null,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        units_exported: unitsExported,
        earnings: earningsMatch ? parseFloat(earningsMatch[1].replace(/,/g, '')) : 0,
        meter_reading_current: readingCurr,
        meter_reading_previous: readingPrev
    };

    // 4. Fetch the latest DB record for validation history
    const { data: latestDbRecord } = await supabase
       .from('ceb_data')
       .select('*')
       .order('bill_date', { ascending: false })
       .limit(1)
       .maybeSingle();

    // Fetch the current tariff
    const { data: settingsRow } = await supabase
       .from('system_settings')
       .select('setting_value')
       .eq('setting_name', 'rate_per_kwh')
       .maybeSingle();
    
    const currentTariff = settingsRow ? parseFloat(settingsRow.setting_value) : 37.00;

    // 5. Run Validation
    const validationResult = validateExtraction(extractedData, latestDbRecord, currentTariff);

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
      // parser.destroy() not needed with function-based API
      return res.status(500).json({ error: 'Extraction failed internally.', details: err?.message });
  }
}
