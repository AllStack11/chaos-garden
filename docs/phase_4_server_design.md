# Phase 4 Design: Canonical Cloudflare Backend

**Audience:** implementation engineers and architectural reviewers  
**Status:** proposed  
**Scope:** complete the canonical backend on the deployed `workers/` workspace. The roadmap name `packages/server` is logical only; this phase must extend the existing Cloudflare Worker rather than create a second server package.

## 1. Outcome

Phase 4 makes D1 the durable **anchor** for a global garden while browser workers remain independent, deterministic **branches**. It adds a stable versioned HTTP contract, durable chronicle and diagnostic feeds, bounded retention, operational health reporting, and a safe migration path from the current legacy simulation tables.

It does **not** move the 60 TPS simulation to Cloudflare. The scheduled Worker only advances low-frequency canonical macro state. A browser is never allowed to overwrite the anchor merely because it has a newer local branch.

The completed Phase 2 remediation is a dependency, not work to repeat:

- CGS2 checkpoint envelopes are checksum verified before persistence and before engine hydration.
- A singleton lease and monotonic checkpoint write already protect the anchor.
- The client owns its local cache/branch choice and the engine owns checkpoint codec and flight recorder.
- Checkpoint retention is already capped at 500 rows.

## 2. Goals and non-goals

### Goals

1. Make `GET /api/garden` the single bootstrap contract for the client.
2. Make canonical checkpoint commits atomic, lease-authorized, idempotent, and observable.
3. Persist user-visible chronicle events separately from legacy `simulation_events`.
4. Expose bounded garden analytics and redacted diagnostic summaries without an unbounded log store.
5. Preserve the Cloudflare free-tier envelope and support safe online schema migration.

### Non-goals

- Replacing the browser ECS, checkpoint codec, render stride, or IndexedDB branch cache.
- Replicating every 60 FPS frame, entity row, or flight-recorder tick to D1.
- Adding WebSockets, Durable Objects, queues, or a paid Cloudflare product.
- Treating a legacy JSON state row as an exact engine checkpoint.
- Shipping `CURATOR_SECRET`, a service token, raw diagnostic payloads, or another reusable authority credential in the browser.

## 3. Architectural decisions

| Decision | Rationale | Consequence |
| --- | --- | --- |
| Keep the deployed backend in `workers/` | It already owns D1 binding, migration code, checkpoint persistence, and cron. | Update roadmap references from `packages/server` to `workers/` when Phase 4 ships. |
| Checkpoint envelope is authoritative | Only an `EncodedEngineCheckpoint` can establish exact deterministic continuation. | `canonicalState` is presentation metadata/fallback; it cannot be hydrated as an exact world. |
| Lease plus compare-and-swap tick is the write fence | A lease proves current authority; expected canonical tick prevents an old branch from winning after a new checkpoint. | Every checkpoint request includes `leaseId` and `baseCanonicalTick`; server returns `409` for stale base or tick. |
| Chronicle is append-only and bounded | History must be explainable without placing unbounded writes/storage in the hot path. | Validate, deduplicate, and retain a fixed window; do not derive client history by exposing all legacy events. |
| Diagnostics are summaries by default | Full recorder exports may contain high-cardinality data and have no place in a public feed. | Public route returns aggregate health only. A curator-only detail route is deferred until server-side authentication is available. |
| Server auth is an explicit boundary | A shared secret in a browser cannot authenticate a person safely. | Phase 4 requires a verified upstream curator identity / short-lived audience-bound credential before enabling production lease issuance. |

## 4. Ownership and data flow

```text
Browser main thread       Browser Web Worker                   Cloudflare Worker + D1
DOM / Pixi / Svelte  -->  World, PRNG, CGS2 codec      -->    lease validation + atomic persistence
        ^                        |                                  |
        |                        +-- local sandbox / IndexedDB       +-- canonical checkpoint + chronicle
        |                                                               |
        +---------------- GET /api/garden <---------------------------+

Scheduled macro cycle -----------------------------------------------> legacy macro state / summary only
```

| Owner | Owns | Must not own |
| --- | --- | --- |
| Engine Worker | world arrays, PRNG, binary codec, local mutations, flight recorder | HTTP authentication, D1 access, canonical authority |
| Browser main thread | input, visual state, in-memory lease credential, API retries | simulation state mutation, checkpoint decoding, durable credential storage |
| Cloudflare Worker | request validation, authentication verification, leases, D1 transactions, response shaping | 60 FPS stepping or browser render buffers |
| D1 | latest canonical checkpoint, bounded history, summary metadata, lease singleton | per-frame state or long-lived diagnostic logs |

## 5. Public API contract

All successful endpoints return `application/json` and a versioned envelope. Errors are stable enough for the client to branch on `code`, never on human text.

```ts
interface ApiSuccess<T> {
  ok: true;
  apiVersion: 1;
  serverTime: string;
  data: T;
}

interface ApiError {
  ok: false;
  apiVersion: 1;
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'LEASE_CONFLICT' | 'STALE_CANONICAL' |
    'INVALID_CHECKPOINT' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAVAILABLE';
  message: string;
  requestId: string;
}
```

`requestId` is generated at the Worker boundary, logged with server-side failures, and returned on every error. CORS permits only the configured production Pages origin in production; wildcard origin is development-only.

### `GET /api/garden`

Returns the current bootstrap record. It is public and cacheable only for a short edge interval (for example, `Cache-Control: public, max-age=15, stale-while-revalidate=45`). Do not cache a response while mutating it.

```ts
interface GardenBootstrapData {
  canonicalState: CanonicalWorldState;
  checkpoint?: EncodedEngineCheckpoint;
  events: ChronicleEvent[]; // newest first, maximum 50
  exactContinuation: boolean;
}
```

- `exactContinuation` is `true` only when `checkpoint` exists and is internally consistent with the persisted canonical tick.
- When no checkpoint exists, return a documented legacy/primordial fallback state with `exactContinuation: false`; never manufacture a checkpoint.
- Read the checkpoint, state summary, and events from one D1 batch/snapshot boundary so the response cannot combine a newer chronicle with an older canonical tick.

### `POST /api/garden/lease`

Requires a short-lived, server-verified curator credential in `Authorization: Bearer <token>`. The server derives `curatorId`; the client never supplies an authority identity.

```ts
interface LeaseRequest { renewLeaseId?: string; }
interface LeaseResponse { lease: CuratorLease; }
```

- TTL: 120 seconds. A client renews no later than 90 seconds and does not renew while hidden.
- Acquisition and renewal use the existing singleton compare-and-swap row.
- Conflict is `409 LEASE_CONFLICT`; unauthenticated and unauthorized requests are `401`/`403`.
- Development test credentials must be gated by explicit development environment checks. Production must fail closed if auth verification is unavailable.

### `POST /api/garden/checkpoint`

Requires a current lease and curator credential. Maximum request body is enforced before JSON parsing (initial cap: 1 MiB; revise only from measured CGS2 size data).

```ts
interface CanonicalCheckpointSubmission {
  leaseId: string;
  baseCanonicalTick: number;
  checkpoint: EncodedEngineCheckpoint;
  canonicalState: CanonicalWorldState; // summary/presentation fields only
  chronicleEvents?: ChronicleEvent[];  // maximum 10
}

interface CheckpointCommitResult {
  canonicalTick: number;
  checksum: string;
  committedAt: string;
  chronicleEventIds: string[];
}
```

Validation order is intentionally cheap-to-expensive: content type/body limit; schema and numeric bounds; server-derived identity; active lease owner and expiry; `baseCanonicalTick`; checkpoint tick monotonicity; base64 byte length; CGS2 magic/header agreement; SHA-256; canonical summary consistency; chronicle validation. The server must not decode or hydrate arbitrary ECS state.

The final write is one D1 transaction/batch: conditionally insert checkpoint, write canonical summary metadata, insert deduplicated chronicle events, update latest-anchor metadata, then prune. A conflict anywhere produces no partial canonical commit. Duplicate retries with the same tick/checksum return the existing successful result; same tick with a different checksum is a `409` conflict.

### `GET /api/garden/stats`

Public bounded analytics for the HUD:

`GET /api/garden/stats?fromTick=<n>&toTick=<n>&bucket=<n>`

- Clamp span to 30 days and return at most 500 points.
- Bucket server-side with integer ticks, returning population totals and macro weather only.
- Reject invalid ranges rather than silently scanning the full history.
- No entity rows, genome data, or raw checkpoint bytes appear here.

### Diagnostics and health

| Route | Audience | Response | Retention / safety |
| --- | --- | --- | --- |
| `GET /api/health` | public | service version, D1 readiness, canonical tick, active-lease boolean | no curator identity, secret, stack trace, or DB error detail |
| `GET /api/diagnostics/summary` | public | coarse health counters: canonical age, last commit age, checkpoint byte size, API error aggregate | aggregates only; 60-second cache |
| `GET /api/diagnostics/logs` | not in initial production release | — | defer until an authenticated, access-controlled diagnostic store and redaction policy exist |

The browser's LLM diagnostic export continues to come directly from its World-owned flight recorder. Phase 4 does not upload it by default.

## 6. Persistence design

The existing `garden_state`, `entities`, `dead_matter`, and `simulation_events` tables remain legacy macro-simulation data. They are not the exact canonical snapshot store. Existing `engine_checkpoints` and `curator_leases` remain the implementation foundation.

Add the following schema through a forward-only migration (illustrative SQL; exact names must match the migration implementation):

```sql
CREATE TABLE canonical_anchor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checkpoint_id INTEGER,
  canonical_tick INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (checkpoint_id) REFERENCES engine_checkpoints(id)
);

CREATE TABLE chronicle_events (
  id TEXT PRIMARY KEY,
  canonical_tick INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  description TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX idx_chronicle_events_tick ON chronicle_events(canonical_tick DESC);

CREATE TABLE api_metric_buckets (
  bucket_start_ms INTEGER PRIMARY KEY,
  garden_reads INTEGER NOT NULL DEFAULT 0,
  checkpoint_commits INTEGER NOT NULL DEFAULT 0,
  rejected_writes INTEGER NOT NULL DEFAULT 0,
  server_errors INTEGER NOT NULL DEFAULT 0
);
```

`canonical_anchor` is the single read pointer. It avoids assuming that the highest legacy state row and highest binary checkpoint are the same logical anchor. Seed it from the latest valid existing checkpoint during migration; if none exists, initialize `canonical_tick = 0` and return a non-exact bootstrap.

Event limits: description <= 512 UTF-8 bytes, type <= 64 characters, at most 12 tags of <= 48 characters, and at most 10 events per checkpoint. Canonicalize event fields before hashing `checksum` to make retries idempotent. Retain the newest 10,000 chronicle rows or 180 days, whichever is lower. `api_metric_buckets` stores hourly aggregates for 30 days, then is pruned.

### Retention and budget

| Data | Limit | Write cadence | Purpose |
| --- | ---: | ---: | --- |
| CGS2 checkpoints | 500 rows | explicit curator cadence, never render/tick cadence | exact anchor/recovery |
| Chronicle events | 10,000 / 180 days | <= 10 per checkpoint | human narrative |
| Analytics summaries | 30 days | macro cron/checkpoint summaries | dashboard |
| API metrics | hourly, 30 days | aggregate only | health/diagnostics |

Phase 4 acceptance must measure the 2,000-entity checkpoint and enforce a conservative payload ceiling. With a 1 MiB initial body cap, 300 checkpoint writes/day, and 500 retained snapshots, checkpoint payload storage is at most roughly 500 MiB before overhead; the actual design target remains below 50 MiB. If measured payloads cannot meet that target, stop and choose a codec/retention change before production rollout—do not raise limits silently.

## 7. Migration and rollout

1. Add shared v1 API request/response types and contract tests without changing endpoint behavior.
2. Add an idempotent D1 migration creating `canonical_anchor`, chronicle, and metric tables; initialize the anchor from the newest validated checkpoint.
3. Ship read-only `GET /api/garden` v1 and compare its response with current client bootstrap in staging.
4. Add production credential verification and fail-closed lease issuance. This is a release gate, not a TODO hidden behind a feature flag.
5. Deploy atomic checkpoint + chronicle commit behind a Worker configuration flag; run concurrent lease/stale-base probes.
6. Enable client v1 bootstrap and checkpoint use. On `409`, refresh anchor and present local-branch resolution; never blind-retry.
7. Enable stats and diagnostic summary. Observe write counts, payload sizes, D1 errors, and cache behavior for one retention window.
8. Deprecate duplicate `/api/garden/curator-lease` alias after clients have migrated to `/api/garden/lease`. Keep an explicit end-of-life date and telemetry before removal.

Rollback is additive: disable canonical writes/lease issuance with configuration, continue serving the last valid anchor, and leave legacy reads available. Never roll back by deleting checkpoints or mutating existing envelope bytes.

## 8. Security, reliability, and performance invariants

- All canonical writes require verified identity, an unexpired lease, matching lease owner, and a non-stale base canonical tick.
- The server derives curator identity from the verified credential; request-body `curatorId` is ignored/rejected.
- Checkpoint and chronicle writes are atomic and idempotent under a network retry.
- The Worker validates bounds before allocating a decoded byte array. D1 query parameters are bound, never string-interpolated.
- Production errors expose a code and request ID only; detailed causes are logged server-side with credential and payload redaction.
- Cloudflare cron never writes a browser-engine checkpoint and never races a curator checkpoint by changing `canonical_anchor` without the same monotonic fence.
- Cache keys include API version and do not cache lease or checkpoint responses.
- No backend work changes trophic thresholds, uses `Math.random()` in deterministic engine paths, moves simulation to the main thread, or changes client hidden-tab behavior.

## 9. Implementation checklist

### Contracts and routing

- [ ] Add versioned shared API envelope, typed errors, checkpoint submission, stats, health, and diagnostics-summary contracts.
- [ ] Make `GET /api/garden` return one documented bootstrap shape and bounded chronicle data.
- [ ] Implement `POST /api/garden/lease`; retain the old lease alias only through the announced migration period.
- [ ] Require `baseCanonicalTick`; return typed `409 STALE_CANONICAL` without writing on mismatch.
- [ ] Bound request body and validate content type, JSON schema, all numeric values, strings, arrays, and base64 before persistence.
- [ ] Add idempotent same-tick/same-checksum retry behavior and conflict behavior for same tick/different checksum.

### D1 and retention

- [ ] Create forward-only, idempotent migration and migration tests for fresh and already-populated databases.
- [ ] Seed `canonical_anchor` from the newest valid checkpoint without changing checkpoint bytes.
- [ ] Commit anchor, checkpoint, and chronicle in one conditional D1 batch/transaction.
- [ ] Add indexed bounded chronicle queries and deterministic event checksum/deduplication.
- [ ] Prune checkpoints, chronicle rows, analytics, and metrics only after the successful commit.
- [ ] Measure encoded checkpoint size at 2,000 entities and document values against the 50 MiB / 500-record budget.

### Identity, security, and operations

- [ ] Replace production shared-secret browser authorization with server-verified short-lived curator credentials.
- [ ] Keep browser credentials memory-only; verify production build contains no secret.
- [ ] Restrict production CORS to the Pages origin and set explicit cache headers per route.
- [ ] Add request IDs, redacted structured logs, and public safe health/diagnostics summaries.
- [ ] Add a configuration kill switch for canonical writes; it must not affect reads or local branches.
- [ ] Publish a runbook for migration, write-disable rollback, stale-checkpoint recovery, and D1 unavailability.

### Client integration

- [ ] Bootstrap only from the v1 response; mark legacy/primordial fallbacks as non-exact.
- [ ] Cache only successful, checksum-valid canonical envelopes separately from local branches.
- [ ] Renew leases before expiry only while visible; treat `401`, `403`, and `409` as terminal for the attempt.
- [ ] On stale canonical response, fetch a fresh anchor and ask the user how to resolve the local branch; do not resubmit automatically.

## 10. Verification and architect acceptance

### Automated gates

- [ ] Fresh and upgraded D1 schemas migrate successfully and preserve the last valid checkpoint.
- [ ] Two simultaneous lease acquisitions yield exactly one holder; renewal cannot steal another curator's active lease.
- [ ] Invalid/expired lease, owner mismatch, stale base tick, non-monotonic checkpoint tick, malformed base64, byte mismatch, bad SHA-256, bad CGS2 header, and oversized body leave D1 unchanged.
- [ ] Retried identical checkpoint is successful exactly once; competing same-tick/different-checksum commit is rejected.
- [ ] Checkpoint, anchor pointer, and chronicle events are all present after success or all absent after injected failure.
- [ ] Chronicle pagination/order, validation, deduplication, and retention are deterministic and bounded.
- [ ] Stats range limits prevent unbounded reads; health and diagnostics never include secrets, payload bytes, curator ID, or stack trace.
- [ ] Offline client uses its validated cache; a failed server response never overwrites a valid local branch.
- [ ] `npm run type-check:all`, `npm run test:all`, and `npm run audit:sim` pass.

### Architectural clearance checklist

- [ ] **Zero allocation:** no Phase 4 change allocates in the engine/render 60 FPS path; server allocations are bounded by request limits.
- [ ] **Main-thread decoupling:** simulation, codec, and recorder remain Web Worker-owned.
- [ ] **Consensus safety:** anchor commits are verified-identity, lease-protected, atomic, idempotent, and stale-base fenced.
- [ ] **Trophic order:** reproduction threshold ordering remains `plant < herbivore < carnivore`.
- [ ] **Determinism:** no unseeded randomness enters engine state; only validated CGS2 envelopes claim exact continuation.
- [ ] **Battery/thermal:** canonical retries and lease renewal respect visibility; client retains 5 TPS hidden behavior.
- [ ] **Offline resilience and cost:** valid local fallback remains intact; bounded D1 rows/writes meet the measured free-tier budget.

## 11. Open release decision

The only material external dependency is the production curator authentication boundary. Before implementation begins, the product owner must select the identity issuer and verification method (for example, an existing application session or an approved Cloudflare-compatible identity provider). Until it exists, Phase 4 may ship read APIs, migrations, and diagnostic summaries, but production lease issuance and checkpoint writes must remain disabled/fail closed.
