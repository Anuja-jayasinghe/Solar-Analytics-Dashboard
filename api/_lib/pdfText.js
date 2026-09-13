// api/_lib/pdfText.js
//
// Text extraction for CEB bill PDFs, built directly on pdfjs-dist.
//
// ============================================================================
// WHY NOT pdf-parse
// ============================================================================
// `pdf-parse@2.4.5` depends on `@napi-rs/canvas` — a NATIVE binary — purely so it can render
// pages to images. We never render anything; we only ever called `getText()`.
//
// That native dependency has to be traced into the serverless bundle by Vercel, per platform.
// It is the wrong kind of risk for a text-only code path, and a failure to load it happens at
// MODULE level: the import throws before the handler runs, so `try/catch` inside the handler
// never sees it and Vercel returns its own HTML error page. That is why the admin UI showed
// "Parser returned HTTP 500" instead of our JSON error — the response was not our JSON at all.
//
// pdfjs-dist is already a production dependency (react-pdf uses it for the preview), is pure
// JavaScript, and produces text the CEB parser reads identically. Verified against a real
// bill: raw strings differ cosmetically in whitespace handling, but parseCebBillText() returns
// an identical object for both engines.
//
// The `legacy` build is deliberate — it targets plain Node without requiring DOM globals.
// ============================================================================

/**
 * Extract the text of a PDF, one line per visual line, cells separated by tabs.
 *
 * The tab separation is load-bearing: the CEB meter-reading regex matches
 * `\t(\d+)\t(\d{4}-\d{2}-\d{2})`, i.e. it depends on table cells arriving tab-delimited.
 * pdfjs marks the end of a visual line with `hasEOL`, so items are accumulated until then
 * and joined with a tab — which is the same shape pdf-parse produced.
 *
 * @param {Buffer|Uint8Array} data  Raw PDF bytes
 * @returns {Promise<string>}
 */
export async function extractPdfText(data) {
  // Imported lazily and by path so a resolution problem surfaces as a catchable error inside
  // the caller rather than as a module-load crash that bypasses all error handling.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // pdfjs rejects a Node Buffer explicitly ("Please provide binary data as `Uint8Array`"),
  // and `instanceof Uint8Array` is true for Buffer — it is a subclass — so that check alone
  // lets a Buffer straight through. Re-view the same memory as a plain Uint8Array instead:
  // no copy, and the constructor is the one pdfjs insists on.
  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);

  const doc = await pdfjs.getDocument({
    data: bytes,
    // Nothing here renders or evaluates scripts; both off for safety and speed.
    isEvalSupported: false,
    useSystemFonts: false
  }).promise;

  try {
    let out = '';

    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();

      let line = [];
      for (const item of content.items) {
        // Whitespace-only fragments are layout padding, not content. Keeping them would put
        // empty cells into the tab-delimited rows the parser reads.
        if (item.str && item.str.trim() !== '') line.push(item.str);
        if (item.hasEOL) {
          out += line.join('\t') + '\n';
          line = [];
        }
      }
      if (line.length > 0) out += line.join('\t') + '\n';

      page.cleanup();
    }

    return out;
  } finally {
    // Release the worker; a leaked one keeps the serverless invocation alive.
    await doc.destroy();
  }
}
