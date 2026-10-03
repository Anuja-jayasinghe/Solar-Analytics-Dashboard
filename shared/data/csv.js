// api/_lib/data/csv.js
//
// CSV export. Two non-obvious requirements:
//   * RFC 4180 quoting, so commas, quotes and newlines in a value cannot shift columns.
//   * Spreadsheet-formula injection: a cell beginning with = + - @ (or tab/CR) is executed by
//     Excel/Sheets on open. Alarm messages come from an external system, so they are treated as
//     untrusted and neutralised with a leading apostrophe.
// null / undefined export as an EMPTY cell (unknown), never as 0.

const DANGEROUS_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value);
  // A negative number is data, not a formula: only neutralise when the original is a string.
  if (typeof value === 'string' && DANGEROUS_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns, rows) {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}
