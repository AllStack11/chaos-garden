/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { 
  GardenState as SharedGardenState, 
  Entity as SharedEntity, 
  SimulationEvent as SharedSimulationEvent,
  PopulationSummary as SharedPopulationSummary,
  HealthStatus as SharedHealthStatus,
  GardenStatsResponse as SharedGardenStatsResponse,
  GardenStatsPoint as SharedGardenStatsPoint,
  GardenStatsAggregate as SharedGardenStatsAggregate,
  GardenInsight as SharedGardenInsight,
  EventTypeBreakdown as SharedEventTypeBreakdown,
  EventSeverityBreakdown as SharedEventSeverityBreakdown,
  GardenEntityVitals as SharedGardenEntityVitals
} from '../../shared/types';

/**
 * Environment variables available in the frontend.
 * These are prefixed with PUBLIC_ and are exposed to the client.
 */
interface ImportMetaEnv {
  /**
   * The URL of the Chaos Garden API.
   * In development: http://localhost:8787
   * In production: https://chaos-garden-api.YOUR_SUBDOMAIN.workers.dev
   */
  readonly PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Re-export shared types for use in frontend components
export type GardenState = SharedGardenState;
export type Entity = SharedEntity;
export type SimulationEvent = SharedSimulationEvent;
export type PopulationSummary = SharedPopulationSummary;
export type HealthStatus = SharedHealthStatus;
export type GardenStatsResponse = SharedGardenStatsResponse;
export type GardenStatsPoint = SharedGardenStatsPoint;
export type GardenStatsAggregate = SharedGardenStatsAggregate;
export type GardenInsight = SharedGardenInsight;
export type EventTypeBreakdown = SharedEventTypeBreakdown;
export type EventSeverityBreakdown = SharedEventSeverityBreakdown;
export type GardenEntityVitals = SharedGardenEntityVitals;

export interface GardenResponse {
  success: boolean;
  data: {
    gardenState: GardenState;
    entities: Entity[];
    events: SimulationEvent[];
    timestamp: string;
  };
  error?: string;
  details?: unknown;
}

export interface TickResponse {
  success: boolean;
  data: {
    message: string;
    tickNumber: number;
    duration: number;
    newEntities: number;
    deaths: number;
    populations: PopulationSummary;
    timestamp: string;
  };
  error?: string;
  details?: unknown;
}

export interface InterventionRequest {
  type: string;
  params?: Record<string, unknown>;
}

export interface InterventionResponse {
  success: boolean;
  data: {
    message: string;
    type: string;
    params?: Record<string, unknown>;
    timestamp: string;
  };
  error?: string;
  details?: unknown;
}
