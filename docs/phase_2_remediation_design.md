# Phase 2 Remediation Design: Deterministic Engine Integration

**Audience:** Coder / Implementation Engineer  
**Status:** Approved design handoff  
**Scope:** Correct the Phase 2 engine contracts that prevent it from satisfying the published zero-allocation, Anchor & Branch, replay, and observability guarantees.

## Outcome

After this work, the simulation has a bounded, allocation-free worker-to-renderer path; interaction rules use current, exact spatial relationships; snapshots preserve replay and lineage; and a versioned engine snapshot can be persisted and restored through the canonical Worker boundary.

This is a remediation of Phase 2 and its direct client/server integration seams. Do not redesign the biological model, introduce a framework dependency into `@chaos-garden/engine`, or change the 8-float render stride.

## Architectural decisions

| Concern | Decision |
| --- | --- |
| Render backpressure | Use a fixed pool of **three** render buffers. If none is available, skip publishing that visual frame; simulation stepping continues. Allocation after construction is forbidden. |
| Spatial interaction | Rebuild the hash after physics, immediately before metabolism. The grid returns candidates only; metabolism must apply exact toroidal radial checks before an interaction. |
| Candidate overflow | Do not silently truncate decisions at 32 candidates. Scan bucket chains directly through a non-allocating query API, selecting the nearest valid target deterministically. |
| Identity and ancestry | Keep immutable, generation-qualified entity identities. Store `parentId`, not a reusable `parentIndex`, for historical lineage. Render IDs remain the existing 24-bit `idHash`. |
| Snapshot transport | Persist a versioned encoded engine payload separately from presentation metadata. Validate version, capacities, typed-column lengths, and checksum before hydration. |
| Diagnostics | The World owns and records its fixed-capacity flight recorder after each tick. Allocation is permitted only when a caller explicitly exports diagnostics. |

## Target flow

```text
World.step()
  soil diffusion -> spatial rebuild -> steering -> physics
  -> spatial rebuild -> metabolism -> genetics -> mortality
  -> render packing -> flight-recorder write

Worker publish
  acquire available render buffer
    available: pack -> transfer -> renderer returns buffer -> release
    unavailable: skip render message (no allocation, no simulation stall)

Canonical checkpoint
  World export encoded EngineSnapshot -> POST checkpoint (lease verified)
  -> D1 checkpoint record -> GET garden canonical snapshot
  -> validate/decode -> World hydrate -> deterministic continuation
```

## 1. Fixed render-buffer lifecycle

### Required API

Replace the implicit two-buffer swap with explicit ownership state. A small `RenderBufferPool` inside the engine is sufficient.

```ts
interface TransferableRenderFrame {
  tick: number;
  entityCount: number;
  buffer: Float32Array;
}

getTransferableRenderFrame(): TransferableRenderFrame | null;
returnRenderBuffer(buffer: Float32Array): boolean;
```

- Construct exactly three `Float32Array(maxEntities * 8)` buffers.
- A buffer is either `available`, `writing`, or `inFlight`.
- `getTransferableRenderFrame()` returns `null` if no buffer is available. It must not allocate, replace, or detach a buffer itself.
- The worker transfers the returned buffer and marks it in flight. `RETURN_RENDER_BUFFER` restores that same buffer to available.
- Treat an unknown, duplicate, wrong-length, or already available returned buffer as `false`; do not admit it to the pool.
- The client must tolerate a skipped frame. The renderer simply retains its last completed frame.

The existing `RenderPackingSystem.pack()` must never call `allocateRenderBuffer()` outside its constructor. Keep the stride at `[ID_HASH, X, Y, ROTATION, SIZE, TYPE, HEALTH_RATIO, ENERGY_RATIO]`.

### Tests

- Transfer all three buffers without returning any; the fourth call returns `null` and heap allocation count remains unchanged.
- Return one detached buffer and verify it is reused, not replaced.
- Simulate delayed UI returns for at least 1,000 frames; assert bounded buffer count and no frame-buffer allocation.
- Verify a skipped render frame does not change world state, PRNG state, or tick count.

## 2. Exact and current spatial interactions

The pre-physics grid is valid for steering but invalid for feeding after integration. Rebuild it after `PhysicsSystem.update()` and before `MetabolismSystem.update()`.

Add an allocation-free nearest-target query that accepts the storage arrays and a predicate encoded as an entity type (rather than a closure). It must:

1. Walk every relevant bucket linked-list entry; it must not use the 32-entry `queryBuffer` for authoritative biology.
2. Compute a toroidal delta and reject candidates beyond the interaction radius.
3. Return the nearest candidate, breaking equal-distance ties by lower slot index.
4. Return `-1` when no valid target exists.

Use it for herbivore-to-plant grazing and carnivore-to-herbivore predation. The interaction radius should be an explicit named constant or configuration field; preserve the existing intended radius (`consumer size + 16` for grazing, `consumer size + 14` for predation) unless product design changes it.

Keep `queryBuffer` only for bounded presentation/diagnostic queries. Correctness must not depend on the number 32.

### Tests

- A target in the same bucket but outside the radial interaction distance is not consumed.
- Across a toroidal boundary, a target within the interaction radius is selected.
- With more than 32 candidates, the nearest valid target is selected.
- A consumer that moves during physics can interact with entities near its post-physics position, not its prior position.
- Identical seed and commands produce byte-identical state after the new rebuild.

## 3. Durable identity and lineage

`parentIndices` cannot represent persistent ancestry because slots are intentionally recycled. Add compact parallel storage for immutable identity:

```ts
// Suggested representation; exact layout may vary.
readonly entityIds: Uint32Array;
readonly parentEntityIds: Uint32Array; // 0 = origin
```

- Generate IDs deterministically from a monotonically incrementing, snapshotted counter. Do not derive IDs only from `parentHash + tick + slot` and do not use `Math.random()`.
- Retain `idHashes` solely as the 24-bit render/selection field. Collision handling must be explicit if it is used for selection; the preferred fix is to include stable `entityId` in selection messages while keeping the render stride unchanged.
- On birth, write the parent’s immutable ID. On death, never alter descendants’ parent identity.
- Snapshot and restore both counters and IDs. Canonical export maps `parentEntityId === 0` to `origin`.

### Tests

- Kill a parent, reuse its slot, then export: the descendant still names the original parent ID.
- Export/hydrate/step preserves every entity and parent ID exactly.
- A seeded run never produces duplicate stable IDs, including after pool reuse.

## 4. Canonical checkpoint contract

### Server contract

Add the lease-protected `POST /api/garden/checkpoint` endpoint described in the architecture. It accepts a checkpoint envelope, verifies the active curator lease and monotonic tick, validates the snapshot header before decoding, and writes one checkpoint atomically.

Extend the persistence schema with a dedicated checkpoint payload rather than expanding the legacy `garden_state` statistics row:

```sql
CREATE TABLE engine_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tick INTEGER NOT NULL UNIQUE,
  engine_version INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  payload BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The garden read response must expose one stable shape consumed by the client:

```ts
interface GardenBootstrapResponse {
  canonicalState: CanonicalWorldState;
  checkpoint?: EncodedEngineCheckpoint;
  events: ChronicleEvent[];
}
```

Do not make the client infer a snapshot from the current `{ gardenState, entities, deadMatter }` response. During migration, the Worker may generate a high-level fallback, but the engine must only claim exact continuation after an encoded checkpoint validates.

### Encoding and integrity

- Define `EncodedEngineCheckpoint` in `@chaos-garden/shared`: `version`, `tick`, `seed`, `byteLength`, `checksum`, and `payload`.
- Encode typed arrays as a deterministic binary layout, not JSON arrays. Use a documented field order and little-endian numeric format.
- Hash exactly the payload bytes with Web Crypto SHA-256 at the Worker/client boundary. Do not use `snap-${tick}-${count}` as a checksum.
- Reject unsupported versions, a capacity mismatch, invalid dense/free counts, column length mismatch, malformed IDs, or a checksum mismatch before mutating a `World`.
- The snapshot must include the PRNG state, entity-ID counter, pool state, all component columns, and soil buffers.
- Retain at most 500 checkpoints using a transactional pruning query. Snapshot writes must remain on the curator checkpoint cadence, not the 60 TPS simulation cadence.

### Tests

- Client boot uses a valid Worker checkpoint and continues bit-identically for 1,000 ticks.
- Corrupted byte, invalid checksum, wrong version, and mismatched capacity are rejected without partially changing the world.
- A request without a valid lease cannot write a checkpoint.
- A checkpoint payload stays within the agreed storage budget at 2,000 entities; record the measured encoded and compressed sizes in the test output.

## 5. Flight recorder ownership

- Construct `FlightRecorder(300)` in `World` and call `recordTick` after packing, including a precomputed scalar census path so the steady-state write does not allocate a `PopulationSummary` object.
- Make anomaly events bounded without `shift()` or object creation in the tick path. Use preallocated event columns/ring slots; materialize strings and objects only during explicit export.
- `REQUEST_DIAGNOSTICS` reads the World-owned recorder and returns an exported diagnostic payload.
- The CLI must use the World recorder rather than constructing a parallel one.

### Tests

- After 301 steps, recorder history contains the most recent 300 ticks in chronological order.
- Recorder integration does not change deterministic engine results.
- Heap/allocation verification includes recorder writes and transfer-buffer exhaustion behavior.

## Implementation sequence

1. Add tests that reproduce each render, spatial, lineage, and hydration defect. These tests should fail first.
2. Implement the render pool and worker/UI null-frame handling.
3. Implement exact nearest-target spatial queries and the post-physics rebuild.
4. Add durable identity/lineage storage and snapshot migration.
5. Define the shared encoded-checkpoint contract, then add Worker lease/persistence/read endpoints and client bootstrap adaptation.
6. Integrate the flight recorder into `World`.
7. Replace weak invariant tests with end-to-end tests and run the complete workspace verification.

Keep commits independently reviewable by concern. Do not mix visual restyling, biological tuning, or unrelated worker refactoring into this remediation.

## Definition of done

- No allocations occur in steady-state `World.step`, recorder writes, render packing, or delayed render-buffer transfer cycles.
- Render publication is bounded and may drop frames under backpressure without simulation drift.
- Feeding and predation are exact-radius, toroidal, post-physics decisions with deterministic tie-breaking.
- Parentage survives death, slot reuse, export, hydration, and continuation.
- A valid canonical checkpoint is lease-authorized, integrity-checked, compact, and replayable; invalid input leaves the local world intact.
- The seven architecture rubrics pass, with explicit tests for the former failure modes.
- Run `npm run test:all`, `npm run type-check:all`, `npm run audit:sim`, and the new checkpoint size/replay test before requesting re-audit.

## Non-goals

- Changing the 8-float renderer stride or adding entity metadata to it.
- Moving simulation work onto the main thread.
- Altering trophic thresholds or the current ecosystem balance, except where a validation guard is necessary.
- Replacing the ECS/SoA model or adding a runtime dependency to the engine.
