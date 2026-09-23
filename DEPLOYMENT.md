# Chaos Garden deployment

Chaos Garden currently deploys only the Worker-owned canonical ecosystem. The Astro frontend has been removed; a separately built offline-capable observer will add Pages deployment later.

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

This command executes `workers/schema.sql` against the selected D1 database. It initializes canonical tables and singleton rows; the first scheduled Worker execution creates the primordial canonical checkpoint.

## 2. Deploy the Worker

```bash
npm run deploy:workers
```

The deploy command builds `@chaos-garden/engine` before invoking Wrangler because the Worker imports the engine build output. Verify:

```text
https://<worker-url>/api/health
```

The Worker advances the canonical world every 15 minutes. Its public API is read-only: `/api/garden` and `/api/health`.

## 3. Post-deployment checks

- `GET /api/health` returns HTTP 200 after schema initialization.
- After the next cron invocation, `GET /api/garden` returns an exact canonical continuation.
- The cron trigger is `*/15 * * * *` in the Worker dashboard.

## D1 retention

The Worker retains the newest 500 checkpoints and their canonical-state records, approximately 5.2 days at the 15-minute cadence. The accepted storage budget is roughly 500 MB of checkpoint/state payloads plus D1 overhead; monitor actual database size after rollout.
