# Chaos Garden - Architectural Redesign Implementation Plan

A comprehensive architectural redesign and implementation roadmap for **Chaos Garden**, transitioning from a turn-based 15-minute cron slideshow with imperative custom elements to a continuous 60 FPS client-side biological simulation powered by a modular Entity Component System (ECS), PixiJS v8 hardware-accelerated bioluminescent rendering, Svelte 5 reactive HUD overlays, Web Audio procedural soundscapes, an **Anchor & Branch** canonical synchronization layer backed by Cloudflare D1, and a dedicated **Observability, Testing & LLM Diagnostics Subsystem**.

Designed to run at **$0.00/month** on Cloudflare free-tier infrastructure.

---

## 🚦 Project Status & Progress Tracker

| Phase | Milestone | Scope | Status |
| :--- | :--- | :--- | :--- |
| **Foundation** | **Agent Roles & Dispatcher** | `AGENTS.md`, `agents/architect.md`, `agents/coder.md`, machine-agnostic rules | ✅ **COMPLETED** |
| **Phase 1** | **Shared Contracts (`@chaos-garden/shared`)** | Taxonomy, vector math, PRNG, stride protocol, soil/weather types, diagnostics, API contracts | ✅ **COMPLETED** |
| **Phase 2** | **Simulation Engine (`@chaos-garden/engine`)** | Standalone ECS, SoA pooling, Boid steering, 2D soil grid, Flight Recorder, headless CLI | ⏳ **UP NEXT** |
| **Phase 3** | **Client App (`@chaos-garden/client`)** | Vite + Svelte 5 (Runes) + PixiJS v8 + Web Audio API + Web Worker bridge | 📋 Queued |
| **Phase 4** | **Cloudflare Backend (`@chaos-garden/server`)** | Streamlined Worker API, D1 migrations, curator lease consensus, diagnostics | 📋 Queued |

---

## Completed Milestones Detail

### ✅ Foundation: Agent Role Infrastructure & Machine-Agnostic Dispatcher
- **Core Dispatcher**: [`AGENTS.md`](../AGENTS.md) serves as the lean starting point, instructing agents to load only their specific role context file.
- **Architect Role Context**: [`agents/architect.md`](../agents/architect.md) documents subsystem boundaries, consensus models, zero-allocation memory envelopes, GPU draw-call budgets, and a 7-point review rubric.
- **Coder Role Context**: [`agents/coder.md`](../agents/coder.md) provides concrete implementation patterns (SoA memory layout, Craig Reynolds steering formulas, Svelte 5 Runes idioms, PixiJS batching).
- **Universal Agnostic Invariant**: All paths and scripts are strictly workspace-relative and cross-platform (supporting Windows PowerShell, macOS, and Linux).
- **Subagents**: Registered `architect` and `coder` subagents.

### ✅ Phase 1: Shared Package & Core Contracts (`packages/shared/`)
- **Biological Taxonomy & Genetics**:
  - Four kingdoms (`plant`, `herbivore`, `carnivore`, `fungus`) with numeric `EntityTypeCode` enums.
  - Genetic chromosomes (`PlantGenome`, `HerbivoreGenome`, `CarnivoreGenome`, `FungusGenome`) supporting mutation and speciation.
- **High-Performance 2D Vector Math**:
  - Zero-allocation vector arithmetic, dot products, normalization, distance, limits, headings, and toroidal wrapping ([`packages/shared/src/math/vector.ts`](../packages/shared/src/math/vector.ts)).
- **Deterministic Seeded PRNG**:
  - Fast Mulberry32 generator guaranteeing 100% reproducible simulations across Web Workers, Node.js, and CI test runners ([`packages/shared/src/math/random.ts`](../packages/shared/src/math/random.ts)).
- **Zero-Copy Binary Render Stride Protocol**:
  - Flat 32-byte (8 float) stride: `[ID_HASH, POS_X, POS_Y, ROTATION, SIZE, TYPE_CODE, HEALTH_RATIO, ENERGY_RATIO]`.
  - 24-bit integer hashing (`MAX_SAFE_FLOAT32_INT = 16777215`) guaranteeing zero IEEE 754 precision rounding error in Float32Array buffers.
  - Transferable ArrayBuffer allocators and batch serializers for streaming 2,000+ entities to PixiJS with zero GC allocations ([`packages/shared/src/math/stride.ts`](../packages/shared/src/math/stride.ts)).
- **2D Dynamic Soil Matrix**:
  - Scalar matrix specifications ($100 \times 75$ resolution, 16px cell size for $1600 \times 1200$ world) for soil moisture and decomposed nitrates ([`packages/shared/src/types/soil.ts`](../packages/shared/src/types/soil.ts)).
- **Observability & LLM Diagnostics**:
  - Machine-readable JSON-Lines (`StructuredLogEvent`) schemas.
  - Compact `DiagnosticSnapshot` format for 1-click clipboard LLM debugging prompts.
  - `FlightRecorderSnapshot` circular ring buffer specifications ([`packages/shared/src/types/diagnostics.ts`](../packages/shared/src/types/diagnostics.ts)).
- **Client-Server API Contracts & Universal Constants**:
  - Canonical world state schemas, curator lease tokens, checkpoint submissions, and chronicle events.
  - Universal physical constants with trophically ordered reproduction thresholds: `plant (55) < herbivore (65) < carnivore (75)`.
- **Validation**:
  - 6 test suites and 29 unit tests pass in **70ms** (`npx vitest run`).
  - Strict TypeScript compilation (`tsc --noEmit` and `npm run build` exit code `0`).
  - Compiled output generated in `packages/shared/dist/`.

---

## Architecture Blueprint

```
chaos-garden/
├── docs/               # Architecture documents and implementation plans
├── agents/             # Role context files (architect.md, coder.md)
├── packages/
│   ├── shared/         # [COMPLETED] Cross-layer types, math, PRNG, binary stride, contracts
│   ├── engine/         # [NEXT] Pure ECS engine (SoA + Generational Free-List, Boids, Soil)
│   │   ├── ecs/        # World, Entity pool, Bitmask component storage, System scheduler
│   │   ├── systems/    # Sensory (Spatial Grid), Steering (Boids), Soil, Metabolism, Genetics
│   │   ├── terrain/    # 2D diffusion grid for soil moisture & decomposed nutrients
│   │   ├── diagnostics/# Flight Recorder, structured JSONL logger, invariant checkers
│   │   └── cli/        # Headless simulation runner (sim:run, sim:replay, audit:sim)
│   ├── client/         # [QUEUED] Vite + Svelte 5 (Runes) + Tailwind CSS + PixiJS v8 + Web Audio
│   │   ├── worker/     # Web Worker hosting @chaos-garden/engine (Zero-copy Transferable Buffers)
│   │   ├── renderer/   # PixiJS v8 batched renderers, dynamic soil texture, fullscreen bloom
│   │   ├── audio/      # Web Audio API generative procedural synthesizer & soundscape
│   │   ├── power/      # Page Visibility API throttling (battery & thermal manager)
│   │   └── ui/         # Svelte 5 glassmorphic HUD, curator toolbar, LLM 1-click inspector
│   └── server/         # [QUEUED] Cloudflare Worker API + Cloudflare D1 SQLite database
│       ├── api/        # /api/garden, /api/garden/checkpoint, /api/diagnostics/summary
│       └── db/         # D1 schema, migrations, epoch checkpoints, diagnostic log buffer
```

---

## Upcoming Phases & Specifications

### Phase 2: Standalone ECS Simulation Engine (`packages/engine`) — UP NEXT

Create a framework-agnostic, zero-dependency ECS simulation engine capable of running inside a browser Web Worker, Node.js unit tests, or headless CLI runners.

#### 1. Core ECS Architecture
- **`packages/engine/src/ecs/ComponentStorage.ts`**:
  - Struct-of-Arrays (SoA) pre-allocated TypedArray columns (`positionsX`, `positionsY`, `velocitiesX`, `velocitiesY`, `energies`, `healths`, `ages`, `typeCodes`).
  - Generational index free-list pooling: dead slots pushed to a free-list stack, births pop from the stack. **0 bytes allocated during continuous life/death cycles**.
- **`packages/engine/src/ecs/World.ts`**:
  - Coordinates system execution sequence, entity lifecycle, and fixed-timestep clock (default 60 TPS with variable time-scale multiplier: 0.5x, 1x, 2x, 5x, 10x).

#### 2. Spatial Partitioning & Living Terrain
- **`packages/engine/src/spatial/SpatialHashGrid.ts`**:
  - $O(1)$ grid-bucket partitioning for rapid proximity queries (predator detection, food sensing, mate seeking).
- **`packages/engine/src/terrain/SoilNutrientGrid.ts`**:
  - 2D scalar fields modeling soil moisture and nitrate diffusion.
  - Plants absorb local nutrients; fungi break down corpses into local nitrates; rain adds moisture.

#### 3. Behavioral Systems
- **`packages/engine/src/systems/SensorySystem.ts`**: Queries the spatial hash grid to populate perceived neighbor lists.
- **`packages/engine/src/systems/SteeringSystem.ts`**: Computes Craig Reynolds autonomous forces:
  - *Herbivores*: Separation, Alignment, Cohesion + Fleeing predators + Seeking plants.
  - *Carnivores*: Pack coordination + Stalking/Pursuit + Obstacle avoidance.
  - *Plants & Fungi*: Seed dispersal and spore drift.
- **`packages/engine/src/systems/MetabolismSystem.ts`**: Metabolic drain, hunger decay, aging, and death.
- **`packages/engine/src/systems/GeneticsSystem.ts`**: Mutation and crossover algorithms for newborn offspring.
- **`packages/engine/src/systems/EventSystem.ts`**: Detects and records macro events (speciation, population booms, apex predator emergence, droughts).

#### 4. Observability & Diagnostics
- **`packages/engine/src/diagnostics/FlightRecorder.ts`**: 300-tick circular ring buffer tracking population deltas, genetic drift, and critical events.
- **`packages/engine/src/diagnostics/StructuredLogger.ts`**: JSONL structured logger with component tagging.
- **`packages/engine/src/diagnostics/InvariantChecker.ts`**: Automated physical invariant verification (mass conservation, coordinate limits).

#### 5. Headless CLI & Web Worker Harness
- **`packages/engine/src/cli/runHeadless.ts`**: CLI runner supporting `npm run sim:run -- --seed=<N> --ticks=<N> --headless` and `npm run sim:replay -- --snapshot=<file>`.
- **`packages/engine/src/cli/auditEngine.ts`**: 1-second terminal health check for AI agents (`npm run audit:sim`).
- **`packages/engine/src/worker/SimulationWorker.ts`**: Web Worker harness executing the engine loop, managing the double-buffered transferable `Float32Array` pipeline, and dispatching throttled telemetry to Svelte.

---

### Phase 3: Client Application (`packages/client`)

Replace legacy Astro frontend with a Vite + Svelte 5 + PixiJS v8 single-page application.

- **PixiJS v8 Viewport & Renderers** ([`packages/client/src/renderer/`]):
  - `GardenViewport.ts`: DPR-aware setup, smooth pan/zoom camera controls.
  - `OrganismGraphics.ts`: Batched bioluminescent rendering for all 4 kingdoms with membrane pulsations (< 5 draw calls).
  - `SoilLayer.ts`: Single GPU dynamic texture with bilinear fragment shader (1 draw call).
  - `PostProcessVeil.ts`: Fullscreen additive bloom and weather lighting tints.
- **Generative Soundscape** ([`packages/client/src/audio/`]):
  - 100% synthesized Web Audio API procedural soundscape reacting to daylight, weather, and biodiversity with zero audio assets.
- **Power & Offline Management** ([`packages/client/src/power/`, `packages/client/src/storage/`]):
  - `VisibilityManager.ts`: Throttles Web Worker to 5 TPS and suspends audio when tab is hidden.
  - `LocalPersistence.ts`: Local-first IndexedDB snapshot cache for offline resilience.
- **Svelte 5 HUD Overlays** ([`packages/client/src/ui/`]):
  - `App.svelte`: Root shell wiring Web Worker bridge, PixiJS canvas, and Svelte HUD.
  - `CuratorToolbar.svelte`: Play/Pause, speed scrubber (1x–10x), soft curator tools (nutrient drop, water soil), follow-cam.
  - `EntityInspector.svelte`: Real-time creature vitals, genome readouts, lineage tree.
  - `StatsDashboard.svelte`: Historical timeseries, trophic biomass pyramids, biodiversity indices.
  - `JournalDrawer.svelte`: Chronicle of evolutionary milestones.
  - `LlmInspectorModal.svelte`: 1-click Flight Recorder diagnostic dump generator for LLMs.

---

### Phase 4: Cloudflare Server & Canonical World (`packages/server`)

Streamline Cloudflare Workers and D1 database to serve as the source of truth for the canonical global terrarium.

- **API Routes** ([`packages/server/src/index.ts`]):
  - `GET /api/garden`: Returns current canonical garden snapshot and latest chronicle milestones.
  - `POST /api/garden/checkpoint`: Validates and commits authorized curator checkpoints to D1.
  - `POST /api/garden/curator-lease`: Grants or renews a temporary curator lease (2-min TTL).
  - `GET /api/garden/stats`: Historical timeseries analytics for the dashboard.
  - `GET /api/diagnostics/summary` & `/api/diagnostics/logs`: Machine-readable diagnostic feeds.
  - `GET /api/health`: Service health and D1 connectivity.
- **Optimized D1 Schema** ([`packages/server/schema.sql`]):
  - Stores compact serialized macro snapshot blobs to keep daily D1 writes $<300$/day ($<0.3\%$ of free tier).
  - Rolling 500-snapshot ring buffer keeping database storage $<50$ MB ($<1\%$ of free tier).

---

## Verification Plan

### Automated Tests
1. **Engine Unit & Invariant Tests** (`packages/engine`):
   ```bash
   npm run test -w @chaos-garden/engine
   ```
   - Zero memory allocation during 10,000 tick life/death cycles.
   - Steering force calculation bounds and boundary containment.
   - Soil grid diffusion conservation of mass.
   - Genetic mutation constraints and inheritance.
   - Flight Recorder ring buffer rollover under load.
2. **Headless CLI Simulation**:
   ```bash
   npm run sim:run -- --seed=123 --ticks=1000 --headless
   npm run audit:sim
   ```
3. **Shared Contracts Test** (`packages/shared`):
   ```bash
   npm run test -w @chaos-garden/shared
   ```
4. **Server API & Diagnostics Tests** (`packages/server`):
   ```bash
   npm run test -w @chaos-garden/server
   ```

### Manual Verification
1. **LLM Diagnostic Workflow**: Click "Audit / LLM Export" in Curator HUD; verify clipboard contains clean Markdown diagnostic summary with seed, FPS, and ecological vitals.
2. **60 FPS Performance Profiling**: Verify steady 60+ FPS with 2,000+ living organisms with zero GC sawteeth in Chrome DevTools.
3. **Battery / Background Tab Throttling**: Verify CPU drops to near-zero when tab is blurred and smoothly resumes on focus.
4. **Offline Resilience**: Verify simulation runs smoothly when disconnected from the network.
5. **Visuals & Camera**: Smooth pan/zoom, dynamic soil texture rendering, and bioluminescent bloom.
6. **Curator Agency**: Play/Pause, speed scrubbing (1x–10x), follow-cam, nutrient drops, and soil watering.
7. **Procedural Audio**: Reactive procedural chords shifting with daylight and weather.
8. **Canonical Synchronization**: Clean bootstrapping from Cloudflare D1 and authorized curator checkpoint commits.
