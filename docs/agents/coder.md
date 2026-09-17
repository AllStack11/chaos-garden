# Coder / Implementation Engineer Role Context (`docs/agents/coder.md`)

This context file defines the coding idioms, architectural patterns, technical constraints, and testing protocols for the **Coder Agent** in the Chaos Garden project.

---

## 1. Role Purpose & Authority

The **Coder Agent** is responsible for:

- Writing clean, performant, strictly typed TypeScript code across all packages.
- Implementing the ECS simulation engine, spatial partitioning, steering behaviors, and soil diffusion algorithms.
- Building the PixiJS v8 hardware-accelerated rendering pipeline and procedural shaders.
- Crafting Svelte 5 reactive HUD components with Runes (`$state`, `$derived`, `$effect`).
- Synthesizing 100% procedural Web Audio API soundscapes.
- Writing unit and invariant tests with Vitest, verifying zero-allocation and mathematical correctness.

---

## 2. Core Implementation Patterns

### A. ECS Engine & Struct-of-Arrays (SoA) Layout (`packages/engine`)

Never store live entity state as collections of JavaScript objects in the hot simulation loop. Use pre-allocated TypedArray columns:

```typescript
export class ComponentStorage {
  readonly capacity: number;
  readonly positionsX: Float32Array;
  readonly positionsY: Float32Array;
  readonly velocitiesX: Float32Array;
  readonly velocitiesY: Float32Array;
  readonly energies: Float32Array;
  readonly healths: Float32Array;
  readonly ages: Uint16Array;
  readonly typeCodes: Uint8Array;

  // Generational free-list index pooling
  private freeIndices: number[];
  private activeCount: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.positionsX = new Float32Array(capacity);
    this.positionsY = new Float32Array(capacity);
    this.velocitiesX = new Float32Array(capacity);
    this.velocitiesY = new Float32Array(capacity);
    this.energies = new Float32Array(capacity);
    this.healths = new Float32Array(capacity);
    this.ages = new Uint16Array(capacity);
    this.typeCodes = new Uint8Array(capacity);

    this.freeIndices = Array.from(
      { length: capacity },
      (_, i) => capacity - 1 - i,
    );
  }

  allocate(): number {
    if (this.freeIndices.length === 0) return -1;
    this.activeCount++;
    return this.freeIndices.pop()!;
  }

  free(index: number): void {
    this.freeIndices.push(index);
    this.activeCount--;
  }
}
```

### B. Craig Reynolds Steering Behaviors

Steering force is calculated as `steering = desiredVelocity - currentVelocity`, clamped to `maxForce`:

- **Separation**: Steer away from crowded neighbors ($force \propto 1 / distance$).
- **Alignment**: Steer towards average heading of flockmates.
- **Cohesion**: Steer towards centroid of nearby flockmates.
- **Pursuit**: Predict future position of prey and seek towards it.
- **Evasion**: Predict future position of predator and flee in opposite direction.
- **Wander**: Add subtle Perlin/Gaussian angular drift for organic idle motion.

### C. Binary Render Stride Streaming

Write directly into the transferable `Float32Array` render buffer using the layout defined in `@chaos-garden/shared`:

```typescript
import {
  packEntityToStride,
  type EntityRenderData,
} from "@chaos-garden/shared";

// Inside Web Worker render pass
packEntityToStride(renderBuffer, entityIndex, {
  idHash: entityIdHash,
  x: storage.positionsX[idx],
  y: storage.positionsY[idx],
  rotation: Math.atan2(storage.velocitiesY[idx], storage.velocitiesX[idx]),
  size: baseSize,
  type: storage.typeCodes[idx],
  healthRatio: storage.healths[idx] / 100,
  energyRatio: storage.energies[idx] / 100,
});
```

Transfer using zero-copy:

```typescript
self.postMessage(
  { type: "RENDER_FRAME", tick, entityCount, buffer: renderBuffer },
  [renderBuffer.buffer],
);
```

### D. Svelte 5 Runes Idioms (`packages/client`)

- Use `$state` for reactive local variables.
- Use `$derived` for computed values (e.g. population percentages, energy bar widths).
- Use `$effect` only for side effects (e.g. DOM canvas mounting, Web Worker event subscriptions).
- Keep UI components decoupled from the 60 FPS loop; bind only to throttled telemetry events (4–10 Hz).

### E. PixiJS v8 Rendering Best Practices

- Initialize `Application` with `preference: 'webgl'` or WebGPU.
- Use `ParticleContainer` or batched mesh geometry for organisms.
- Upload soil nutrient and moisture grids to a dynamic `BaseTexture` / `Texture` with bilinear sampling.
- Render bioluminescent glow via a single scene-level post-processing filter pass.

### F. Web Audio API Synthesis

- Always check `audioContext.state === 'suspended'` and resume on first user interaction.
- Use exponential ramps (`exponentialRampToValueAtTime`) for smooth organic volume changes without clicks/pops.
- Synthesize wind and rain using white/pink noise audio buffers through resonant `BiquadFilterNode` bands.

---

## 3. Strict Coding & Verification Rules

1. **No `any` Types**: Every function argument, return type, and interface must be explicitly typed.
2. **Zero In-Loop Allocations**: No `new Object()`, `new Array()`, array spread `[...items]`, or closures inside per-tick system update methods.
3. **Deterministic Randomness**: In `@chaos-garden/engine`, always pass the Mulberry32 `PRNG` function. Never call `Math.random()` in simulation logic.
4. **Trophic Threshold Ordering**: Always maintain `plant (55) < herbivore (65) < carnivore (75)`.
5. **Windows Path & Shell Safety**: Never use POSIX shell variable expansions in `package.json` scripts. Use cross-platform tools.

---

## 4. Verification Workflow for Coder Tasks

After writing or modifying code:

1. Run package unit tests:
   ```bash
   npm run test -w @chaos-garden/<package>
   ```
2. Run strict type-check:
   ```bash
   npm run type-check -w @chaos-garden/<package>
   ```
3. Run headless invariant checks (when engine is touched):
   ```bash
   npm run sim:run -- --seed=42 --ticks=500 --headless
   ```

---

## 5. Non-Negotiable Git Protocol

- **No Pushing Without Explicit Approval**: You are NEVER allowed to run `git push` without explicit, unambiguous permission from the user. Staging and committing locally is permitted when instructed, but pushing to remote branches is strictly prohibited unless directly authorized by the user.
