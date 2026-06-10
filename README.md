# Chaos Garden

Chaos Garden is a persistent ecosystem simulator with an Astro frontend and a Cloudflare Workers backend. Plants, herbivores, carnivores, and fungi evolve on a 2D canvas while the simulation continues on a 15-minute cron, stores history in Cloudflare D1, and exposes live state plus analytics through a small HTTP API.

## What the app includes

- A full-screen canvas garden rendered in the browser with entity selection, ambient effects, and responsive overlays
- A Worker-driven simulation tick that advances weather, aging, feeding, reproduction, death, decomposition, and persistence
- Four entity families: plants, herbivores, carnivores, and fungi
- Historical analytics with derived insights, event severity breakdowns, biodiversity trends, and food-web pressure views
- A journal/event overlay for browsing recent simulation activity
- Deterministic local seeding and a production seeding script tuned for a more sustainable remote baseline

## Stack

- `frontend/`: Astro 5 + TypeScript + Tailwind
- `workers/`: Cloudflare Workers + TypeScript
- `shared/`: shared TypeScript contracts
- Database: Cloudflare D1 (SQLite)

## Architecture

```text
frontend/
  src/pages/index.astro          app shell
  src/components/                canvas + overlays
  src/services/                  API client and garden service

workers/
  src/index.ts                   HTTP API + cron entry
  src/simulation/                tick loop, creatures, environment
  src/db/                        queries, migrations, simulation lock
  scripts/                       local and remote D1 initialization

shared/
  types.ts                       cross-layer contracts
```

### Runtime flow

1. The Worker cron runs every 15 minutes.
2. The tick updates weather and environment state.
3. Living entities age and receive environmental effects.
4. Species behaviors run in trophic order.
5. Deaths become dead matter when enough energy remains.
6. The new garden state, events, and cleanup are persisted to D1.
7. The frontend polls the API on the same 15-minute cadence and refreshes health every minute.

## Key simulation behavior

- Garden size is `800 x 600`
- Max living population is capped at `500`
- Weather is stateful and can transition through `CLEAR`, `OVERCAST`, `RAIN`, `STORM`, `DROUGHT`, and `FOG`
- Dead matter is tracked separately from living entities and expires after a TTL if fungi do not fully decompose it
- Garden history is retained for `1000` ticks, which backs the analytics window
- Wild recovery helpers can reintroduce missing trophic groups after extinction

## Local setup

### Prerequisites

- Node.js `>=18`
- A local npm install at repo root

### Install

```bash
npm install
```

### Configure the frontend API URL

Create `frontend/.env` for local development:

```bash
PUBLIC_API_URL=http://localhost:8787
```

The frontend build expects `PUBLIC_API_URL` to be present.

### Initialize the local D1 database

```bash
npm run db:init:local
```

This command:

- Drops and recreates the local schema
- Applies `workers/schema.sql`
- Seeds a deterministic baseline population
- Verifies required invariants after setup

Useful variants:

```bash
npm run db:init:local -- --verify-only
npm run db:init:local -- --schema-only
npm run db:init:local -- --seed=42
```

### Run the app

```bash
npm run dev
```

Local endpoints:

- Frontend: `http://localhost:4321`
- Worker API: `http://localhost:8787`

## API surface

The Worker currently exposes:

- `GET /api/garden`
  Returns the latest `gardenState`, living `entities`, `deadMatter`, and recent `events`.
- `GET /api/garden/stats?windowTicks=120`
  Returns current state, history, event breakdowns, derived analytics, insights, and entity vitals.
- `GET /api/health`
  Returns service health plus the latest completed tick and configured tick interval.

Notes:

- `windowTicks` is validated and supports `10` to `500`
- Non-health endpoints are rate-limited
- CORS is controlled through Worker vars

## Frontend behavior

The main page is a custom-element-driven garden shell with:

- Canvas rendering for the live ecosystem
- A weather/status layer
- Entity selection details
- A fullscreen stats overlay with historical charts and deterministic insights
- A journal overlay with event filtering and gallery/signals views
- A countdown to the next expected tick based on worker health data

## Database and seeding

`workers/schema.sql` creates:

- `garden_state`
- `entities`
- `simulation_events`
- `simulation_control`
- `dead_matter`
- `system_metadata`

Important scripts:

- `workers/scripts/init-local-db.js`
  Deterministic local reset and seed workflow
- `workers/scripts/init-remote-db-prod-v3.js`
  Remote production reset and habitat-zoned sustainable seed workflow

`npm run db:init:remote` is destructive for the target remote D1 database.

## Testing and verification

Useful commands:

```bash
npm run type-check:all
npm run test:all
npm run test -w @chaos-garden/workers
npm run test:integration -w @chaos-garden/workers
npm run test -w @chaos-garden/frontend
```

The repo includes:

- Shared contract tests
- Worker unit tests for creatures, environment, DB helpers, and tick orchestration
- Worker integration tests for simulation sustainability and D1 behavior
- Frontend service, audio, rendering, and stats tests

## Deployment

For deployment steps, use [DEPLOYMENT.md](DEPLOYMENT.md).

At a high level:

1. Create the D1 database and wire its `database_id` into `workers/wrangler.jsonc`
2. Run `npm run db:init:remote`
3. Deploy the Worker with `npm run deploy:workers`
4. Set `PUBLIC_API_URL` for the frontend deployment
5. Deploy the frontend with `npm run deploy:frontend`

## Current review notes

The app structure is solid and the README was mainly behind the implementation, but two issues surfaced during review:

1. `npm run test:all` currently fails in [`shared/types.test.ts`](/C:/Users/saadm/Documents/repos/chaos-garden/shared/types.test.ts:11) because `plantReproductionThreshold` is `69` while the test still expects plant < herbivore < carnivore thresholds.
2. The shared [`GardenResponse`](/C:/Users/saadm/Documents/repos/chaos-garden/shared/types.ts:450) contract is stale relative to the real `/api/garden` payload in [`workers/src/index.ts`](/C:/Users/saadm/Documents/repos/chaos-garden/workers/src/index.ts:244), which now returns `gardenState`, `entities`, `deadMatter`, and `events`.
