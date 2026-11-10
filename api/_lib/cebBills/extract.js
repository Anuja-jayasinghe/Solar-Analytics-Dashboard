// api/_lib/cebBills/extract.js — served at /api/ceb-bills/extract by api/ceb-bills/[action].js

import { verifyAdminToken } from '../verifyAdminToken.js';
import { extractPdfText } from '../pdfText.js';
import { handlePreflightAndMethod } from '../httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../supabaseServer.js';
import { withRequestLog } from '../log.js';
import { createBillIntake } from '../billIntake.js';

// pdfjs-dist directly — see api/_lib/pdfText.js for why not pdf-parse.
const intake = createBillIntake({ db: supabase, extractText: extractPdfText });

// Ingestion states from which a failure is recorded as `failed_extraction`. An ingestion that
// already has an extraction keeps its status when a re-parse fails: the earlier result is still
// on file, and flipping the label would make the review queue list the bill twice.
const NEVER_EXTRACTED = 'received';

async function handler(req, res) {
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

    // 2. Fetch the PDF from Storage
    const buffer = await intake.download(ingestion.file_path);
    if (!buffer) {
       return res.status(500).json({ error: 'Failed to download file from storage.' });
    }

    // 3. Read it: text → fields → validation against the bill's own rate, or the Settings tariff
    //    for bills that do not state one. Parsing is covered by tests/cebBillParser.test.js.
    const tariff = await intake.loadTariff();
    const { extracted, validation: validationResult } = await intake.read(buffer, tariff);

    // 4. Save it as this ingestion's extraction and update the ingestion's status.
    const extractionInsert = await intake.saveExtraction(ingestionId, extracted, validationResult);

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

export default withRequestLog('ceb-bills/extract', handler);
