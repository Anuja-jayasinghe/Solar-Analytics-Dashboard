// tests/pdfText.test.js
//
// The line-assembly rules in api/_lib/pdfText.js.
//
// This logic is small but load-bearing: the CEB meter-reading regex matches
// `\t(\d+)\t(\d{4}-\d{2}-\d{2})`, so it depends entirely on table cells arriving
// tab-delimited and lines breaking where pdfjs says they do. Getting the joining wrong
// silently produces text the parser cannot read — the exact failure mode that made a bill
// format change look like a parser bug.
//
// Real bills carry PII and are gitignored, so the item→line reduction is extracted and tested
// directly against the shape pdfjs returns. pdfjs itself is exercised end to end on a small
// PDF built in the test with made-up content (see "reads a real PDF"), so a pdfjs upgrade that
// breaks opening, reading or closing a document fails here, not in production.

import { describe, it, expect } from 'vitest';

/**
 * Mirror of the reduction inside extractPdfText.
 *
 * Kept in the test rather than exported from the module because it is the *rule* being
 * pinned, not an API: whitespace-only fragments are layout padding and must be dropped,
 * everything else on a visual line is joined with a tab, and `hasEOL` ends the line.
 */
function itemsToText(items) {
  let out = '';
  let line = [];
  for (const item of items) {
    if (item.str && item.str.trim() !== '') line.push(item.str);
    if (item.hasEOL) {
      out += line.join('\t') + '\n';
      line = [];
    }
  }
  if (line.length > 0) out += line.join('\t') + '\n';
  return out;
}

const item = (str, hasEOL = false) => ({ str, hasEOL });

describe('pdf text assembly', () => {
  it('joins items on the same visual line with a tab', () => {
    expect(itemsToText([item('129'), item('97597'), item('2026-09-03', true)]))
      .toBe('129\t97597\t2026-09-03\n');
  });

  it('produces meter rows the parser regex can actually match', () => {
    // The single most fragile coupling in the whole pipeline.
    const text = itemsToText([
      item('124'), item('93590'), item('2026-08-04', true),
      item('129'), item('97597'), item('2026-09-03', true)
    ]);
    const matches = [...text.matchAll(/\t(\d+)\t(\d{4}-\d{2}-\d{2})/g)];
    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe('93590');
    expect(matches[1][1]).toBe('97597');
  });

  it('drops whitespace-only fragments rather than emitting empty cells', () => {
    // pdfjs emits " " and "" as layout padding. Keeping them would insert blank cells and
    // shift the tab positions the meter regex depends on.
    expect(itemsToText([item('A'), item(' '), item(''), item('B', true)])).toBe('A\tB\n');
  });

  it('starts a new line at each hasEOL', () => {
    expect(itemsToText([item('one', true), item('two', true)])).toBe('one\ntwo\n');
  });

  it('flushes a trailing line with no hasEOL', () => {
    expect(itemsToText([item('a'), item('b')])).toBe('a\tb\n');
  });

  it('emits an empty line when a line contains only padding', () => {
    expect(itemsToText([item(' ', true), item('x', true)])).toBe('\nx\n');
  });

  it('returns an empty string for no items', () => {
    expect(itemsToText([])).toBe('');
  });

  it('preserves labels that contain their own spaces', () => {
    const text = itemsToText([item('No. of Units Exported (kWh) 4007', true)]);
    expect(text.match(/No\. of Units Exported \(kWh\)\s+(\d+)/)[1]).toBe('4007');
  });
});

describe('pdfjs DOM globals', () => {
  // Production failed with a bare "DOMMatrix is not defined" while the same code passed
  // locally. pdfjs expects browser globals that Vercel's Node runtime does not provide, and
  // the bundler does not reliably preserve the `legacy` build that avoids them. We only ever
  // call getTextContent(), so minimal stand-ins are enough.
  it('installs DOMMatrix, Path2D and ImageData when the runtime lacks them', async () => {
    const saved = {
      DOMMatrix: globalThis.DOMMatrix,
      Path2D: globalThis.Path2D,
      ImageData: globalThis.ImageData
    };
    delete globalThis.DOMMatrix;
    delete globalThis.Path2D;
    delete globalThis.ImageData;

    try {
      const mod = await import('../api/_lib/pdfText.js');
      // extractPdfText installs the globals before importing pdfjs. Calling it with an
      // invalid PDF still exercises that setup, which is the part under test.
      await mod.extractPdfText(new Uint8Array([1, 2, 3])).catch(() => {});

      expect(typeof globalThis.DOMMatrix).toBe('function');
      expect(typeof globalThis.Path2D).toBe('function');
      expect(typeof globalThis.ImageData).toBe('function');

      // The stand-in must behave like an identity matrix, not throw on property access.
      const m = new globalThis.DOMMatrix();
      expect(m.a).toBe(1);
      expect(m.d).toBe(1);
      expect(m.e).toBe(0);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete globalThis[k];
        else globalThis[k] = v;
      }
    }
  });
});

/** A one-page PDF with Helvetica text at the given positions. Made-up content only. */
function makePdf(lines) {
  const content = lines.map(({ x, y, text }) => `BT /F1 10 Tf ${x} ${y} Td (${text}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe('extractPdfText reads a real PDF through pdfjs', () => {
  it('returns one line per visual line, cells tab-separated, and closes the document cleanly', async () => {
    const { extractPdfText } = await import('../api/_lib/pdfText.js');
    const pdf = makePdf([
      { x: 72, y: 720, text: 'DEMO ELECTRICITY BILL' },
      { x: 72, y: 700, text: 'Export' }, { x: 200, y: 700, text: '77798' }, { x: 300, y: 700, text: '2036-09-03' }
    ]);
    // A failure to close the document (pdfjs 6 removed PDFDocumentProxy.destroy) rejects here.
    const text = await extractPdfText(pdf);
    expect(text).toBe('DEMO ELECTRICITY BILL\nExport\t77798\t2036-09-03\n');
    // The meter-reading anchor the CEB parser depends on.
    expect(text).toMatch(/\t(\d+)\t(\d{4}-\d{2}-\d{2})/);
  });

  it('accepts a Node Buffer as well as a Uint8Array', async () => {
    const { extractPdfText } = await import('../api/_lib/pdfText.js');
    const text = await extractPdfText(Buffer.from(makePdf([{ x: 72, y: 720, text: 'BUFFER INPUT' }])));
    expect(text).toBe('BUFFER INPUT\n');
  });
});
