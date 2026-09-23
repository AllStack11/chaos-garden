# Chaos Garden deployment

Chaos Garden deploys the Worker-owned canonical ecosystem and its read-only Vite/Svelte observer to Cloudflare Pages.

## Prerequisites

- Cloudflare account and Wrangler authentication (`npx wrangler login`)
- Node.js 22.5+
- A D1 database named `chaos-garden-db`

## 1. Configure D1

Create the database if necessary:

```bash
npx wrangler d1 create chaos-garden-db
```

Place the returned database ID in `workers/wrangler.jsonc`, then initialize the canonical schema:

```bash
npm run db:init:remote
```

This command executes `workers/canonical-cutover.sql` against the selected D1 database. It initializes canonical tables and singleton rows, cleanses legacy pre-v3 records, and prepares the database for the first scheduled Worker execution to create the primordial canonical checkpoint.

## 2. Deploy the Worker

```bash
npm run deploy:workers
```

The deploy command builds `@chaos-garden/engine` before invoking Wrangler because the Worker imports the engine build output. Verify:

```text
https://<worker-url>/api/health
```

The Worker advances the canonical world every minute. Its public API is read-only: `/api/garden` and `/api/health`.

## 3. Deploy the frontend

The client build reads `VITE_API_BASE_URL` to reach the Worker from its Pages origin.
Set it to the Worker URL (without `/api`), then deploy the built client to the
Cloudflare Pages project:

```bash
VITE_API_BASE_URL=https://chaos-garden-api.saadmankabir95.workers.dev npm run client:build
npx wrangler pages deploy packages/client/dist --project-name chaos-garden-frontend --branch main
```

## 4. Post-deployment checks

- `GET /api/health` returns HTTP 200 after schema initialization.
- After the next cron invocation, `GET /api/garden` returns an exact canonical continuation.
- The cron trigger is `*/15 * * * *` in the Worker dashboard.
- `https://chaos-garden-frontend.pages.dev` loads the browser client.

## GitHub Actions

Pull requests to `main` run the workspace verification suite in `ci.yml`:
type checks, tests, deterministic simulation checks, the allocation audit, and
the reusable browser-client build. A merge to `main` runs the same checks before
`deploy.yml` deploys the Worker and verifies its public health endpoint.

Configure these repository secrets for deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `PUBLIC_API_URL` (the Worker URL without `/api`)

The deployment workflow deliberately does not run the D1 cutover. Run
`npm run db:init:remote` as a planned, one-time schema operation before the
first deployment or when an intentional cutover is required.

## D1 retention

The Worker retains the newest 500 checkpoints and their canonical-state records, approximately 8 hours and 20 minutes at the one-minute cadence. The accepted storage budget is roughly 500 MB of checkpoint/state payloads plus D1 overhead; monitor actual database size after rollout.
