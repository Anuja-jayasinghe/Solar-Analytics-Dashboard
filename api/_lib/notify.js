// api/_lib/notify.js
//
// The "needs you" email of the email bill intake (LR-005 rule 7), sent through Resend.
// Spec: docs/logic-registry/LR-005-email-bill-intake.md   Tests: tests/notify.test.js
//
// One email per intake outcome that needs a person, sent ONLY to BILL_ALERT_TO. It holds figures and
// reasons, never the PDF, and never more than the last 3 digits of an account number. A bill that was
// recorded cleanly, an ignored email, a discarded home bill and a duplicate send nothing; the caller
// decides that (api/_lib/billInbound.js), this module only writes and sends.
//
// composeIntakeEmail() is pure, so every message is pinned by tests without a network.

export const INTAKE_EMAIL_KINDS = Object.freeze([
  'recorded_with_notes', // auto: recorded, but the extractor left a note (e.g. the tariff changed)
  'review',              // auto: a gate check failed, the bill waits in the review queue
  'shadow',              // shadow: in the queue as before; says what auto mode would have done
  'record_failed',       // auto: every check passed but writing the record failed
  'no_pdf',              // a CEB email with no PDF attached
  'several_pdfs',        // more than one PDF attached
  'bad_pdf',             // the attachment is too large or is not a PDF
  'unreadable',          // the PDF could not be read; stored, waiting in the queue
  'intake_failed'        // an unexpected error after the PDF was stored
]);

const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The bill's figures as "label: value" lines. A figure the parser did not find shows as a dash, never 0. */
export function billFigures(bill) {
  if (!bill) return [];
  return [
    `Billing month: ${bill.billing_month ?? '—'}`,
    `Period: ${bill.billing_period_start ?? '—'} to ${bill.billing_period_end ?? '—'}`,
    `Units exported: ${fmt(bill.units_exported)} kWh`,
    `Earnings: Rs ${fmt(bill.earnings)}`,
    `Meter: ${fmt(bill.meter_reading_previous)} → ${fmt(bill.meter_reading_current)}`
  ];
}

const failedChecks = (checks = []) => checks.filter((c) => !c.ok);

/**
 * The email for one outcome.
 *
 * @param {object} o
 * @param {string} o.kind        one of INTAKE_EMAIL_KINDS
 * @param {object} [o.bill]      parser output, for the figures
 * @param {Array}  [o.checks]    gate checks ({ id, ok, unknown, message })
 * @param {string[]} [o.notes]   extractor notes (tariff change)
 * @param {boolean} [o.wouldRecord]  shadow mode: would auto mode have recorded it?
 * @param {string} [o.detail]    a short reason for the failure kinds
 * @param {string} o.reviewUrl   the admin page with the review queue
 * @returns {{ subject: string, text: string, html: string }}
 */
export function composeIntakeEmail({ kind, bill = null, checks = [], notes = [], wouldRecord = false, detail = null, reviewUrl }) {
  const month = bill?.billing_month ? ` (${bill.billing_month})` : '';
  const failed = failedChecks(checks);
  let subject;
  const paragraphs = [];
  let list = [];

  switch (kind) {
    case 'recorded_with_notes':
      subject = `Bill recorded${month}, but check Settings`;
      paragraphs.push('The CEB bill passed every check and was recorded automatically. The bill left a note:');
      list = notes;
      break;
    case 'review':
      subject = `Bill needs review${month}`;
      paragraphs.push(`The CEB bill was not recorded automatically. ${failed.length === 1 ? 'One check' : `${failed.length} checks`} did not pass:`);
      list = failed.map((c) => c.message);
      break;
    case 'shadow':
      subject = wouldRecord ? `Bill in the queue${month}: auto mode would have recorded it` : `Bill in the queue${month}: auto mode would need review`;
      paragraphs.push('Shadow mode: the bill is in the review queue as usual. Approve or fix it there.');
      paragraphs.push(wouldRecord ? 'Auto mode would have recorded it: every check passed.' : 'Auto mode would need review because:');
      list = wouldRecord ? [] : failed.map((c) => c.message);
      if (notes.length) list = [...list, ...notes];
      break;
    case 'record_failed':
      subject = `Bill could not be recorded${month}`;
      paragraphs.push('The CEB bill passed every check, but writing the record failed. It is in the review queue: approve it there.');
      if (detail) list = [detail];
      break;
    case 'no_pdf':
      subject = 'Bill email had no PDF';
      paragraphs.push('An email from CEB reached the intake address without a PDF attached. Nothing was stored. If it was the bill, download it from CEB and upload it on the Admin page.');
      break;
    case 'several_pdfs':
      subject = 'Bill email had more than one PDF';
      paragraphs.push('An email from CEB reached the intake address with more than one PDF, so it was not read. Nothing was stored. Upload the solar bill on the Admin page.');
      if (detail) list = [detail];
      break;
    case 'bad_pdf':
      subject = 'Bill email attachment was not usable';
      paragraphs.push('The attachment on the CEB email could not be used as a bill. Nothing was stored. Upload the bill on the Admin page.');
      if (detail) list = [detail];
      break;
    case 'unreadable':
      subject = 'Bill PDF could not be read';
      paragraphs.push('The bill PDF was stored, but its text could not be read (it may be scanned, password-protected or in a new format). It is in the review queue: enter the figures there.');
      if (detail) list = [detail];
      break;
    case 'intake_failed':
      subject = 'Bill intake failed';
      paragraphs.push('Something failed after the bill PDF was stored. It is in the review queue: re-run extraction or enter the figures there.');
      if (detail) list = [detail];
      break;
    default:
      throw new RangeError(`unknown intake email kind: ${kind}`);
  }

  const figures = billFigures(bill);
  const closing = `Review queue: ${reviewUrl}`;

  const textParts = [...paragraphs];
  if (list.length) textParts.push(list.map((l) => `- ${l}`).join('\n'));
  if (figures.length) textParts.push(['The bill:', ...figures].join('\n'));
  textParts.push(closing);
  const text = textParts.join('\n\n');

  const html = [
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    list.length ? `<ul>${list.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '',
    figures.length ? `<p><strong>The bill</strong><br>${figures.map(escapeHtml).join('<br>')}</p>` : '',
    `<p><a href="${escapeHtml(reviewUrl)}">Open the review queue</a></p>`
  ].join('');

  return { subject: `[Solar bills] ${subject}`, text, html };
}

/**
 * @param {{ resend: { sendEmail: Function }, from: string, to: string, reviewUrl: string }} deps
 * @returns {{ notify: (outcome: object, idempotencyKey: string) => Promise<{ id: string }> }}
 */
export function createNotifier({ resend, from, to, reviewUrl }) {
  return {
    async notify(outcome, idempotencyKey) {
      const { subject, text, html } = composeIntakeEmail({ ...outcome, reviewUrl });
      return resend.sendEmail({ from, to: [to], subject, text, html }, idempotencyKey);
    }
  };
}
