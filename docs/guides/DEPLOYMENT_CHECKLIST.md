# Deployment checklist

The project deploys to **Vercel**: `main` auto-deploys to production, and every pull request
gets a preview. There is no manual deploy step. This is what to check around one.

## Before merging

- [ ] CI is green: lint, tests, build and `pnpm audit --prod --audit-level high`. All four are
      mandatory; none is `--if-present`.
- [ ] If the change adds a serverless function, the count is still within Vercel Hobby's limit
      of **12** (currently 10). Anything under `api/_lib/` or `api/_config/` does not count.
- [ ] If the change adds a database migration, read its header for **ordering**. Some must run
      after the code is deployed, some before. See [`../MIGRATIONS.md`](../MIGRATIONS.md).
- [ ] If the change adds an environment variable, it is in `.env.example` with a comment, and
      set in **both** Vercel and GitHub Actions if scheduled jobs use it. The two hold separate
      copies.
- [ ] No secret sits behind a `VITE_` prefix. Vite compiles those into the public bundle.
      Server-side secrets — `SUPABASE_SERVICE_KEY`, `CLERK_SECRET_KEY`, `SOLIS_API_ID`,
      `SOLIS_API_SECRET` — must never have a `VITE_` twin.

## Required environment

Set in Vercel → Project → Settings → Environment Variables. Every variable is documented in
`.env.example`.

| Variable | Notes |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | The key must be the **service_role** key. An anon key is rejected with an explanation |
| `CLERK_SECRET_KEY` | Authorises every admin endpoint |
| `SOLIS_API_URL`, `SOLIS_API_ID`, `SOLIS_API_SECRET` | Server-side only |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_USE_CLERK_AUTH` | Public by design |
| `ALLOWED_ORIGINS`, `CLERK_AUTHORIZED_PARTIES` | Optional. Each **replaces** its default list |

## After a deploy

```bash
curl -s https://solaredge.anujajay.com/healthz | jq   # is it up?
curl -s https://solaredge.anujajay.com/ready   | jq   # config and database
```

`/ready` reports the service key's role. Anything other than `service_role` (or `null` for the
newer opaque `sb_secret_…` keys) means writes will fail.

Then a quick pass through what the change touched. For anything near the bill pipeline:

- [ ] Upload a PDF → parsing runs → it appears in the review queue
- [ ] Preview opens the PDF
- [ ] Approve a bill → the row appears in the table and the ingestion shows `approved`
- [ ] Delete something you uploaded for the test

## Rolling back

Vercel → Deployments → the previous production deployment → **Promote to Production**. Code only:
database migrations are not rolled back by this. Each migration's header says how to reverse it.

## Scheduled jobs

The GitHub Actions workflows run from the default branch and use their own copy of the
secrets. After changing a secret, run the affected workflow once by hand and read the log. The
jobs now exit non-zero if `SUPABASE_SERVICE_KEY` is an anon key. See the
[runbook](../RUNBOOK.md#the-workflows).
