/**
 * Worker-Specific Types
 * 
 * These types define the Cloudflare Workers environment bindings
 * and execution context for our simulation engine.
 */

import type {
  GardenState,
  Entity,
  ApplicationLog,
  SimulationEvent,
  GardenResponse,
  PopulationSummary
} from '@chaos-garden/shared';

// ==========================================
// Environment Bindings
// ==========================================

/**
 * Cloudflare Worker environment bindings.
 * These are injected by the runtime and available via the env parameter.
 */
export interface Env {
  // D1 Database binding (defined in wrangler.toml)
  DB: D1Database;
  
  // Environment variables
  CORS_ORIGIN: string;
}

// ==========================================
// D1 Database Types
// ==========================================

/**
 * D1Database interface (provided by Cloudflare Workers runtime)
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<D1ExecResult>;
}

/**
 * D1 Prepared Statement interface
 */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run<T>(): Promise<D1Result<T>>;
  all<T>(): Promise<D1Result<T>>;
  raw<T>(): Promise<T[]>;
}

/**
 * D1 Query Result
 */
export interface D1Result<T> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    last_row_id: number;
    changes: number;
  };
}

/**
 * D1 Exec Result
 */
export interface D1ExecResult {
  count: number;
  duration: number;
}

// ==========================================
// Execution Context Types
// ==========================================

/**
 * Scheduled event for cron triggers.
 * Passed to the scheduled handler when cron executes.
 */
export interface ScheduledEvent {
  type: 'scheduled';
  scheduledTime: number;
  cron: string;
}

/**
 * Execution context for fetch handlers.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// ==========================================
// API Handler Types
// ==========================================

/**
 * Route handler function type for API endpoints.
 */
export type RouteHandler = (
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
) => Promise<Response>;

// ==========================================
// Simulation Result Types
// ==========================================

/**
 * Result of processing a single entity during a tick.
 */
export interface EntityProcessResult {
  entity: Entity;
  offspring: Entity[];
  consumed: string[];  // IDs of entities consumed (e.g., plants eaten)
  died: boolean;
}

/**
 * Aggregated results from processing all entities in a tick.
 */
export interface TickProcessResult {
  entities: Entity[];
  births: Entity[];
  deaths: string[];
  consumed: string[];
  events: SimulationEvent[];
}

// Re-export shared types for convenience
export type {
  GardenState,
  Entity,
  ApplicationLog,
  SimulationEvent,
  GardenResponse,
  PopulationSummary
};