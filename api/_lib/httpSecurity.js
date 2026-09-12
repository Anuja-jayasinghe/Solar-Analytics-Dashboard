// api/_lib/httpSecurity.js
//
// Shared CORS and request-shape helpers for the serverless API.
//
// Lives under `_lib/` so Vercel does not count it against the 12-function limit on Hobby.
//
// Why this exists: every endpoint previously set its own CORS headers, and all of them sent
// `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`.
// That pairing is invalid per the CORS spec — browsers reject credentialed requests against a
// wildcard origin — so it was simultaneously too permissive (any origin may call and read the
// endpoints that need no credentials) and non-functional for the case it appeared to want.
//
// This replaces it with an explicit allowlist, reflected back only on a match.

const DEFAULT_ALLOWED_ORIGINS = [
  'https://solaredge.anujajay.com',
  'http://localhost:5173',
  'http://localhost:4173'
];

/**
 * Origins permitted to call the API.
 *
 * Configure with ALLOWED_ORIGINS (comma-separated) to add preview deployments or a new
 * domain without a code change. Vercel preview URLs are matched by suffix.
 */
function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;

  // Vercel preview deployments for this project.
  return /^https:\/\/solar-analytics-dashboard[a-z0-9-]*\.vercel\.app$/.test(origin);
}

/**
 * Apply CORS headers for the given request.
 *
 * Only reflects an allowed origin. An unknown origin gets no ACAO header at all, so the
 * browser blocks the response — which is the point.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string[]} methods HTTP methods this endpoint accepts (OPTIONS is added)
 */
export function applyCors(req, res, methods = ['POST']) {
  const origin = req.headers?.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Caches must not serve one origin's response to another.
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Authorization, Content-Type, X-Requested-With'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Handle CORS + preflight + method checking in one call.
 *
 * @returns {boolean} true when the handler should stop (preflight answered, or method
 *                    rejected). false when the request should proceed.
 */
export function handlePreflightAndMethod(req, res, methods = ['POST']) {
  applyCors(req, res, methods);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  if (!methods.includes(req.method)) {
    res.setHeader('Allow', [...methods, 'OPTIONS'].join(','));
    res.status(405).json({ error: `Method not allowed. Use ${methods.join(' or ')}.` });
    return true;
  }

  return false;
}
