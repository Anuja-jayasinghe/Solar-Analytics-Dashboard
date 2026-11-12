// tests/billInbound.test.js
//
// api/_lib/billInbound.js: what one email.received webhook does (LR-005). Driven through the spec's
// worked examples with a fake database, intake, Resend and notifier. The real parser validation
// (validateExtraction) and the real gate (evaluateBillGate) run, so a change to either shows up here.
//
// All account numbers and addresses below are made up.

import { describe, it, expect, vi } from 'vitest';
import { processInboundEmail, inboundConfigFromEnv, addressOf, senderAllowed, recordFromBill, loadGateFacts } from '../api/_lib/billInbound.js';
import { validateExtraction } from '../api/_lib/cebBillParser.js';
import { eachDateKey } from '../shared/domain/time.js';

const SOLAR = '1234567890';
const INTAKE = 'bills-x7k2@mail.example.test';
const ENV = {
  RESEND_WEBHOOK_SECRET: 'x', // only has to be set: the signature is tested in inboundHandler.test.js
  RESEND_API_KEY: 're_test',
  BILL_INTAKE_ADDRESS: INTAKE,
  BILL_SENDER_DOMAINS: 'edl.lk',
  SOLAR_CEB_ACCOUNT: SOLAR,
  BILL_ALERT_TO: 'owner@example.test',
  BILL_RATIO_MIN: '0.9',
  BILL_RATIO_MAX: '1.05'
};
const PDF = Buffer.from('%PDF-1.7\nfake bill');
const ING = '0b6c2f1e-4d5a-4c3b-9e8f-7a6b5c4d3e2f';

const LATEST = { bill_date: '2036-10-03', meter_reading: '48190', account_number: SOLAR };
const BILL = {
  account_number: SOLAR,
  billing_month: 'NOVEMBER-2036',
  bill_issue_date: '2036-11-04',
  billing_period_start: '2036-10-03',
  billing_period_end: '2036-11-03',
  units_exported: 4210,
  units_consumed: null,
  earnings: 155770,
  export_rate: 37,
  meter_reading_current: 52400,
  meter_reading_previous: 48190
};
const FULL_WINDOW = eachDateKey('2036-10-04', '2036-11-03').map((d) => ({ summary_date: d, total_generation_kwh: '140' }));

const event = (over = {}) => ({
  type: 'email.received',
  created_at: '2036-11-04T03:00:00.000Z',
  data: {
    email_id: 'em_1',
    from: 'forwarder@gmail.example',
    to: ['owner@gmail.example'],
    cc: [],
    bcc: [],
    received_for: [INTAKE],
    subject: `EDL e-Bill for the month of November-2036 - ${SOLAR}`,
    attachments: [{ id: 'att_1', filename: `${SOLAR}.pdf`, content_type: 'application/pdf' }],
    ...over
  }
});

/** A fake Supabase client: `resolve(table, op, calls)` decides each query's result; every query is logged. */
function fakeDb({ latest = [LATEST], sameMonth = [], days = FULL_WINDOW, rpcError = null, failOn = null } = {}) {
  const queries = [];
  const rpc = vi.fn(async () => ({ data: null, error: rpcError }));
  function from(table) {
    const calls = [];
    let op = 'select';
    const chain = {};
    for (const m of ['select', 'update', 'eq', 'order', 'limit', 'gte', 'lte']) {
      chain[m] = (...args) => { if (m === 'update') op = 'update'; calls.push([m, ...args]); return chain; };
    }
    chain.then = (ok, bad) => {
      queries.push({ table, op, calls });
      let result = { data: [], error: null };
      if (failOn === table) result = { data: null, error: { message: `${table} is down` } };
      else if (table === 'ceb_data') result = { data: calls.some(([m, col]) => m === 'eq' && col === 'billing_month') ? sameMonth : latest, error: null };
      else if (table === 'inverter_data_daily_summary') result = { data: days, error: null };
      return Promise.resolve(result).then(ok, bad);
    };
    return chain;
  }
  return { db: { from, rpc }, queries, rpc };
}

function fakeIntake({ bill = BILL, tariff = 37, readError = null, byMessage = null, byFile = null, storeError = null, saveError = null } = {}) {
  return {
    sha256: vi.fn(() => 'sha-1'),
    findByMessage: vi.fn(async () => byMessage),
    findDuplicate: vi.fn(async () => byFile),
    loadTariff: vi.fn(async () => tariff),
    read: vi.fn(async () => {
      if (readError) throw readError;
      return { extracted: bill, validation: validateExtraction(bill, tariff) };
    }),
    store: vi.fn(async () => {
      if (storeError) throw storeError;
      return { ingestionId: ING, filePath: 'ceb/2036/11/email-intake/x.pdf', status: 'received' };
    }),
    saveExtraction: vi.fn(async () => {
      if (saveError) throw saveError;
      return { id: 'ex_1' };
    })
  };
}

function fakeResend({ from = 'EDL e-Bill <eBill@edl.lk>', dkim = 'pass', attachments, pdf = PDF, subject } = {}) {
  return {
    getReceivedEmail: vi.fn(async () => ({
      id: 'em_1',
      from: 'eBill@edl.lk',
      subject: subject ?? `EDL e-Bill for the month of November-2036 - ${SOLAR}`,
      headers: { from },
      authentication: dkim === null ? null : { spf: 'pass', dkim, dmarc: 'pass' }
    })),
    listAttachments: vi.fn(async () => attachments ?? [{ id: 'att_1', filename: `${SOLAR}.pdf`, content_type: 'application/pdf', size: PDF.length, download_url: 'https://cdn.example/att_1' }]),
    download: vi.fn(async () => pdf)
  };
}

function setup({ env = {}, db = {}, intake = {}, resend = {} } = {}) {
  const f = {
    config: inboundConfigFromEnv({ ...ENV, ...env }),
    ...fakeDb(db),
    intake: fakeIntake(intake),
    resend: fakeResend(resend),
    notifier: { notify: vi.fn(async () => ({ id: 'sent' })) },
    audit: vi.fn(),
    log: vi.fn()
  };
  f.run = (ev = event()) => processInboundEmail(ev, f);
  f.emailKinds = () => f.notifier.notify.mock.calls.map(([o]) => o.kind);
  f.savedValidation = () => f.intake.saveExtraction.mock.calls[0]?.[2];
  return f;
}

describe('inboundConfigFromEnv', () => {
  it('defaults to shadow mode and names every missing variable', () => {
    const c = inboundConfigFromEnv({});
    expect(c.mode).toBe('shadow');
    expect(c.problems).toEqual(['RESEND_WEBHOOK_SECRET', 'RESEND_API_KEY', 'BILL_INTAKE_ADDRESS', 'BILL_SENDER_DOMAINS', 'SOLAR_CEB_ACCOUNT', 'BILL_ALERT_TO']);
  });

  it('reads the mode, falls back to shadow on a typo, and normalises the lists', () => {
    expect(inboundConfigFromEnv({ ...ENV, BILL_INTAKE_MODE: ' AUTO ' }).mode).toBe('auto');
    const typo = inboundConfigFromEnv({ ...ENV, BILL_INTAKE_MODE: 'atuo' });
    expect(typo.mode).toBe('shadow');
    expect(typo.modeWasInvalid).toBe(true);
    const c = inboundConfigFromEnv({ ...ENV, BILL_SENDER_DOMAINS: ' EDL.lk, ceb.lk ,', BILL_INTAKE_ADDRESS: 'Bills-X7K2@Mail.Example.Test', SOLAR_CEB_ACCOUNT: '12 3456-7890' });
    expect(c.senderDomains).toEqual(['edl.lk', 'ceb.lk']);
    expect(c.intakeAddress).toBe(INTAKE);
    expect(c.solarAccount).toBe(SOLAR);
    expect(c.problems).toEqual([]);
    expect(c.ratioBounds).toEqual({ min: 0.9, max: 1.05 });
  });
});

describe('address helpers', () => {
  it('takes the bare address out of a display form', () => {
    expect(addressOf('EDL e-Bill <eBill@EDL.lk>')).toBe('ebill@edl.lk');
    expect(addressOf('eBill@edl.lk')).toBe('ebill@edl.lk');
    expect(addressOf('no address')).toBeNull();
    expect(addressOf(undefined)).toBeNull();
  });

  it('allows the sender domain and its subdomains only', () => {
    expect(senderAllowed('edl.lk', ['edl.lk'])).toBe(true);
    expect(senderAllowed('mail.edl.lk', ['edl.lk'])).toBe(true);
    expect(senderAllowed('notedl.lk', ['edl.lk'])).toBe(false);
    expect(senderAllowed('edl.lk.evil.example', ['edl.lk'])).toBe(false);
    expect(senderAllowed(null, ['edl.lk'])).toBe(false);
  });
});

describe('recordFromBill', () => {
  it('builds the same record the admin approve sends, marked as from email', () => {
    expect(recordFromBill(BILL, { ingestionId: ING, filePath: 'p.pdf' })).toEqual({
      bill_date: '2036-11-03',
      billing_period_start: '2036-10-03',
      billing_period_end: '2036-11-03',
      meter_reading: 52400,
      units_exported: 4210,
      earnings: 155770,
      account_number: SOLAR,
      billing_month: 'NOVEMBER-2036',
      ingestion_id: ING,
      data_source: 'email',
      file_path: 'p.pdf'
    });
  });
});

describe('loadGateFacts', () => {
  it('reads the latest bill, the month, and the inverter days of the LR-001 window', async () => {
    const { db, queries } = fakeDb();
    const facts = await loadGateFacts(db, { bill: BILL, inverterSn: 'SN1' });
    expect(facts.latestBill).toEqual({ bill_date: '2036-10-03', meter_reading: 48190 });
    expect(facts.monthAlreadyRecorded).toBe(false);
    expect(facts.inverterKwhByDate.size).toBe(31);
    const inv = queries.find((q) => q.table === 'inverter_data_daily_summary');
    expect(inv.calls).toContainEqual(['gte', 'summary_date', '2036-10-04']);
    expect(inv.calls).toContainEqual(['lte', 'summary_date', '2036-11-03']);
    expect(inv.calls).toContainEqual(['eq', 'inverter_sn', 'SN1']);
  });

  it('skips a newer row for a different account, and keeps a null kWh day missing (not 0)', async () => {
    const other = { bill_date: '2036-10-20', meter_reading: '1', account_number: '999' };
    const days = FULL_WINDOW.map((r, i) => (i === 0 ? { ...r, total_generation_kwh: null } : r));
    const { db } = fakeDb({ latest: [other, LATEST], days });
    const facts = await loadGateFacts(db, { bill: BILL, inverterSn: 'SN1' });
    expect(facts.latestBill.bill_date).toBe('2036-10-03');
    expect(facts.inverterKwhByDate.has('2036-10-04')).toBe(false);
  });

  it('throws when a read fails, never reporting "nothing on record"', async () => {
    const { db } = fakeDb({ failOn: 'ceb_data' });
    await expect(loadGateFacts(db, { bill: BILL, inverterSn: 'SN1' })).rejects.toThrow('ceb_data is down');
  });
});

describe('processInboundEmail: worked examples (LR-005)', () => {
  it('1. a consistent solar bill in auto mode is recorded, with no email', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' } });
    const r = await f.run();
    expect(r.outcome).toBe('recorded');
    expect(f.rpc).toHaveBeenCalledWith('approve_ceb_extraction', expect.objectContaining({ p_extraction_id: 'ex_1', p_ingestion_id: ING }));
    expect(f.rpc.mock.calls[0][1].p_record).toMatchObject({ data_source: 'email', bill_date: '2036-11-03', meter_reading: 52400 });
    expect(f.notifier.notify).not.toHaveBeenCalled();
    expect(f.audit).toHaveBeenCalledWith({ action: 'bill.approve', actor: { id: 'email-intake' }, target: { extractionId: 'ex_1', ingestionId: ING } });
    expect(f.savedValidation().status).toBe('auto_approved');
    expect(f.intake.store).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'email_forward', sourceMessageId: 'em_1', createdBy: 'email-intake' }));
  });

  it('1. the same bill in shadow mode waits in the queue, with a "would have recorded" email', async () => {
    const f = setup();
    const r = await f.run();
    expect(r).toMatchObject({ outcome: 'shadow', wouldRecord: true });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.emailKinds()).toEqual(['shadow']);
    expect(f.notifier.notify.mock.calls[0][0].wouldRecord).toBe(true);
    expect(f.notifier.notify.mock.calls[0][1]).toBe('bill-intake/em_1/shadow');
  });

  it('2. a home-consumption bill is discarded after reading: nothing stored, no email', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, intake: { bill: { ...BILL, account_number: '5550001112' } } });
    const r = await f.run();
    expect(r).toMatchObject({ outcome: 'discarded', reason: 'other_account', account: '…112' });
    expect(f.intake.store).not.toHaveBeenCalled();
    expect(f.intake.saveExtraction).not.toHaveBeenCalled();
    expect(f.notifier.notify).not.toHaveBeenCalled();
    expect(JSON.stringify(f.log.mock.calls)).not.toContain('5550001112');
  });

  it('3. a meter-continuity break goes to review, naming both readings', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, intake: { bill: { ...BILL, meter_reading_previous: 48210, units_exported: 4190, earnings: 155030 } } });
    const r = await f.run();
    expect(r).toMatchObject({ outcome: 'review', failed: ['continuity'] });
    expect(f.rpc).not.toHaveBeenCalled();
    const [outcome] = f.notifier.notify.mock.calls[0];
    expect(outcome.kind).toBe('review');
    expect(outcome.checks.find((c) => c.id === 'continuity').message).toBe('Meter continuity: bill says previous 48,210, last bill ended at 48,190');
    expect(f.savedValidation().status).toBe('pending_review');
    expect(f.savedValidation().validation_errors).toContain('Meter continuity: bill says previous 48,210, last bill ended at 48,190');
  });

  it('4. a webhook delivered twice does nothing the second time', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, intake: { byMessage: { id: ING } } });
    expect(await f.run()).toEqual({ outcome: 'duplicate', reason: 'email_id' });
    expect(f.resend.getReceivedEmail).not.toHaveBeenCalled();
    expect(f.intake.store).not.toHaveBeenCalled();
    expect(f.notifier.notify).not.toHaveBeenCalled();
  });

  it('4. the same PDF already taken in (e.g. uploaded by hand) is a duplicate', async () => {
    const f = setup({ intake: { byFile: { id: 'in_0' } } });
    expect(await f.run()).toEqual({ outcome: 'duplicate', reason: 'file' });
    expect(f.intake.store).not.toHaveBeenCalled();
  });

  it('4. two deliveries racing on the unique index: the loser is a duplicate', async () => {
    const f = setup({ intake: { storeError: new Error('Failed to create ingestion row: duplicate key value violates unique constraint') } });
    expect(await f.run()).toEqual({ outcome: 'duplicate', reason: 'email_id_race' });
    expect(f.notifier.notify).not.toHaveBeenCalled();
  });

  it('5. an email from any other sender is ignored, with no email', async () => {
    const f = setup({ resend: { from: 'Someone <someone@example.com>' } });
    expect(await f.run()).toEqual({ outcome: 'ignored', reason: 'sender' });
    expect(f.resend.listAttachments).not.toHaveBeenCalled();
    expect(f.notifier.notify).not.toHaveBeenCalled();
  });

  it('6. a tariff change is recorded in auto mode, with an "update the tariff" email', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, intake: { tariff: 35 } });
    const r = await f.run();
    expect(r.outcome).toBe('recorded');
    expect(f.rpc).toHaveBeenCalled();
    expect(f.emailKinds()).toEqual(['recorded_with_notes']);
    expect(f.notifier.notify.mock.calls[0][0].notes[0]).toMatch(/^Tariff changed/);
  });

  it('7. a bill for a month already recorded goes to review', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, db: { sameMonth: [{ id: 'row' }] } });
    const r = await f.run();
    expect(r).toMatchObject({ outcome: 'review', failed: ['new_month'] });
    expect(f.notifier.notify.mock.calls[0][0].checks.find((c) => c.id === 'new_month').message).toBe('A bill for NOVEMBER-2036 is already recorded');
  });

  it('8. two missing inverter days make the units check unknown, so review', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, db: { days: FULL_WINDOW.slice(2) } });
    const r = await f.run();
    expect(r).toMatchObject({ outcome: 'review', failed: ['units'] });
    expect(f.notifier.notify.mock.calls[0][0].checks.find((c) => c.id === 'units').message).toBe('Units check unknown: inverter data incomplete (2 of 31 days missing)');
  });
});

describe('processInboundEmail: rules 2 and 3', () => {
  it('ignores mail not addressed to the intake address', async () => {
    const f = setup();
    expect(await f.run(event({ received_for: ['someone@else.example'] }))).toEqual({ outcome: 'ignored', reason: 'recipient' });
    expect(f.resend.getReceivedEmail).not.toHaveBeenCalled();
  });

  it('accepts the intake address in To as well as in the envelope', async () => {
    const f = setup();
    const r = await f.run(event({ to: [`Bills <${INTAKE.toUpperCase()}>`], received_for: [] }));
    expect(r.outcome).toBe('shadow');
  });

  it('never records a bill whose DKIM did not pass, even when every check passes', async () => {
    for (const dkim of ['fail', 'gray', null]) {
      const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, resend: { dkim } });
      const r = await f.run();
      expect(r).toMatchObject({ outcome: 'review', failed: ['authentic'] });
      expect(f.rpc).not.toHaveBeenCalled();
      expect(f.intake.store).toHaveBeenCalled(); // held for review, not dropped
    }
  });

  it('emails the owner when there is no PDF, or more than one, and stores nothing', async () => {
    const none = setup({ resend: { attachments: [{ id: 'a', filename: 'logo.png', content_type: 'image/png' }] } });
    expect(await none.run()).toMatchObject({ outcome: 'needs_attention', reason: 'no_pdf' });
    expect(none.emailKinds()).toEqual(['no_pdf']);
    const two = setup({ resend: { attachments: [{ id: 'a', filename: 'a.pdf', content_type: 'application/pdf' }, { id: 'b', filename: 'b.PDF', content_type: 'application/octet-stream' }] } });
    expect(await two.run()).toMatchObject({ outcome: 'needs_attention', reason: 'several_pdfs' });
    expect(two.emailKinds()).toEqual(['several_pdfs']);
    expect(two.intake.store).not.toHaveBeenCalled();
  });

  it('refuses a PDF over 5 MB without downloading it, and bytes that are not a PDF', async () => {
    const big = setup({ resend: { attachments: [{ id: 'a', filename: 'a.pdf', content_type: 'application/pdf', size: 6 * 1024 * 1024, download_url: 'u' }] } });
    expect(await big.run()).toMatchObject({ outcome: 'needs_attention', reason: 'too_large' });
    expect(big.resend.download).not.toHaveBeenCalled();
    const fake = setup({ resend: { pdf: Buffer.from('<html>not a bill') } });
    expect(await fake.run()).toMatchObject({ outcome: 'needs_attention', reason: 'not_pdf' });
    expect(fake.emailKinds()).toEqual(['bad_pdf']);
  });
});

describe('processInboundEmail: failures', () => {
  it('stores an unreadable PDF whose subject names the solar account, and says so', async () => {
    const f = setup({ intake: { readError: new Error('Invalid PDF structure') } });
    const r = await f.run();
    expect(r).toMatchObject({ outcome: 'needs_attention', reason: 'unreadable', ingestionId: ING });
    expect(f.intake.store).toHaveBeenCalled();
    expect(f.queries.find((q) => q.table === 'ceb_bill_ingestions' && q.op === 'update').calls).toContainEqual(['update', { status: 'failed_extraction' }]);
    expect(f.emailKinds()).toEqual(['unreadable']);
  });

  it('discards an unreadable PDF when the subject does not name the solar account', async () => {
    const f = setup({ intake: { readError: new Error('bad') }, resend: { subject: 'EDL e-Bill for the month of November-2036 - 5550001112' } });
    expect(await f.run()).toMatchObject({ outcome: 'discarded', reason: 'no_account' });
    expect(f.intake.store).not.toHaveBeenCalled();
  });

  it('holds for review when the records to compare with cannot be read', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, db: { failOn: 'ceb_data' } });
    const r = await f.run();
    expect(r.outcome).toBe('review');
    expect(r.failed).toContain('facts');
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it('emails "could not be recorded" when the approve fails', async () => {
    const f = setup({ env: { BILL_INTAKE_MODE: 'auto' }, db: { rpcError: { message: 'deadlock' } } });
    expect(await f.run()).toMatchObject({ outcome: 'review', reason: 'record_failed' });
    expect(f.emailKinds()).toEqual(['record_failed']);
  });

  it('after storing, an unexpected failure marks the ingestion failed, emails, and throws so Resend retries', async () => {
    const f = setup({ intake: { saveError: new Error('Failed to save extraction record: down') } });
    await expect(f.run()).rejects.toThrow('down');
    expect(f.queries.some((q) => q.table === 'ceb_bill_ingestions' && q.op === 'update')).toBe(true);
    expect(f.emailKinds()).toEqual(['intake_failed']);
  });

  it('throws before touching anything when the intake is not configured, but "off" still answers', async () => {
    const f = setup({ env: { SOLAR_CEB_ACCOUNT: '' } });
    await expect(f.run()).rejects.toThrow('SOLAR_CEB_ACCOUNT');
    expect(f.intake.findByMessage).not.toHaveBeenCalled();
    const off = setup({ env: { SOLAR_CEB_ACCOUNT: '', BILL_INTAKE_MODE: 'off' } });
    expect(await off.run()).toEqual({ outcome: 'off' });
  });

  it('ignores other event types', async () => {
    const f = setup();
    expect(await f.run({ type: 'email.sent', data: { email_id: 'x' } })).toEqual({ outcome: 'ignored', reason: 'not_email_received' });
  });
});
