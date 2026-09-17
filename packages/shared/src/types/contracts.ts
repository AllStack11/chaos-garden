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

