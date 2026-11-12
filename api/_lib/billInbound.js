// api/_lib/billInbound.js
//
// The email bill intake: what happens to one `email.received` webhook (LR-005 rules 1–4 and 6–8).
// Spec: docs/logic-registry/LR-005-email-bill-intake.md   Tests: tests/billInbound.test.js
// The HTTP side (signature, raw body, status codes) is api/_lib/cebBills/inbound.js.
//
//   1. not email.received / mode off                       → ignored
//   2. this email was already taken in (Resend email_id)    → duplicate          (rule 4)
//   3. recipient is not BILL_INTAKE_ADDRESS                 → ignored            (rule 2)
//   4. fetch the email; From domain not in BILL_SENDER_DOMAINS → ignored         (rule 2)
//   5. not exactly one PDF, too large, not a PDF            → email the owner    (rule 3)
//   6. same file already taken in (SHA-256)                 → duplicate          (rule 4)
//   7. read the PDF in memory; account ≠ SOLAR_CEB_ACCOUNT  → discarded, nothing stored (rule 1)
//   8. store PDF + ingestion; gate (rule 5) + DKIM          → save the extraction
//   9. auto and every check passed → approve_ceb_extraction (rule 6); otherwise review / shadow email
//
// A deliberate outcome returns normally (the webhook answers 200). An unexpected failure throws, so the
// webhook answers 500 and Resend retries. Once the PDF is stored, a retry is a duplicate, so a failure
// after that point marks the ingestion failed_extraction (it shows in the queue) and emails the owner.
//
// Logs carry the Resend email id, outcome and check ids only: never addresses, account numbers (beyond
// the last 3 digits) or bill figures (docs/WORKING_RULES.md §3).

import { evaluateBillGate, ratioBoundsFromEnv } from './billGate.js';
import { pdfProblem } from './billIntake.js';
import { sanitizeRecord } from './cebRecordRules.js';
import { addDays, diffDays, isDateKey } from '../../shared/domain/time.js';

export const SOURCE_TYPE = 'email_forward';
export const ACTOR = 'email-intake';
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const INTAKE_MODES = Object.freeze(['shadow', 'auto', 'off']);
export const DEFAULT_ALERT_FROM = 'Solar Analytics <bills@mail.solaredge.anujajay.com>';
export const DEFAULT_REVIEW_URL = 'https://solaredge.anujajay.com/admin';
// A window longer than this cannot pass the period check anyway; it only bounds the inverter query.
const MAX_WINDOW_DAYS = 62;

const normAccount = (v) => (v === null || v === undefined ? '' : String(v).replace(/[\s-]/g, ''));
export const accountTail = (v) => (normAccount(v) ? `…${normAccount(v).slice(-3)}` : null);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** The bare, lower-case address in `Name <a@b>` or `a@b`, or null. */
export function addressOf(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/<([^<>\s]+@[^<>\s]+)>/) || value.match(/([^\s<>",;]+@[^\s<>",;]+)/);
  return m ? m[1].toLowerCase() : null;
}

const domainOf = (address) => (address && address.includes('@') ? address.split('@').pop() : null);

/** Is `domain` one of `allowed`, or a subdomain of one? */
export function senderAllowed(domain, allowed) {
  if (!domain) return false;
  return allowed.some((a) => domain === a || domain.endsWith(`.${a}`));
}

/**
 * The intake's settings from the environment, and what is missing. `problems` lists the names of unset
 * variables (never their values): a webhook that arrives while any is missing fails with 500, so Resend
 * retries it once the configuration is fixed instead of the bill being dropped.
 */
export function inboundConfigFromEnv(env = {}) {
  const rawMode = String(env.BILL_INTAKE_MODE || 'shadow').trim().toLowerCase();
  const mode = INTAKE_MODES.includes(rawMode) ? rawMode : 'shadow';
  const config = {
    mode,
    modeWasInvalid: rawMode !== mode,
    webhookSecret: env.RESEND_WEBHOOK_SECRET || null,
    resendApiKey: env.RESEND_API_KEY || null,
    intakeAddress: (env.BILL_INTAKE_ADDRESS || '').trim().toLowerCase() || null,
    senderDomains: String(env.BILL_SENDER_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
    solarAccount: normAccount(env.SOLAR_CEB_ACCOUNT) || null,
    alertTo: (env.BILL_ALERT_TO || '').trim() || null,
    alertFrom: (env.BILL_ALERT_FROM || '').trim() || DEFAULT_ALERT_FROM,
    reviewUrl: (env.BILL_REVIEW_URL || '').trim() || DEFAULT_REVIEW_URL,
    ratioBounds: ratioBoundsFromEnv(env),
    inverterSn: env.INVERTER_SN || '1811040244070066'
  };
  const required = {
    RESEND_WEBHOOK_SECRET: config.webhookSecret,
    RESEND_API_KEY: config.resendApiKey,
    BILL_INTAKE_ADDRESS: config.intakeAddress,
    BILL_SENDER_DOMAINS: config.senderDomains.length ? 'set' : null,
    SOLAR_CEB_ACCOUNT: config.solarAccount,
    BILL_ALERT_TO: config.alertTo
  };
  config.problems = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  return config;
}

/** The ceb_data record for an auto-recorded bill: the same shape the admin approve sends (billForm.buildRecord). */
export function recordFromBill(bill, { ingestionId, filePath }) {
  return {
    bill_date: bill.billing_period_end, // the bill date anchors LR-001
    billing_period_start: bill.billing_period_start,
    billing_period_end: bill.billing_period_end,
    meter_reading: bill.meter_reading_current,
    units_exported: bill.units_exported,
    earnings: bill.earnings,
    account_number: bill.account_number || null,
    billing_month: bill.billing_month || null,
    ingestion_id: ingestionId,
    data_source: 'email',
    file_path: filePath || null
  };
}

/**
 * The facts rule 5 needs, read from the database. Throws when a read fails; the caller then evaluates
 * the gate with nothing known, which fails every check that needed the fact (unknown is a failure).
 */
export async function loadGateFacts(db, { bill, inverterSn }) {
  const recent = await db.from('ceb_data').select('bill_date, meter_reading, account_number')
    .order('bill_date', { ascending: false }).limit(12);
  if (recent.error) throw new Error(`Latest bill lookup failed: ${recent.error.message}`);
  // One site, one account. A row with no account (an old manual entry) still counts as this account's.
  const mine = (recent.data ?? []).filter((r) => !normAccount(r.account_number) || normAccount(r.account_number) === normAccount(bill.account_number));
  const latestRow = mine[0] ?? null;
  const latestBill = latestRow ? { bill_date: String(latestRow.bill_date).slice(0, 10), meter_reading: num(latestRow.meter_reading) } : null;

  let monthAlreadyRecorded = null;
  if (bill.account_number && bill.billing_month) {
    const same = await db.from('ceb_data').select('id')
      .eq('account_number', bill.account_number).eq('billing_month', bill.billing_month).limit(1);
    if (same.error) throw new Error(`Billing month lookup failed: ${same.error.message}`);
    monthAlreadyRecorded = (same.data ?? []).length > 0;
  }

  const inverterKwhByDate = new Map();
  const billDate = bill.billing_period_end;
  if (latestBill && isDateKey(billDate) && billDate > latestBill.bill_date && diffDays(latestBill.bill_date, billDate) <= MAX_WINDOW_DAYS) {
    const days = await db.from('inverter_data_daily_summary').select('summary_date, total_generation_kwh')
      .eq('inverter_sn', inverterSn).gte('summary_date', addDays(latestBill.bill_date, 1)).lte('summary_date', billDate);
    if (days.error) throw new Error(`Inverter days lookup failed: ${days.error.message}`);
    for (const r of days.data ?? []) {
      const kwh = num(r.total_generation_kwh);
      if (kwh !== null) inverterKwhByDate.set(String(r.summary_date).slice(0, 10), kwh);
    }
  }

  return { latestBill, monthAlreadyRecorded, inverterKwhByDate };
}

const isPdfAttachment = (a) => /pdf/i.test(a?.content_type || '') || /\.pdf$/i.test(a?.filename || '');
const isUniqueViolation = (err) => /duplicate key|unique constraint|23505/i.test(err?.message || '');

/**
 * Take in one webhook event.
 *
 * @param {object} event  the parsed webhook body ({ type, created_at, data })
 * @param {object} deps
 * @param {object} deps.config    inboundConfigFromEnv()
 * @param {object} deps.db        Supabase service-role client (gate facts, status updates, the approve RPC)
 * @param {object} deps.intake    createBillIntake()
 * @param {object} deps.resend    createResendApi()
 * @param {object} deps.notifier  createNotifier()
 * @param {(entry: object) => void} [deps.audit]  audit line for an automatic approval
 * @param {(entry: object) => void} [deps.log]    one [INTAKE] line per email
 * @returns {Promise<{ outcome: string, reason?: string, emailed?: string, ingestionId?: string }>}
 */
export async function processInboundEmail(event, { config, db, intake, resend, notifier, audit = () => {}, log = () => {} }) {
  const emailId = event?.data?.email_id;
  const done = (result) => {
    log({ emailId: emailId ?? null, mode: config.mode, ...result });
    return result;
  };

  if (event?.type !== 'email.received') return done({ outcome: 'ignored', reason: 'not_email_received' });
  if (typeof emailId !== 'string' || !emailId) return done({ outcome: 'ignored', reason: 'no_email_id' });
  if (config.mode === 'off') return done({ outcome: 'off' });
  if (config.problems?.length) throw new Error(`Email intake is not configured: ${config.problems.join(', ')} not set`);

  // Rule 4: a retried webhook, or the same email delivered again.
  if (await intake.findByMessage(SOURCE_TYPE, emailId)) return done({ outcome: 'duplicate', reason: 'email_id' });

  // Rule 2: the recipient. A Gmail auto-forward keeps the original To header, so the intake address is
  // usually only in the envelope recipients (`received_for`); any of the lists counts.
  const d = event.data;
  const recipients = [d.to, d.cc, d.bcc, d.received_for].flat().filter(Boolean).map(addressOf);
  if (!recipients.includes(config.intakeAddress)) return done({ outcome: 'ignored', reason: 'recipient' });

  // Rule 2: the sender. The webhook's `from` may be the envelope sender, which Gmail rewrites when it
  // forwards; the original From header is the one to check.
  const email = await resend.getReceivedEmail(emailId);
  const fromAddress = addressOf(email?.headers?.from) || addressOf(email?.from) || addressOf(d.from);
  const fromDomain = domainOf(fromAddress);
  if (!senderAllowed(fromDomain, config.senderDomains)) return done({ outcome: 'ignored', reason: 'sender' });

  // Rule 2: DKIM for the sender's domain. Not passing does not drop the email (it may be a real bill),
  // but it is never recorded automatically.
  const dkim = email?.authentication?.dkim ?? 'unknown';
  const authentic = {
    id: 'authentic',
    ok: dkim === 'pass',
    unknown: dkim !== 'pass' && dkim !== 'fail',
    message: dkim === 'pass' ? `DKIM passed for ${fromDomain}` : `The email's DKIM signature did not pass for ${fromDomain} (result: ${dkim})`
  };

  const subjectHasAccount = normAccount(email?.subject ?? d.subject).includes(config.solarAccount);
  const key = (kind) => `bill-intake/${emailId}/${kind}`;
  const tell = async (outcome) => {
    await notifier.notify(outcome, key(outcome.kind));
    return outcome.kind;
  };

  // Rule 3: exactly one PDF, at most 5 MB, starting with %PDF-.
  const attachments = await resend.listAttachments(emailId);
  const pdfs = attachments.filter(isPdfAttachment);
  if (pdfs.length === 0) return done({ outcome: 'needs_attention', reason: 'no_pdf', emailed: await tell({ kind: 'no_pdf' }) });
  if (pdfs.length > 1) {
    return done({ outcome: 'needs_attention', reason: 'several_pdfs', emailed: await tell({ kind: 'several_pdfs', detail: `${pdfs.length} PDFs attached` }) });
  }
  const attachment = pdfs[0];
  if (num(attachment.size) !== null && attachment.size > MAX_PDF_BYTES) {
    return done({ outcome: 'needs_attention', reason: 'too_large', emailed: await tell({ kind: 'bad_pdf', detail: `The PDF is ${(attachment.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB` }) });
  }
  let buffer;
  try {
    buffer = await resend.download(attachment.download_url, MAX_PDF_BYTES);
  } catch (err) {
    if (err?.status !== 413) throw err; // a download failure is retried; only "too large" is final
    return done({ outcome: 'needs_attention', reason: 'too_large', emailed: await tell({ kind: 'bad_pdf', detail: 'The PDF is larger than 5 MB' }) });
  }
  if (pdfProblem(buffer)) {
    return done({ outcome: 'needs_attention', reason: 'not_pdf', emailed: await tell({ kind: 'bad_pdf', detail: 'The attachment is not a PDF' }) });
  }

  // Rule 4: the same file, uploaded by hand or forwarded twice.
  const fileSha256 = intake.sha256(buffer);
  if (await intake.findDuplicate(fileSha256)) return done({ outcome: 'duplicate', reason: 'file' });

  // Read in memory. Nothing is written until the account is known to be the solar one (rule 1).
  let bill = null;
  let validation = null;
  let readError = null;
  try {
    const tariff = await intake.loadTariff();
    ({ extracted: bill, validation } = await intake.read(buffer, tariff));
  } catch (err) {
    readError = err;
  }

  // Rule 1: only the solar bill is kept. When the PDF names no account (unreadable, or a new layout),
  // the subject must carry the solar account, as the Gmail filter requires.
  const billAccount = normAccount(bill?.account_number);
  const isSolar = billAccount ? billAccount === config.solarAccount : subjectHasAccount;
  if (!isSolar) {
    return done({ outcome: 'discarded', reason: billAccount ? 'other_account' : 'no_account', account: accountTail(billAccount) });
  }

  const stored = await (async () => {
    try {
      return await intake.store({
        buffer,
        filename: `email-bill-${bill?.billing_month || 'unread'}.pdf`,
        ownerId: ACTOR,
        createdBy: ACTOR,
        sourceType: SOURCE_TYPE,
        sourceMessageId: emailId,
        fileSha256
      });
    } catch (err) {
      // Two deliveries of one email racing: the unique (source_type, source_message_id) index lets one win.
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  })();
  if (!stored) return done({ outcome: 'duplicate', reason: 'email_id_race' });
  const { ingestionId, filePath } = stored;

  const markFailed = async () => {
    const { error } = await db.from('ceb_bill_ingestions').update({ status: 'failed_extraction' }).eq('id', ingestionId).eq('status', 'received');
    if (error) console.error('[INTAKE] could not mark ingestion failed_extraction:', error.message);
  };

  if (readError) {
    await markFailed();
    return done({ outcome: 'needs_attention', reason: 'unreadable', ingestionId, emailed: await tell({ kind: 'unreadable', detail: String(readError.message || readError).slice(0, 200) }) });
  }

  let notifying = false;
  try {
    // Rule 5. Facts that cannot be read leave their checks unknown, which fails them.
    let facts = { latestBill: null, monthAlreadyRecorded: null, inverterKwhByDate: new Map() };
    let factsError = null;
    try {
      facts = await loadGateFacts(db, { bill, inverterSn: config.inverterSn });
    } catch (err) {
      factsError = err;
    }
    const gate = evaluateBillGate({ bill, validation, solarAccount: config.solarAccount, ratioBounds: config.ratioBounds, ...facts });
    const checks = [...gate.checks, authentic];
    if (factsError) checks.push({ id: 'facts', ok: false, unknown: true, message: `Could not read the records to compare with: ${factsError.message}` });

    const { record, errors: recordErrors } = sanitizeRecord(recordFromBill(bill, { ingestionId, filePath }));
    if (recordErrors.length) checks.push({ id: 'record', ok: false, unknown: false, message: `The figures do not make a valid record: ${recordErrors.join('; ')}` });

    const failed = checks.filter((c) => !c.ok);
    const wouldRecord = failed.length === 0;

    // The queue shows why a bill is waiting: the failed checks join the extractor's own messages. A bill
    // that is not going to be recorded is pending_review, never an `auto_approved` label left hanging.
    const reasons = failed.filter((c) => c.id !== 'extraction').map((c) => c.message);
    const saved = {
      ...validation,
      status: wouldRecord ? validation.status : 'pending_review',
      validation_errors: [...(validation.validation_errors ?? []), ...reasons]
    };
    const extraction = await intake.saveExtraction(ingestionId, bill, saved);

    const summary = { ingestionId, failed: failed.map((c) => c.id), account: accountTail(billAccount) };
    notifying = true;

    if (config.mode !== 'auto') {
      return done({ outcome: 'shadow', wouldRecord, ...summary, emailed: await tell({ kind: 'shadow', bill, checks, notes: gate.notes, wouldRecord }) });
    }
    if (!wouldRecord) {
      return done({ outcome: 'review', ...summary, emailed: await tell({ kind: 'review', bill, checks }) });
    }

    // Rule 6: exactly the admin approve, in one transaction.
    const { error: rpcError } = await db.rpc('approve_ceb_extraction', {
      p_extraction_id: extraction.id,
      p_ingestion_id: ingestionId,
      p_record: record
    });
    if (rpcError) {
      return done({ outcome: 'review', reason: 'record_failed', ...summary, emailed: await tell({ kind: 'record_failed', bill, detail: rpcError.message }) });
    }
    audit({ action: 'bill.approve', actor: { id: ACTOR }, target: { extractionId: extraction.id, ingestionId } });
    if (gate.notes.length) {
      return done({ outcome: 'recorded', ...summary, emailed: await tell({ kind: 'recorded_with_notes', bill, notes: gate.notes }) });
    }
    return done({ outcome: 'recorded', ...summary });
  } catch (err) {
    // After the PDF is stored a retry would be a duplicate, so this is the only chance to say so.
    await markFailed();
    if (!notifying) {
      try {
        await tell({ kind: 'intake_failed', bill, detail: String(err?.message || err).slice(0, 200) });
      } catch (notifyErr) {
        console.error('[INTAKE] could not send the intake_failed email:', notifyErr?.message);
      }
    }
    throw err;
  }
}
