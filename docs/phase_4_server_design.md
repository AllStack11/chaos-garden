# Phase 4: Worker-owned canonical garden

**Owner:** System Architect
**Status:** Implemented design for PR #6
**Supersedes:** the earlier browser-curator/Anchor-and-Branch Phase 4 proposal.

## Outcome

The scheduled Cloudflare Worker is the sole authority that advances and persists the garden. No browser frontend is currently deployed. The replacement observer will be public and read-only, with no sign-in, browser curator, browser lease acquisition, or browser checkpoint submission.

```text
Cloudflare Cron (every 15 min)
  -> hydrate anchored engine checkpoint
  -> run deterministic tick batch
  -> atomically commit checkpoint + canonical state + anchor
  -> prune records outside the latest 500 snapshots

Future offline-capable observer
  -> GET /api/garden
  -> display epoch, tick, population summary
```

## Canonical authority and concurrency

`canonical_anchor` is the only public read pointer. Each scheduled execution:

1. Reads the current anchor and acquires or renews the internal Worker lease.
2. Hydrates the referenced checkpoint, or seeds the primordial ecosystem when the anchor is empty.
3. Advances 900 deterministic engine ticks.
4. Commits the checkpoint, canonical state, and anchor in one D1 batch guarded by the expected anchor tick and the internal lease.

The compare-and-swap fence rejects an overlapping execution that computed from an older anchor. Public HTTP routes do not expose mutation methods.

## Persistence

| Table                    | Purpose                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `engine_checkpoints`     | Exact binary continuation checkpoint.                            |
| `canonical_world_states` | Readable canonical state associated with a checkpoint.           |
| `canonical_anchor`       | Singleton pointer to the current canonical checkpoint.           |
| `curator_leases`         | Singleton internal overlap guard for scheduled Worker execution. |
| `chronicle_events`       | Read-only bounded event stream.                                  |

`canonical_world_states` does not embed the binary checkpoint; `engine_checkpoints` is the single durable copy of checkpoint bytes.

## Canonical Cutover & Schema Migration

The canonical D1 database uses schema version `3.0.0`, initialized via `workers/canonical-cutover.sql` (or `migrateToCanonicalSchema` in code). The cutover is version-aware and fully idempotent:

1. **Legacy Pre-v3 Cleansing**: If `schema_version` is not `'3.0.0'`, the migration resets the canonical anchor and lease singletons, and cleanses legacy browser-authored checkpoints and world states. This prevents legacy checkpoint rows from colliding with new Worker-authored ticks (e.g. tick 900).
2. **Post-v3 Preservation**: When executed on an already-upgraded v3 database, all existing canonical checkpoints and anchor records are preserved without modification.
3. **Legacy Table Removal**: Drops retired persistence tables (`simulation_events`, `entities`, `dead_matter`, `garden_state`, `simulation_control`, `api_metric_buckets`).
4. **Parity Enforcement**: `workers/tests/unit/db/cutover-parity.test.ts` guarantees SQL statement parity between the raw SQL cutover script and TypeScript migration string.

## Public API

| Route             | Behavior                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/garden` | Returns the anchored canonical state, exact-continuation checkpoint, and recent chronicle events. Returns a non-exact response when the anchor is incomplete or mismatched. |
| `GET /api/health` | Returns health status, canonical tick, schema version, and whether the internal lease is active.                                                                            |

All public API routes are read-only.

## Retention and accepted storage budget

The commit batch retains the latest **500** checkpoints and deletes older, non-anchored checkpoint rows. Deleting a checkpoint cascades to its canonical-state row.

At one snapshot every 15 minutes, 500 records cover about **5.2 days**. At the measured default 2,000-slot engine capacity:

| Component              | Approximate payload per snapshot |
| ---------------------- | -------------------------------: |
| Binary checkpoint BLOB |                           342 KB |
| Canonical-state JSON   |                           661 KB |
| Total                  |                           1.0 MB |
| 500-snapshot window    |                           500 MB |

The accepted production envelope is approximately **500 MB of payload data plus D1/SQLite overhead**, below the 5 GB D1 storage allowance. This replaces the former <50 MB target. The Worker must retain the 500-row cap and monitor actual database size after release.

## Invariants

- Canonical writes originate only from the scheduled Worker.
- Each commit is lease-protected and anchor-CAS fenced.
- Checkpoints are deterministic and integrity-validated before hydration.
- The Worker never uses unseeded randomness in engine state.
- Trophic reproduction ordering remains `plant < herbivore < carnivore`.
- Retention removes only checkpoints outside the latest 500 and never the current anchor.

## Verification

```bash
npm run type-check:all
npm run test:all
npm run sim:run -- --seed=42 --ticks=500 --headless
```

Worker tests must cover exact bootstrap, anchor-CAS conflicts, retention, and failure atomicity.
