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
/**
 * pdfjs expects a handful of browser globals. Most matter only for rendering, but some builds
 * touch them while setting up a document — and on Vercel the bundler does not necessarily
 * preserve the `legacy` build that avoids them, which produced a bare
 * "DOMMatrix is not defined" in production while the same code worked locally.
 *
 * We never rasterise anything: only getTextContent() is used. So minimal stand-ins are enough
 * to keep the module happy, and are installed only when the runtime does not already provide
 * the real thing (Node 24+ and browsers do).
 */
function ensurePdfjsGlobals() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init) {
        // Identity by default; accepts the [a,b,c,d,e,f] form pdfjs passes around.
        const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = Array.isArray(init) ? init : [];
        Object.assign(this, { a, b, c, d, e, f, m11: a, m12: b, m21: c, m22: d, m41: e, m42: f });
      }
      // Text extraction never composes matrices; these exist so property access does not throw.
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      invertSelf() { return this; }
      toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
    };
  }

  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class Path2D {
      addPath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      closePath() {}
      rect() {}
    };
  }

  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      constructor(dataOrWidth, widthOrHeight, maybeHeight) {
        if (typeof dataOrWidth === 'number') {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = maybeHeight ?? 0;
        }
      }
    };
  }
}

export async function extractPdfText(data) {
  ensurePdfjsGlobals();

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
