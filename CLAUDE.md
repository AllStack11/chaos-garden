# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chaos Garden is a living digital ecosystem simulation. Plants, herbivores, carnivores, and fungi interact through simple rules to produce emergent behavior. The garden runs 24/7 on Cloudflare's edge, evolving every 15 minutes via cron triggers.

## Architecture

**Monorepo with three npm workspaces:** `shared`, `workers`, `frontend`

- **shared/** — TypeScript type definitions only (no runtime code). Single source of truth for `Entity`, `Traits`, `GardenState`, `Environment`, database row shapes, and simulation config constants. Uses discriminated unions for polymorphic entity types.
- **workers/** — Cloudflare Workers backend. Handles API routes (`/api/garden`, `/api/health`, `/api/tick`), simulation tick execution, and D1 database persistence. The `scheduled()` handler runs ticks automatically via cron.
- **frontend/** — Astro 4 static site on Cloudflare Pages. Uses Web Components (Custom Elements) for canvas rendering and state management. `<garden-app>` bootstraps on load and polls `/api/garden` every 30 seconds. `<garden-canvas>` renders entities via 2D Canvas API with type-specific renderers.

**Data flow:** Browser → Astro static page → GardenService HTTP client → Workers API → Simulation engine → D1 SQLite database

**Simulation tick order:** Environment updates → Plants (photosynthesis) → Herbivores (eating) → Carnivores (hunting) → Fungi (decomposition) → Persist state + log events

## Development Commands

```bash
npm install                          # Install all workspace dependencies
npm run db:init:local                # Initialize local D1 database (required first time)
npm run dev                          # Run workers (:8787) + frontend (:4321) concurrently
npm run backend                      # Workers only on localhost:8787
npm run frontend                     # Astro only on localhost:4321
npm run type-check:all               # Type-check all workspaces
npm run type-check -w @chaos-garden/workers   # Type-check workers only
npm run test -w @chaos-garden/workers         # Run unit tests
npm run test:watch -w @chaos-garden/workers   # Run tests in watch mode
npm run test:integration -w @chaos-garden/workers  # Run integration tests
npm run test:coverage -w @chaos-garden/workers     # Run tests with coverage report
npm run deploy:workers               # Deploy workers to Cloudflare
npm run deploy:frontend              # Deploy frontend to Cloudflare Pages
npm run tail -w @chaos-garden/workers # Stream production worker logs
```

**Testing:** Vitest is configured for the workers workspace. Unit tests are located in `workers/tests/unit/` and integration tests in `workers/tests/integration/`. Type checking and testing are the primary quality mechanisms.

## Key Conventions

- **Never use `any` types.** Strict TypeScript everywhere.
- **Function names must be verbose and self-explanatory:** `isEntityReadyToReproduce`, `calculateEnergyGainFromSunlight`, `removeDeadEntitiesFromGarden` — not `check`, `calc`, `prune`.
- **Constants over magic numbers:** `MINIMUM_ENERGY_TO_REPRODUCE`, `ENERGY_LOST_PER_TICK`.
- **camelCase** for variables/functions, **PascalCase** for types/interfaces/classes, **UPPER_SNAKE_CASE** for constants.
- Each creature type module (plants.ts, herbivores.ts, carnivores.ts, fungi.ts) follows the same pattern: `createNew*Entity()`, `process*BehaviorDuringTick()`, `is*Dead()`, `get*CauseOfDeath()`.
- Database queries use D1 prepared statements with parameter binding — never string concatenation.
- Frontend uses vanilla JS Web Components, not a framework. Canvas draw functions should be pure.

## Config Files

- `workers/wrangler.jsonc` — Production Workers config (D1 binding, cron `*/15 * * * *`)
- `workers/wrangler.local.jsonc` — Local dev config (local D1, CORS to localhost:4321)
- `workers/schema.sql` — D1 schema (tables: garden_state, entities, application_logs, simulation_events)
- `frontend/astro.config.mjs` — Astro SSG config with Tailwind integration, port 4321
