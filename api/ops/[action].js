// api/ops/[action].js
//
// ONE serverless function for operational endpoints (issue #241). Vercel Hobby allows 12 functions;
// this is the 7th. They share a function so the next one costs nothing.
//
//   POST /api/ops/error   a browser error report (public, same-origin, rate-limited; no personal data)
//
// Each handler lives in api/_lib/ops/ with its own method checks, auth and [REQUEST] log line, and is
// imported only when its action is called.

const HANDLERS = Object.freeze({
  error: () => import('../_lib/ops/clientError.js')
});

export const OPS_ACTIONS = Object.freeze(Object.keys(HANDLERS));

export default async function ops(req, res) {
  const action = req.query?.action;
  if (typeof action !== 'string' || !Object.hasOwn(HANDLERS, action)) {
    return res.status(404).json({ error: 'Unknown ops endpoint' });
  }
  const { default: handler } = await HANDLERS[action]();
  return handler(req, res);
}
