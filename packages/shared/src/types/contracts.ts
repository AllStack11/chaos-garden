/**
 * Chaos Garden - Client-Server API Contracts & Consensus Types
 *
 * Formal network boundaries between the Cloudflare Worker backend
 * and the client-side Svelte/PixiJS runtime.
 */

import type { Entity, DeadMatter, PopulationSummary } from "./taxonomy.js";
import type { SoilGridState } from "./soil.js";
import type { AtmosphericState } from "./weather.js";

/**
 * Exact, zero-loss snapshot of EntityPool state.
 */
export interface EntityPoolSnapshot {
  capacity: number;
  denseCount: number;
  freeCount: number;
  generations: number[];
  freeList: number[];
  denseEntities: number[];
  sparseIndices: number[];
}

/**
 * Transferable zero-copy render frame passed to Web Worker or render thread.
 */
export interface TransferableRenderFrame {
  tick: number;
  entityCount: number;
  buffer: Float32Array;
}

/**
 * Exact, zero-loss snapshot of all ComponentStorage typed array columns.
 */
export interface ComponentStorageSnapshot {
  capacity: number;
  positionsX: number[];
  positionsY: number[];
  velocitiesX: number[];
  velocitiesY: number[];
  accelerationsX: number[];
  accelerationsY: number[];
  rotations: number[];
  energies: number[];
  healths: number[];
  ages: number[];
  maxLifespans: number[];
  typeCodes: number[];
  sizes: number[];
  pigments: number[];
  generations: number[];
  metabolismRates: number[];
  reproductionThresholds: number[];
  mutationRates: number[];
  photosynthesisRates: number[];
  seedDispersionRadii: number[];
  moistureAffinities: number[];
  maxSpeeds: number[];
  maxForces: number[];
  perceptionRadii: number[];
  fleeRadii: number[];
  flockingWeights: number[];
  packWeights: number[];
  decompositionRates: number[];
  idHashes: number[];
  parentIndices: number[];
  bornAtTicks: number[];
  entityIds?: number[];
  parentEntityIds?: number[];
}

/**
 * Versioned, bit-exact engine state snapshot for deterministic simulation continuation.
 */
export interface EngineSnapshot {
  version: number;
  tick: number;
  seed: number;
  prngState: number;
  pool: EntityPoolSnapshot;
  storage: ComponentStorageSnapshot;
  soil: SoilGridState;
}

/**
 * Compact, deterministic binary-encoded checkpoint with SHA-256 integrity hash.
 */
export interface EncodedEngineCheckpoint {
  version: number;
  tick: number;
  seed: number;
  byteLength: number;
  checksum: string; // Hex-encoded SHA-256 hash of payload bytes
  payload: string; // Base64-encoded binary payload
}

/**
 * Complete, self-contained snapshot of the canonical world state.
 * Stored in Cloudflare D1 and loaded by clients on boot.
 */
export interface CanonicalWorldState {
  id: number;
  tick: number;
  epoch: number;
  timestamp: string;
  seed: number;
  atmospheric: AtmosphericState;
  populationSummary: PopulationSummary;
  entities: Entity[];
  deadMatter: DeadMatter[];
  soil: SoilGridState;
  checksum: string;
  version?: number;
  prngState?: number;
  engineSnapshot?: EngineSnapshot;
  checkpoint?: EncodedEngineCheckpoint;
}

/**
 * Response format for GET /api/garden
 */
export interface GardenSnapshotResponse {
  success: boolean;
  data: CanonicalWorldState;
  serverTime: string;
  error?: string;
}

/**
 * Canonical garden bootstrap response consumed by client.
 * Standard Phase 4 versioned API success envelope (v1).
 */
export interface ApiSuccess<T> {
  ok: true;
  apiVersion: 1;
  serverTime: string;
  data: T;
  // Backward compatibility fields
  success?: true;
  timestamp?: string;
}

/**
 * Standard Phase 4 stable API error codes.
 */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "LEASE_CONFLICT"
  | "STALE_CANONICAL"
  | "INVALID_CHECKPOINT"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

/**
 * Standard Phase 4 versioned API error envelope (v1).
 */
export interface ApiError {
  ok: false;
  apiVersion: 1;
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: unknown;
  // Backward compatibility fields
  success?: false;
  error?: string;
  timestamp?: string;
}

/**
 * Canonical garden bootstrap response data consumed by client.
 */
export interface GardenBootstrapData {
  canonicalState: CanonicalWorldState;
  checkpoint?: EncodedEngineCheckpoint;
  events: ChronicleEvent[];
  exactContinuation: boolean;
}

/**
 * Canonical garden bootstrap response consumed by client (legacy & v1 compatible).
 */
export interface GardenBootstrapResponse {
  canonicalState: CanonicalWorldState;
  checkpoint?: EncodedEngineCheckpoint;
  events: ChronicleEvent[];
  exactContinuation?: boolean;
}

/**
 * Temporary authority lease granted to an active viewer, permitting
 * checkpoint commits back to Cloudflare D1.
 */
export interface CuratorLease {
  leaseId: string;
  curatorId: string;
  grantedAtMs: number;
  expiresAtMs: number;
  authorizedTick: number;
}

/**
 * Payload sent to POST /api/garden/checkpoint by an authorized curator.
 * Request payload for POST /api/garden/lease.
 */
export interface LeaseRequest {
  curatorId?: string;
  renewLeaseId?: string;
  authorizedTick?: number;
  ttlMs?: number;
}

/**
 * Response payload for POST /api/garden/lease.
 */
export interface LeaseResponse {
  lease: CuratorLease;
}

/**
 * Phase 4 Canonical Checkpoint Submission payload sent to POST /api/garden/checkpoint.
 */
export interface CanonicalCheckpointSubmission {
  leaseId: string;
  baseCanonicalTick: number;
  checkpoint: EncodedEngineCheckpoint;
  canonicalState?: CanonicalWorldState;
  chronicleEvents?: ChronicleEvent[];
}

/**
 * Backward-compatible payload sent to POST /api/garden/checkpoint by an authorized curator.
 */
export interface CheckpointSubmission {
  leaseId: string;
  curatorId?: string;
  tick: number;
  baseCanonicalTick?: number;
  checkpoint: EncodedEngineCheckpoint;
  canonicalState?: CanonicalWorldState;
  snapshot?: CanonicalWorldState;
  chronicleEvents?: ChronicleEvent[];
}

/**
 * Result returned upon successful atomic commit of a canonical checkpoint.
 */
export interface CheckpointCommitResult {
  committed: boolean;
  tick?: number;
  canonicalTick: number;
  checksum: string;
  committedAt: string;
  chronicleEventIds: string[];
}

/**
 * Database record representing the singleton canonical anchor (id = 1).
 */
export interface CanonicalAnchorRecord {
  id: number;
  checkpointId: number | null;
  canonicalTick: number;
  checksum: string | null;
  updatedAtMs: number;
}

/**
 * Historic milestone or evolutionary breakthrough recorded into the global chronicle.
 */
export interface ChronicleEvent {
  id: string;
  tick: number;
  timestamp: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  tags: string[];
}

/**
 * Response for GET /api/health
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  tick: number;
  timestamp: string;
  version: string;
  databaseReady: boolean;
  activeCuratorLease: boolean;
  gardenState?: {
    tick: number;
    timestamp: string;
  } | null;
  config?: {
    tickIntervalMinutes: number;
  };
  canonicalTick?: number;
  schemaVersion?: string;
}

/**
 * Public bounded operational diagnostics summary (GET /api/diagnostics/summary).
 */
export interface DiagnosticsSummary {
  schemaVersion: string;
  canonicalAgeMs: number;
  lastCommitAgeMs: number | null;
  checkpointByteSize: number;
  canonicalTick: number;
  activeCuratorLease: boolean;
  metrics: {
    gardenReads: number;
    checkpointCommits: number;
    rejectedWrites: number;
    serverErrors: number;
  };
}

/**
 * Query parameters for GET /api/garden/stats
 */
export interface GardenStatsQuery {
  fromTick?: number;
  toTick?: number;
  bucket?: number;
  windowTicks?: number;
}
