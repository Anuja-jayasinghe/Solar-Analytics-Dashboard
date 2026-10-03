# Local development

## The short version

```bash
cp .env.example .env      # then fill it in — every variable is explained there
pnpm install
pnpm dev                  # http://localhost:5173
```

`pnpm test`, `pnpm lint` and `pnpm build` need no environment at all.

## The API in development

`pnpm dev` serves only the React app. The admin screens call `/api/*`, which Vite proxies to
`VITE_API_PROXY_TARGET` (default `http://localhost:3000`). To exercise the API locally, run the
Vercel dev server there:

```bash
npx vercel dev --listen 3000
```

It needs the server-side variables from `.env.example` — above all `SUPABASE_URL`, the
**service-role** `SUPABASE_SERVICE_KEY` and `CLERK_SECRET_KEY`. A wrong Supabase key is reported
with an explanation by `/ready` rather than failing halfway through a request.

You do not need the API to work on the public dashboard: it reads Supabase directly with the
public anon key.

## Signing in locally

Clerk publishable keys starting `pk_live_` are locked to the production domain and Clerk refuses
to initialise on `localhost`. Because `ClerkProvider` wraps the whole app, the page then renders
blank. There are two ways round it:

1. **A development Clerk instance.** Put its `pk_test_…` publishable key in
   `VITE_CLERK_PUBLISHABLE_KEY` and its secret in `CLERK_SECRET_KEY`. Simplest. The user you sign
   in as needs `publicMetadata` of `{ "role": "admin", "dashboardAccess": "real" }` set in that
   instance's dashboard to see the admin screens.
2. **A tunnel to the production instance.**
   ```bash
   pnpm dev            # terminal 1
   pnpm dev:ngrok      # terminal 2 — prints an https://….ngrok-free.dev URL
   ```
   Add that URL to the Clerk dashboard's allowed origins and redirect URLs, then open it.
   `vite.config.js` already permits ngrok host names. Also add the origin to
   `ALLOWED_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` for the API, or its calls will be rejected.

An older mock-login helper (`localAuth`) was described in the archived local-Clerk documents. It
was never wired in and has been deleted.

## Tests

```bash
pnpm test           # once
pnpm test:watch
```

Vitest, Node environment. The suites cover pure logic — the bill parser, the LR-001 alignment
rule, request validation, CORS and the security helpers. There are no component tests; adding
them means adding `jsdom` and Testing Library first.

A parser fixture is the extracted *text* of a bill, not the PDF, and must be redacted before it
is committed — real bills carry the account holder's name, address and phone number. See
[`RUNBOOK.md`](../RUNBOOK.md#bill-extraction-produces-wrong-or-empty-figures).
