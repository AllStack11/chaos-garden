# Chaos Garden

Chaos Garden is a deterministic ecosystem curated exclusively by a scheduled Cloudflare Worker. No web frontend is currently shipped; a separately built, offline-capable read-only observer will consume the public API.

## Runtime model

1. Every 15 minutes, the scheduled Worker hydrates the canonical engine checkpoint.
2. It advances a fixed deterministic batch of simulation ticks.
3. It atomically persists the next checkpoint, canonical world state, and anchor pointer in D1.
4. `GET /api/garden` serves the anchored state; no browser mutation, curator lease, authentication, or checkpoint endpoint is exposed.

The Worker uses an internal singleton lease and an anchor compare-and-swap fence to prevent overlapping cron executions from advancing the canonical garden twice.

## Packages

- `packages/shared/` — contracts, PRNG, math, binary checkpoint protocol, and chronicle utilities.
- `packages/engine/` — deterministic ECS simulation.
- `packages/client/` — reusable browser simulation and persistence components; not part of the currently deployed product.
- `workers/` — Cloudflare Worker API, scheduled canonical advancement, and D1 persistence.

## D1 retention and storage

The database keeps the latest **500** canonical checkpoints. At the 15-minute cron cadence this represents about **5.2 days** of history.

At the default 2,000-slot engine capacity, a checkpoint is approximately 342 KB and its persisted canonical-state JSON is approximately 661 KB. The 500-snapshot window therefore uses roughly **500 MB of payload storage**, plus SQLite/D1 index overhead. This is an accepted, bounded design budget within the 5 GB D1 storage allowance; monitor the actual D1 size after deployment.

## Local setup

Prerequisites: Node.js 22.5+ and npm.

```bash
npm install
npm run db:init:local
npm run dev
```

Local Worker API: `http://localhost:8787`

`db:init:local` executes the canonical schema. The first scheduled invocation seeds and commits the primordial canonical checkpoint.

## API

- `GET /api/garden` — current anchored canonical state, exact-continuation checkpoint, and recent chronicle events.
- `GET /api/health` — Worker/D1 health, canonical tick, schema version, and internal lease activity.

All public endpoints are read-only.

## Verification

```bash
npm run type-check:all
npm run test:all
npm run sim:run -- --seed=42 --ticks=500 --headless
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). The current deployment is Worker-only; frontend deployment will be added with the replacement observer.
