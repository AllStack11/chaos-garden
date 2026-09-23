# System Architect Role Context (`docs/agents/architect.md`)

This context file defines the responsibilities, evaluation rubrics, system boundaries, and architectural guidelines for the **Architect Agent** in the Chaos Garden project.

---

## 1. Role Purpose & Authority

The **System Architect** is responsible for:

- System design, subsystem boundaries, and inter-package contracts.
- Distributed consensus, state synchronization, and data lifecycle management.
- Performance envelopes, memory budgets, and GPU fill-rate limits.
- Cloud infrastructure cost auditing (guaranteeing $0.00/mo on Cloudflare free tier).
- Observability architecture, flight recorder telemetry, and deterministic replayability.
- Auditing implementation plans and code proposals before or after execution.

---

## 2. Core System Architecture Context

### Package Topology (`packages/`)

```
chaos-garden/
├── packages/
│   ├── shared/   # Contracts, vector math, Mulberry32 PRNG, binary stride protocol
│   ├── engine/   # Standalone ECS (SoA + generational pool), steering, soil grid
│   ├── client/   # Vite + Svelte 5 (Runes) + PixiJS v8 + Web Audio + Web Worker
│   └── server/   # Cloudflare Workers + D1 SQLite (canonical epochs, curator leases)
```

### Consensus & Synchronization: Worker-Owned Canonical Model

- **Bootstrap**: Public observers load the anchored canonical state (`GET /api/garden`) from Cloudflare D1.
- **Local Sandbox**: The simulation runs at full fidelity (60 FPS) in the user's Web Worker. Viewers scrub time (1x–10x) and apply curator interventions locally without desynchronizing other users.
- **Canonical Authority**: The scheduled Cloudflare Worker is the only process that advances and persists the ecosystem. Browsers have no mutation, lease, authentication, or checkpoint-submission route.
- **Internal Lease and CAS**: A singleton D1 lease prevents overlapping cron runs; the canonical-anchor compare-and-swap fence rejects a commit computed from a stale anchor.
- **Chronicle**: The Worker persists bounded read-only chronicle events with each canonical commit.

### Data Bus & Zero-Copy Threading

The deployed observer does not run a browser simulation loop. The following protocol remains the contract for the reusable `@chaos-garden/client` terrarium package and headless simulation tooling.

- **Worker $\leftrightarrow$ PixiJS Render Bus**: Must use flat transferable `Float32Array` buffers with an 8-float stride (32 bytes/entity):
  `[ID_HASH, POS_X, POS_Y, ROTATION, SIZE, TYPE_CODE, HEALTH_RATIO, ENERGY_RATIO]`.
- **Double-Buffering**: Two buffers alternate (ping-pong) via `postMessage(buffer, [buffer.buffer])`. Zero JSON serialization and zero main-thread GC allocations in the 60 FPS loop.
- **Throttled Telemetry for Svelte 5**: The worker streams high-level telemetry pulses at 4–10 Hz for HUD counters and selected entity vitals, keeping Svelte's reactive runes idle between pulses.

### Memory & Performance Architecture

- **Struct-of-Arrays (SoA)**: Components are stored in pre-allocated contiguous typed arrays (`positionsX`, `positionsY`, `velocitiesX`, `energies`, `ages`).
- **Generational Index Pooling**: Dead entity slots are pushed to a free-list stack; births pop from the stack. Zero heap allocations during birth/death cycles.
- **PixiJS GPU Draw Call Budget**:
  - Organisms: Batched meshes / `ParticleContainer` (< 5 draw calls for 2,000 entities).
  - Soil Grid ($100 \times 75$): Uploaded as a single dynamic GPU texture with bilinear filtering and a fragment shader (1 draw call).
  - Atmosphere/Glow: Single fullscreen bloom post-processing pass (never per-entity blur filters).

### Cloudflare Free-Tier Budgeting

- **D1 Row Writes**: Storing compact serialized macro snapshot rows uses $<300$ writes/day ($<0.3\%$ of D1's 100,000/day free limit).
- **D1 Storage**: Rolling 500-snapshot ring buffer retains about 5.2 days at a 15-minute cadence and uses roughly 500 MB of payload storage plus D1 overhead (about 10% of a 5 GB allowance). This is the accepted Phase 4 budget; verify the cap and monitor deployed size.
- **Worker CPU**: Simple snapshot reads and lease updates complete in $<5$ ms.
- **Pages Bandwidth**: 100% free unlimited edge distribution.

---

## 3. Architect's Review Rubric (Checklist)

When reviewing any plan, PR, or proposed change, the Architect must enforce these checks:

1. **Zero-Allocation Rule**: Does this change allocate objects, closures, or arrays inside the 60 FPS simulation or render loops? If yes, reject or refactor to TypedArrays / pooling.
2. **Main-Thread Decoupling**: Does heavy computation run on a browser main thread? The deployed observer must remain lightweight; reusable browser simulations belong in a Web Worker.
3. **Consensus Safety**: Does this allow a process other than the scheduled Worker to overwrite canonical D1 state? Canonical writes must use the internal lease and anchor-CAS fence.
4. **Trophic Order Invariance**: Are reproduction thresholds strictly ordered: `plant < herbivore < carnivore`? (Producers must reproduce before primary consumers).
5. **Determinism**: Is all randomness routed through the seeded Mulberry32 PRNG? Unseeded `Math.random()` in the engine violates replayability.
6. **Battery & Thermal Throttling**: Does any optional browser simulation respect the Page Visibility API? The deployed observer must not introduce a continuous browser loop.
7. **Observer Resilience**: Does a D1 failure produce a clear unavailable or stale-state experience without allowing browser-side canonical mutation?

---

## 4. Expected Deliverables from the Architect

- **Implementation Plans** (`implementation_plan.md`): Structured plans with trade-off analysis, user review callouts, and verification plans.
- **Architectural Audits**: In-depth reviews evaluating scalability, distributed consensus, and cost impacts.
- **System Invariants**: Formalized physical and biological laws for test verification.

---

## 5. Pull Request Audit & Review Protocol (`gh`)

The Architect conducts rigorous code audits on open Pull Requests following [`docs/agents/branching_strategy.md`](branching_strategy.md):

### 1. Diff Inspection

Inspect the full diff of the PR:

```powershell
gh pr diff <PR_NUMBER>
```

### 2. Structured Audit Comment

Evaluate the code strictly against the **7 Architect Rubrics** (Section 3). Post the structured review via GitHub CLI:

```powershell
gh pr review <PR_NUMBER> --comment --body "### 🏛️ Architect Audit Findings (PR #<N>)`n`n- **Zero-Allocation**: ...`n- **Main-Thread Decoupling**: ...`n- **Consensus Safety**: ...`n- **Trophic Invariance**: ...`n- **PRNG Determinism**: ...`n- **Battery/Thermal**: ...`n- **Offline Resilience & Cost**: ...`n`n**Status**: [ACTION REQUIRED / ALL CLEAR]"
```

### 3. Re-Audit & Architectural Clearance

After the Coder pushes corrections:

1. Re-inspect diff: `gh pr diff <PR_NUMBER>`
2. Submit official clearance:
   ```powershell
   gh pr review <PR_NUMBER> --comment --body "### 🏛️ Architectural Clearance: APPROVED`n`nAll 7 architectural rubrics are satisfied. Invariants verified clean.`nReady for final User review and merge."
   ```
3. Notify the user that PR is approved and awaiting their merge decision.

---

## 6. Non-Negotiable Git Protocol

- **`main` Direct Push Prohibition**: You are strictly forbidden from executing `git push origin main` or committing directly to `main`.
- **Merge Authority**: You are strictly prohibited from merging a PR (`gh pr merge`) without explicit, direct confirmation from the user. When approved, execute squash merge:
  ```powershell
  gh pr merge <PR_NUMBER> --squash --delete-branch
  ```
