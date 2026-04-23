import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || ''); // Please make sure you have GEMINI_API_KEY set

const PROMPT = `You are an expert data extractor parsing a Sri Lankan CEB Net++ electricity bill.
The user ONLY cares about the solar generation/export data. You must completely ignore any data related to grid consumption or import.

Carefully extract the following fields and return ONLY a JSON object:

* "billing_month": The display month of the bill, typically found next to the Account No (e.g., "2026 MAR" or "2024 SEP").
* "billing_period_start": The start date of the consumption period (YYYY-MM-DD).
* "billing_period_end": The end date of the consumption period (YYYY-MM-DD).
* "bill_issue_date": The date the bill was generated (YYYY-MM-DD).
* "meter_reading": Look for the meter register marked "(E)" for Export. Extract the CURRENT reading for this register ONLY. This number represents the cumulative exported units to date, which will continuously increase over time and can be any number of digits. Do NOT extract the register marked "(1)".
* "units_exported": The total number of solar units exported to the grid.
* "earnings": The total Rs charge for units exported.

Return strictly valid JSON and nothing else.`;

function validateExtraction(aiData, latestDbRecord, currentTariff = 37.00) {
    const errors = [];

    // 1. Sanity Checks
    if (!aiData.meter_reading || aiData.meter_reading <= 0) errors.push("Invalid meter reading");
    if (!aiData.units_exported || aiData.units_exported < 0) errors.push("Invalid exported units");
    if (!aiData.earnings || aiData.earnings < 0) errors.push("Invalid earnings");
    if (!aiData.billing_month) errors.push("Missing billing month (e.g., 2026 MAR)");

    // 2. The Math Check (Tolerance of 1 Rupee for rounding)
    const expectedEarnings = aiData.units_exported * currentTariff;
    const difference = Math.abs(aiData.earnings - expectedEarnings);
    
    if (difference > 1.00) {
        errors.push(`Math mismatch: ${aiData.units_exported} units at Rs.${currentTariff} should be Rs.${expectedEarnings}, but AI extracted Rs.${aiData.earnings}`);
    }

    // 3. The History & Date Alignment Check
    if (latestDbRecord) {
        if (aiData.meter_reading <= latestDbRecord.meter_reading) {
            errors.push(`Meter error: New reading (${aiData.meter_reading}) is lower than previous (${latestDbRecord.meter_reading})`);
        }
        
        const newStartDate = new Date(aiData.billing_period_start);
        const oldEndDate = new Date(latestDbRecord.billing_period_end);
        
        if (newStartDate < oldEndDate) {
            errors.push(`Timeline mismatch: This bill starts on ${aiData.billing_period_start}, but previous bill ended on ${latestDbRecord.billing_period_end}.`);
        }
    }

    return { 
        status: errors.length > 0 ? "pending_review" : "auto_approved", 
        validation_errors: errors,
        clean_data: aiData 
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

    const API_KEY = process.env.GEMINI_API_KEY || '';
    if (!API_KEY || API_KEY.includes('your_google_gemini_api_key_here')) {
       return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Please add a valid key to .env' });
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

    if (ingestion.status === 'pending_review' || ingestion.status === 'approved') {
       return res.status(400).json({ error: 'Ingestion is already processed.' });
    }

    // 2. Fetch file buffer from Storage
    const { data: fileData, error: storageError } = await supabase
       .storage
       .from(BUCKET)
       .download(ingestion.file_path);

    if (storageError || !fileData) {
       return res.status(500).json({ error: 'Failed to download file from storage.' });
    }

    let mimeType = "application/pdf";
    if (ingestion.file_path.toLowerCase().endsWith('.png')) mimeType = "image/png";
    if (ingestion.file_path.toLowerCase().endsWith('.jpg') || ingestion.file_path.toLowerCase().endsWith('.jpeg')) mimeType = "image/jpeg";

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 3. Call Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const filePart = {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };

    let aiResponseText;
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: PROMPT }, filePart] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
        aiResponseText = result.response.text();
    } catch (apiError) {
        console.error('Gemini API Error:', apiError);
        // Catch 429 and rate limits
        if (apiError.status === 429) {
            await supabase.from('ceb_bill_ingestions').update({ status: 'failed_api_limit' }).eq('id', ingestionId);
            return res.status(429).json({ error: 'Gemini API limit hit. Please retry later.' });
        }
        return res.status(500).json({ error: `Gemini API Error: ${apiError.message}` });
    }

    let extractedData;
    try {
        extractedData = JSON.parse(aiResponseText);
        
        // Strip commas and cast to appropriate types to avoid PostgreSQL numeric syntax errors
        const cleanNumber = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'string') return parseFloat(val.toString().replace(/,/g, ''));
            return parseFloat(val);
        };
        
        extractedData.meter_reading = cleanNumber(extractedData.meter_reading);
        extractedData.units_exported = cleanNumber(extractedData.units_exported);
        extractedData.earnings = cleanNumber(extractedData.earnings);

    } catch (parseError) {
        return res.status(500).json({ error: 'Failed to parse JSON from AI model.', raw: aiResponseText });
    }

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
        account_number: extractedData.account_number || null,
        billing_month: extractedData.billing_month,
        billing_period_start: extractedData.billing_period_start || null,
        billing_period_end: extractedData.billing_period_end || null,
        bill_issue_date: extractedData.bill_issue_date || null,
        meter_reading: extractedData.meter_reading,
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
      return res.status(500).json({ error: 'Extraction failed internally.', details: err?.message });
  }
}
