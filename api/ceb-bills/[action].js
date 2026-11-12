// api/ceb-bills/[action].js
//
// ONE serverless function for the CEB bill endpoints. Vercel Hobby allows 12 functions, and
// each file directly under api/ counts as one; this used to be six of them. The URLs did not
// change: Vercel fills req.query.action from the path.
//
//   POST          /api/ceb-bills/inbound      Resend email.received webhook (LR-005); Svix-signed, no Clerk
//
//   POST          /api/ceb-bills/upload       store a bill PDF (SHA-256 dedupe)
//   POST          /api/ceb-bills/extract      read the PDF, parse and validate the bill
//   GET           /api/ceb-bills/ingestions   the pipeline, or ?view=queue for the review queue
//   POST          /api/ceb-bills/signed-url   short-lived link to one bill PDF
//   GET|POST|PATCH|PUT /api/ceb-bills/records  ceb_data reads and writes, approval
//   POST|DELETE   /api/ceb-bills/delete       delete a bill everywhere
//
// Each handler lives unchanged in api/_lib/cebBills/ and keeps its own auth, method checks and
// [REQUEST] log line. A handler is imported only when its action is called, so a queue read
// does not load the PDF parser.

const HANDLERS = Object.freeze({
  upload: () => import('../_lib/cebBills/upload.js'),
  extract: () => import('../_lib/cebBills/extract.js'),
  ingestions: () => import('../_lib/cebBills/ingestions.js'),
  'signed-url': () => import('../_lib/cebBills/signed-url.js'),
  records: () => import('../_lib/cebBills/records.js'),
  delete: () => import('../_lib/cebBills/delete.js'),
  inbound: () => import('../_lib/cebBills/inbound.js')
});

export const CEB_BILL_ACTIONS = Object.freeze(Object.keys(HANDLERS));

export default async function cebBills(req, res) {
  const action = req.query?.action;
  if (typeof action !== 'string' || !Object.hasOwn(HANDLERS, action)) {
    return res.status(404).json({ error: 'Unknown bill endpoint' });
  }
  const { default: handler } = await HANDLERS[action]();
  return handler(req, res);
}
