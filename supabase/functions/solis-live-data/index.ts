// supabase/functions/solis-live-data/index.ts
//
// Live inverter telemetry for the dashboard's current-power widget.
//
// ============================================================================
// WHY THIS FILE IS NOW IN THE REPOSITORY
// ============================================================================
// It wasn't. For its first 29 versions this function existed only inside the
// Supabase dashboard — production code with no history, no review and no way to
// diff it. `supabase functions deploy solis-live-data` publishes from here now.
//
// ============================================================================
// WHY THE RETRY LOOP EXISTS
// ============================================================================
// This function was recorded as "returning 500". It isn't broken: 48 of 55 POSTs
// succeeded. Every single failure was an upstream SolisCloud nginx error —
// 502 Bad Gateway or 504 Gateway Time-out — surfacing as a 500 here because a
// single failed fetch threw straight to the catch block.
//
// SolisCloud is flaky perhaps 13% of the time. One retry makes that ~1.7%, two
// makes it ~0.2%. Nothing else about the request needs to change; it just needs
// asking again.
//
// Retries are attempted ONLY for transport failures and 5xx. A 4xx means the
// signature or the account is wrong, and a `success: false` body means Solis
// understood us and said no — repeating either just wastes the quota.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";

// --- START: Self-contained MD5 Implementation -------------------------------
// SolisCloud signs a Content-MD5 header. Deno's WebCrypto deliberately omits
// MD5 (it is broken for security, but here it is a checksum the vendor
// requires), so it is implemented inline. Left byte-for-byte as deployed —
// a signing change is not what this edit is for.
function md5(s) {
  function C(q, a, b, x, s, t) {
    a = a + q + (x | 0) + (t | 0) | 0;
    return (a << s | a >>> 32 - s) + b | 0;
  }
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const x = [];
  const utf8 = unescape(encodeURIComponent(s));
  for(let i = 0; i < utf8.length; i++)x[i >> 2] |= utf8.charCodeAt(i) << i % 4 * 8;
  x[utf8.length >> 2] |= 0x80 << utf8.length % 4 * 8;
  const xl = utf8.length * 8;
  x[(xl >> 9 << 4) + 14] = xl;
  for(let i = 0; i < x.length; i += 16){
    const [oa, ob, oc, od] = [
      a,
      b,
      c,
      d
    ];
    a = C(b & c | ~b & d, a, b, x[i + 0], 7, 0xd76aa478);
    d = C(a & b | ~a & c, d, a, x[i + 1], 12, 0xe8c7b756);
    c = C(d & a | ~d & b, c, d, x[i + 2], 17, 0x242070db);
    b = C(c & d | ~c & a, b, c, x[i + 3], 22, 0xc1bdceee);
    a = C(b & c | ~b & d, a, b, x[i + 4], 7, 0xf57c0faf);
    d = C(a & b | ~a & c, d, a, x[i + 5], 12, 0x4787c62a);
    c = C(d & a | ~d & b, c, d, x[i + 6], 17, 0xa8304613);
    b = C(c & d | ~c & a, b, c, x[i + 7], 22, 0xfd469501);
    a = C(b & c | ~b & d, a, b, x[i + 8], 7, 0x698098d8);
    d = C(a & b | ~a & c, d, a, x[i + 9], 12, 0x8b44f7af);
    c = C(d & a | ~d & b, c, d, x[i + 10], 17, 0xffff5bb1);
    b = C(c & d | ~c & a, b, c, x[i + 11], 22, 0x895cd7be);
    a = C(b & c | ~b & d, a, b, x[i + 12], 7, 0x6b901122);
    d = C(a & b | ~a & c, d, a, x[i + 13], 12, 0xfd987193);
    c = C(d & a | ~d & b, c, d, x[i + 14], 17, 0xa679438e);
    b = C(c & d | ~c & a, b, c, x[i + 15], 22, 0x49b40821);
    a = C(b & d | c & ~d, a, b, x[i + 1], 5, 0xf61e2562);
    d = C(a & c | b & ~c, d, a, x[i + 6], 9, 0xc040b340);
    c = C(d & b | a & ~b, c, d, x[i + 11], 14, 0x265e5a51);
    b = C(c & a | d & ~a, b, c, x[i + 0], 20, 0xe9b6c7aa);
    a = C(b & d | c & ~d, a, b, x[i + 5], 5, 0xd62f105d);
    d = C(a & c | b & ~c, d, a, x[i + 10], 9, 0x02441453);
    c = C(d & b | a & ~b, c, d, x[i + 15], 14, 0xd8a1e681);
    b = C(c & a | d & ~a, b, c, x[i + 4], 20, 0xe7d3fbc8);
    a = C(b & d | c & ~d, a, b, x[i + 9], 5, 0x21e1cde6);
    d = C(a & c | b & ~c, d, a, x[i + 14], 9, 0xc33707d6);
    c = C(d & b | a & ~b, c, d, x[i + 3], 14, 0xf4d50d87);
    b = C(c & a | d & ~a, b, c, x[i + 8], 20, 0x455a14ed);
    a = C(b & d | c & ~d, a, b, x[i + 13], 5, 0xa9e3e905);
    d = C(a & c | b & ~c, d, a, x[i + 2], 9, 0xfcefa3f8);
    c = C(d & b | a & ~b, c, d, x[i + 7], 14, 0x676f02d9);
    b = C(c & a | d & ~a, b, c, x[i + 12], 20, 0x8d2a4c8a);
    a = C(b ^ c ^ d, a, b, x[i + 5], 4, 0xfffa3942);
    d = C(a ^ b ^ c, d, a, x[i + 8], 11, 0x8771f681);
    c = C(d ^ a ^ b, c, d, x[i + 11], 16, 0x6d9d6122);
    b = C(c ^ d ^ a, b, c, x[i + 14], 23, 0xfde5380c);
    a = C(b ^ c ^ d, a, b, x[i + 1], 4, 0xa4beea44);
    d = C(a ^ b ^ c, d, a, x[i + 4], 11, 0x4bdecfa9);
    c = C(d ^ a ^ b, c, d, x[i + 7], 16, 0xf6bb4b60);
    b = C(c ^ d ^ a, b, c, x[i + 10], 23, 0xbebfbc70);
    a = C(b ^ c ^ d, a, b, x[i + 13], 4, 0x289b7ec6);
    d = C(a ^ b ^ c, d, a, x[i + 0], 11, 0xeaa127fa);
    c = C(d ^ a ^ b, c, d, x[i + 3], 16, 0xd4ef3085);
    b = C(c ^ d ^ a, b, c, x[i + 6], 23, 0x04881d05);
    a = C(b ^ c ^ d, a, b, x[i + 9], 4, 0xd9d4d039);
    d = C(a ^ b ^ c, d, a, x[i + 12], 11, 0xe6db99e5);
    c = C(d ^ a ^ b, c, d, x[i + 15], 16, 0x1fa27cf8);
    b = C(c ^ d ^ a, b, c, x[i + 2], 23, 0xc4ac5665);
    a = C(c ^ (b | ~d), a, b, x[i + 0], 6, 0xf4292244);
    d = C(b ^ (a | ~c), d, a, x[i + 7], 10, 0x432aff97);
    c = C(a ^ (d | ~b), c, d, x[i + 14], 15, 0xab9423a7);
    b = C(d ^ (c | ~a), b, c, x[i + 5], 21, 0xfc93a039);
    a = C(c ^ (b | ~d), a, b, x[i + 12], 6, 0x655b59c3);
    d = C(b ^ (a | ~c), d, a, x[i + 3], 10, 0x8f0ccc92);
    c = C(a ^ (d | ~b), c, d, x[i + 10], 15, 0xffeff47d);
    b = C(d ^ (c | ~a), b, c, x[i + 1], 21, 0x85845dd1);
    a = C(c ^ (b | ~d), a, b, x[i + 8], 6, 0x6fa87e4f);
    d = C(b ^ (a | ~c), d, a, x[i + 15], 10, 0xfe2ce6e0);
    c = C(a ^ (d | ~b), c, d, x[i + 6], 15, 0xa3014314);
    b = C(d ^ (c | ~a), b, c, x[i + 13], 21, 0x4e0811a1);
    a = C(c ^ (b | ~d), a, b, x[i + 4], 6, 0xf7537e82);
    d = C(b ^ (a | ~c), d, a, x[i + 11], 10, 0xbd3af235);
    c = C(a ^ (d | ~b), c, d, x[i + 2], 15, 0x2ad7d2bb);
    b = C(d ^ (c | ~a), b, c, x[i + 9], 21, 0xeb86d391);
    a = a + oa | 0;
    b = b + ob | 0;
    c = c + oc | 0;
    d = d + od | 0;
  }
  const result = new ArrayBuffer(16);
  const view = new DataView(result);
  view.setInt32(0, a, true);
  view.setInt32(4, b, true);
  view.setInt32(8, c, true);
  view.setInt32(12, d, true);
  return result;
}
// --- END: Self-contained MD5 Implementation ---------------------------------

const API_URL = "https://www.soliscloud.com:13333";
const INVERTER_DETAIL_PATH = "/v1/api/inverterDetail";

/** Ceiling on any single SolisCloud call. Without one, a hung upstream holds
 *  the invocation until the platform kills it and the caller learns nothing. */
const REQUEST_TIMEOUT_MS = 8000;

/** Total attempts, including the first. 3 turns a 13% upstream failure rate
 *  into roughly 0.2%. */
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 300;

// Mirrors DEFAULT_ALLOWED_ORIGINS in api/_lib/httpSecurity.js. This function
// previously sent `Access-Control-Allow-Origin: *`, which the rest of the
// project moved away from — a wildcard lets any page on the internet call this
// and spend the SolisCloud quota.
const ALLOWED_ORIGINS = [
  "https://solaredge.anujajay.com",
  "http://localhost:5173",
  "http://localhost:4173"
];

const PREVIEW_ORIGIN = /^https:\/\/solar-analytics-dashboard[a-z0-9-]*\.vercel\.app$/;

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    // Caches must not hand one origin's response to another.
    Vary: "Origin"
  };

  if (origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Full jitter: random across the whole window rather than a fixed delay, so
 *  concurrent dashboard tabs don't retry in lockstep and re-hammer a service
 *  that is already struggling. */
function backoffDelay(attempt: number): number {
  return Math.random() * BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
}

async function createSolisSignature(
  apiSecret: string,
  verb: string,
  contentMd5: string,
  contentType: string,
  date: string,
  canonicalizedResource: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const stringToSign = [verb, contentMd5, contentType, date, canonicalizedResource].join("\n");
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(stringToSign)
  );
  return encodeBase64(signatureBuffer);
}

/**
 * One signed call to SolisCloud, with its own timeout.
 *
 * The Date header and therefore the signature are regenerated per attempt:
 * SolisCloud rejects a stale Date, so replaying the first attempt's headers
 * after a backoff would fail authentication rather than retry cleanly.
 */
async function callSolisOnce(apiId: string, apiSecret: string, inverterSn: string) {
  const body = JSON.stringify({ sn: inverterSn });
  const verb = "POST";
  const contentType = "application/json";
  const date = new Date().toUTCString();
  const contentMd5 = encodeBase64(md5(body));
  const signature = await createSolisSignature(
    apiSecret,
    verb,
    contentMd5,
    contentType,
    date,
    INVERTER_DETAIL_PATH
  );

  return await fetch(API_URL + INVERTER_DETAIL_PATH, {
    method: verb,
    headers: {
      "Content-Type": contentType,
      "Content-MD5": contentMd5,
      Date: date,
      Authorization: `API ${apiId}:${signature}`
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = { ...cors, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const apiId = Deno.env.get("SOLIS_API_ID");
  const apiSecret = Deno.env.get("SOLIS_API_SECRET");
  const inverterSn = Deno.env.get("SOLIS_INVERTER_SN");

  // A configuration problem is ours and is not retryable — say so distinctly,
  // so it is never mistaken for the upstream flakiness handled below.
  if (!apiId || !apiSecret || !inverterSn) {
    const missing = [
      !apiId && "SOLIS_API_ID",
      !apiSecret && "SOLIS_API_SECRET",
      !inverterSn && "SOLIS_INVERTER_SN"
    ].filter(Boolean);

    console.error("Missing Supabase function secrets:", missing.join(", "));
    return new Response(
      JSON.stringify({
        error: "Function is not configured",
        details: `Missing Supabase secret(s): ${missing.join(", ")}`
      }),
      { status: 500, headers: json }
    );
  }

  let lastProblem = "unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await callSolisOnce(apiId, apiSecret, inverterSn);

      // 5xx is SolisCloud's nginx having a moment — the one case worth repeating.
      if (response.status >= 500) {
        lastProblem = `SolisCloud returned ${response.status}`;
        console.warn(`${lastProblem} (attempt ${attempt}/${MAX_ATTEMPTS})`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        break;
      }

      // 4xx means the signature or the account is wrong. Retrying cannot help.
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`SolisCloud rejected the request: ${response.status} ${errorText}`);
        return new Response(
          JSON.stringify({
            error: "SolisCloud rejected the request",
            status: response.status
          }),
          { status: 502, headers: json }
        );
      }

      const solisData = await response.json();

      // Solis understood us and declined. Also not retryable.
      if (!solisData.success) {
        console.error(`SolisCloud business error: ${solisData.msg}`);
        return new Response(
          JSON.stringify({ error: "SolisCloud business error", details: solisData.msg }),
          { status: 502, headers: json }
        );
      }

      const inverterData = solisData.data;
      const statusMap: Record<number, string> = { 1: "Online", 2: "Offline", 3: "Alarm" };

      return new Response(
        JSON.stringify({
          currentPower: { value: inverterData.pac, unit: inverterData.pacStr },
          dailyGeneration: { value: inverterData.eToday, unit: inverterData.eTodayStr },
          totalGeneration: { value: inverterData.eTotal, unit: inverterData.eTotalStr },
          status: statusMap[inverterData.state] || "Unknown"
        }),
        {
          headers: {
            ...json,
            // Telemetry refreshes every 5 minutes upstream; a few seconds of
            // shared caching absorbs multiple open dashboard tabs.
            "Cache-Control": "public, max-age=30"
          }
        }
      );
    } catch (error) {
      // Timeout or transport failure — both worth another attempt.
      lastProblem = error instanceof Error ? error.message : String(error);
      console.warn(`SolisCloud call failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${lastProblem}`);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt));
        continue;
      }
    }
  }

  // Every attempt failed upstream. 502 rather than 500: this function worked,
  // the service behind it did not — and the distinction is the whole reason
  // this endpoint looked broken when it was merely downstream of something flaky.
  console.error(`SolisCloud unreachable after ${MAX_ATTEMPTS} attempts: ${lastProblem}`);
  return new Response(
    JSON.stringify({
      error: "SolisCloud is unavailable",
      details: lastProblem,
      attempts: MAX_ATTEMPTS
    }),
    { status: 502, headers: { ...json, "Retry-After": "30" } }
  );
});
