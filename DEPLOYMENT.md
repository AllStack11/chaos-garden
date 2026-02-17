# Chaos Garden Deployment

This guide gets Chaos Garden live on Cloudflare using your existing Cloudflare account and GitHub repo.

## 1) Prerequisites

- Cloudflare account
- GitHub repo with this project
- Wrangler authenticated locally (`npx wrangler login`)
- Node.js 20+

## 2) One-time Cloudflare setup

### Create D1 database

Run:

```bash
npx wrangler d1 create chaos-garden-db
```

Copy the returned `database_id` and place it in:

- `workers/wrangler.jsonc` at `d1_databases[0].database_id`
- `workers/wrangler.jsonc` at `env.dev.d1_databases[0].database_id`

### Initialize remote D1 schema + seed data

From repository root:

```bash
npm run db:init:remote
```

This resets the remote D1 database, applies `workers/schema.sql`, and seeds the v3 production resilience baseline population.

Optional custom seed:

```bash
npm run db:init:remote -- --seed=12345
```

### Deploy Workers API once

```bash
npm run deploy:workers
```

Or run DB init + Worker deploy together:

```bash
npm run deploy:workers:with-db-init
```

After deploy, note your Worker URL:

- `https://chaos-garden-api.<your-subdomain>.workers.dev`

### Create Cloudflare Pages project

Create a Pages project in Cloudflare dashboard (or via Wrangler) named `chaos-garden-frontend`.

## 3) Configure CORS for production

Set `CORS_ORIGIN` in `workers/wrangler.jsonc` to your Pages production URL, for example:

```json
"CORS_ORIGIN": "https://chaos-garden-frontend.pages.dev"
```

Then deploy Worker again:

```bash
npm run deploy:workers
```

## 4) GitHub Actions deployment (recommended)

This repo now includes `.github/workflows/deploy.yml`.

Add these GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`: token with Workers + Pages + D1 permissions
- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account id
- `CLOUDFLARE_PAGES_PROJECT_NAME`: e.g. `chaos-garden-frontend`
- `PUBLIC_API_URL`: your Worker URL, e.g. `https://chaos-garden-api.<subdomain>.workers.dev`

After secrets are set, pushing to `main` deploys both Worker and Pages.

## 5) Local/manual deploy commands

From repository root:

```bash
npm run deploy:workers
PUBLIC_API_URL=https://chaos-garden-api.<subdomain>.workers.dev npm run deploy:frontend
```

## 6) Quick verification

- Worker health endpoint: `https://<worker-url>/api/health`
- Frontend loads and shows live data
- Cron trigger exists in Worker dashboard (`*/15 * * * *`)

## Notes

- `npm run db:init:remote` is destructive for the target D1 database (it drops and recreates schema).
- Use `npm run db:init:remote:verify` to validate database invariants.
