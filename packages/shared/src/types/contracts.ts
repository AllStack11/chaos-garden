/**
 * Chaos Garden - Client-Server API Contracts & Consensus Types
 * 
 * Formal network boundaries between the Cloudflare Worker backend
 * and the client-side Svelte/PixiJS runtime.
 */

import type { Entity, DeadMatter, PopulationSummary } from './taxonomy.js';
import type { SoilGridState } from './soil.js';
import type { AtmosphericState } from './weather.js';

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
 */
export interface CheckpointSubmission {
  leaseId: string;
  tick: number;
  snapshot: CanonicalWorldState;
  chronicleEvents: ChronicleEvent[];
}

/**
 * Historic milestone or evolutionary breakthrough recorded into the global chronicle.
 */
export interface ChronicleEvent {
  id: string;
  tick: number;
  timestamp: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  tags: string[];
}

/**
 * Response for GET /api/health
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  tick: number;
  timestamp: string;
  version: string;
  databaseReady: boolean;
  activeCuratorLease: boolean;
}

