// api/_lib/cebBills/inbound.js — served at /api/ceb-bills/inbound by api/ceb-bills/[action].js
//
// The Resend `email.received` webhook for the email bill intake (LR-005). The only bill action that does
// not use Clerk: its credential is the webhook's Svix signature, checked against RESEND_WEBHOOK_SECRET
// over the RAW body. What happens to the email is api/_lib/billInbound.js.
//
//   401  the signature does not verify (wrong secret, forged, or older than 5 minutes). Resend shows the
//        failure and retries, so a mistyped secret is visible instead of silently dropping every bill.
//   400  the body is not JSON
//   200  every deliberate outcome: recorded, held for review, ignored, discarded, duplicate, off
//   500  configuration missing, or an unexpected failure: Resend retries for about a day
//
// The response says only the outcome; the details are in the [INTAKE] log line.

import { handlePreflightAndMethod } from '../httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../supabaseServer.js';
import { audit, withRequestLog } from '../log.js';
import { createBillIntake } from '../billIntake.js';
import { extractPdfText } from '../pdfText.js';
import { verifyWebhookSignature } from '../webhookSignature.js';
import { createResendApi } from '../resendApi.js';
import { createNotifier } from '../notify.js';
import { inboundConfigFromEnv, processInboundEmail } from '../billInbound.js';

// A webhook is metadata only (a few KB). Anything near this is not Resend.
export const MAX_WEBHOOK_BYTES = 256 * 1024;

/** The request body as received. Vercel parses `req.body` lazily, so the stream is still unread here. */
export function readRawBody(req, maxBytes = MAX_WEBHOOK_BYTES) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return Promise.resolve(Buffer.from(req.rawBody));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Webhook body too large'), { status: 413 }));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * @param {object} [overrides]  tests replace the environment, database and services
 */
export function createInboundHandler(overrides = {}) {
  return async function inbound(req, res) {
    if (handlePreflightAndMethod(req, res, ['POST'])) return;

    const env = overrides.env ?? process.env;
    const config = inboundConfigFromEnv(env);

    let body;
    try {
      body = await readRawBody(req);
    } catch (err) {
      return res.status(err?.status === 413 ? 413 : 400).json({ error: 'Could not read the webhook body' });
    }

    if (!config.webhookSecret) {
      console.error('[INTAKE] RESEND_WEBHOOK_SECRET is not set: refusing the webhook so Resend retries');
      return res.status(500).json({ error: 'Email intake is not configured' });
    }
    const signature = verifyWebhookSignature({ secret: config.webhookSecret, headers: req.headers, body, nowMs: overrides.nowMs });
    if (!signature.ok) {
      console.warn('[INTAKE]', JSON.stringify({ type: 'intake', outcome: 'rejected', reason: `signature_${signature.reason}` }));
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    let event;
    try {
      event = JSON.parse(body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Webhook body is not JSON' });
    }

    if (config.mode !== 'off' && config.problems.length) {
      console.error('[INTAKE] not configured, missing:', config.problems.join(', '));
      return res.status(500).json({ error: 'Email intake is not configured' });
    }
    if (config.modeWasInvalid) console.warn('[INTAKE] BILL_INTAKE_MODE is not shadow, auto or off: using shadow');
    if (!overrides.db && config.mode !== 'off' && blockOnConfigProblem(res)) return;

    const db = overrides.db ?? supabase;
    const resend = overrides.resend ?? createResendApi({ apiKey: config.resendApiKey });
    const deps = {
      config,
      db,
      resend,
      intake: overrides.intake ?? createBillIntake({ db, extractText: extractPdfText }),
      notifier: overrides.notifier ?? createNotifier({ resend, from: config.alertFrom, to: config.alertTo, reviewUrl: config.reviewUrl }),
      audit: (entry) => audit(req, entry),
      log: (entry) => console.log('[INTAKE]', JSON.stringify({ type: 'intake', at: new Date().toISOString(), ...entry }))
    };

    try {
      const result = await processInboundEmail(event, deps);
      return res.status(200).json({ outcome: result.outcome });
    } catch (err) {
      console.error('[INTAKE] failed:', err?.message);
      return res.status(500).json({ error: 'Email intake failed' });
    }
  };
}

export default withRequestLog('ceb-bills/inbound', createInboundHandler());
