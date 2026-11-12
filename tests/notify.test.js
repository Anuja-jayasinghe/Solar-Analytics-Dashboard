// tests/notify.test.js
//
// api/_lib/notify.js: the "needs you" email (LR-005 rule 7). Pins what each email says, that a figure the
// parser did not find shows as a dash (never 0), that HTML is escaped, and that the send goes to the one
// configured address with the idempotency key.

import { describe, it, expect, vi } from 'vitest';
import { composeIntakeEmail, createNotifier, billFigures, INTAKE_EMAIL_KINDS } from '../api/_lib/notify.js';

const REVIEW = 'https://example.test/admin';
const bill = {
  billing_month: 'NOVEMBER-2036',
  billing_period_start: '2036-10-04',
  billing_period_end: '2036-11-03',
  units_exported: 4210,
  earnings: 155770,
  meter_reading_previous: 48190,
  meter_reading_current: 52400
};

describe('billFigures', () => {
  it('shows a missing figure as a dash, and a real zero as 0', () => {
    const lines = billFigures({ ...bill, units_exported: null, earnings: 0 });
    expect(lines).toContain('Units exported: — kWh');
    expect(lines).toContain('Earnings: Rs 0');
    expect(lines).toContain('Meter: 48,190 → 52,400');
  });
});

describe('composeIntakeEmail', () => {
  it('writes every kind with the review link', () => {
    for (const kind of INTAKE_EMAIL_KINDS) {
      const m = composeIntakeEmail({ kind, bill, reviewUrl: REVIEW });
      expect(m.subject.startsWith('[Solar bills] ')).toBe(true);
      expect(m.text).toContain(`Review queue: ${REVIEW}`);
      expect(m.html).toContain(`href="${REVIEW}"`);
    }
    expect(() => composeIntakeEmail({ kind: 'nope', reviewUrl: REVIEW })).toThrow(RangeError);
  });

  it('lists only the failed checks for a review', () => {
    const checks = [
      { id: 'extraction', ok: true, message: 'fine' },
      { id: 'continuity', ok: false, message: 'Meter continuity: bill says previous 48,210, last bill ended at 48,190' },
      { id: 'units', ok: false, unknown: true, message: 'Units check unknown: inverter data incomplete (2 of 30 days missing)' }
    ];
    const m = composeIntakeEmail({ kind: 'review', bill, checks, reviewUrl: REVIEW });
    expect(m.subject).toBe('[Solar bills] Bill needs review (NOVEMBER-2036)');
    expect(m.text).toContain('2 checks did not pass');
    expect(m.text).toContain('- Meter continuity: bill says previous 48,210, last bill ended at 48,190');
    expect(m.text).toContain('- Units check unknown: inverter data incomplete (2 of 30 days missing)');
    expect(m.text).not.toContain('fine');
    expect(m.text).toContain('Units exported: 4,210 kWh');
  });

  it('says what auto mode would have done in shadow mode', () => {
    const yes = composeIntakeEmail({ kind: 'shadow', bill, wouldRecord: true, reviewUrl: REVIEW });
    expect(yes.subject).toContain('auto mode would have recorded it');
    const no = composeIntakeEmail({ kind: 'shadow', bill, wouldRecord: false, checks: [{ id: 'order', ok: false, message: 'A bill for NOVEMBER-2036 is already recorded' }], reviewUrl: REVIEW });
    expect(no.subject).toContain('auto mode would need review');
    expect(no.text).toContain('- A bill for NOVEMBER-2036 is already recorded');
  });

  it('carries the tariff note when a recorded bill left one', () => {
    const m = composeIntakeEmail({ kind: 'recorded_with_notes', bill, notes: ['Tariff changed: bill states Rs.37/kWh'], reviewUrl: REVIEW });
    expect(m.subject).toBe('[Solar bills] Bill recorded (NOVEMBER-2036), but check Settings');
    expect(m.text).toContain('- Tariff changed: bill states Rs.37/kWh');
  });

  it('escapes HTML in reasons', () => {
    const m = composeIntakeEmail({ kind: 'intake_failed', detail: '<script>x</script>', reviewUrl: REVIEW });
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.html).not.toContain('<script>');
  });
});

describe('createNotifier', () => {
  it('sends one email to the configured address with the idempotency key', async () => {
    const sendEmail = vi.fn(async () => ({ id: 'sent_1' }));
    const n = createNotifier({ resend: { sendEmail }, from: 'Bills <bills@example.test>', to: 'owner@example.test', reviewUrl: REVIEW });
    expect(await n.notify({ kind: 'no_pdf' }, 'bill-intake/em_1/no_pdf')).toEqual({ id: 'sent_1' });
    const [message, key] = sendEmail.mock.calls[0];
    expect(message.to).toEqual(['owner@example.test']);
    expect(message.from).toBe('Bills <bills@example.test>');
    expect(message.subject).toBe('[Solar bills] Bill email had no PDF');
    expect(message).not.toHaveProperty('attachments');
    expect(key).toBe('bill-intake/em_1/no_pdf');
  });
});
