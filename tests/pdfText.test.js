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
// pdfjs itself is not exercised here (that needs a real PDF, and real bills carry PII and
// are gitignored). Instead the item→line reduction is extracted and tested directly against
// the shape pdfjs returns.

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
