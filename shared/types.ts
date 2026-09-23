/**
 * Chaos Garden - Shared TypeScript Types
 * 
 * These types define the fundamental structures of our living digital ecosystem.
 * They flow like nutrients through the entire system, ensuring type safety
 * across frontend, backend, and database layers.
 */

// ==========================================
// Core Position and Spatial Types
// ==========================================

/**
 * Position in the 2D garden space.
 * Like coordinates on a map of life, these define where entities exist.
 */
export interface Position {
  x: number;  // 0-800 (canvas width)
  y: number;  // 0-600 (canvas height)
}

// ==========================================
// Genetic and Trait Types
// ==========================================

/**
 * Core traits shared by all entities.
 */
export interface BaseTraits {
  reproductionRate: number;     // 0-1, probability per tick
  metabolismEfficiency: number; // energy conversion rate (0.5-1.5)
}

/**
 * Traits specific to plants.
 */
export interface PlantTraits extends BaseTraits {
  photosynthesisRate: number;   // plants only (0.5-1.5)
}

/**
 * Traits specific to herbivores.
 */
export interface HerbivoreTraits extends BaseTraits {
  movementSpeed: number;        // pixels per tick
  perceptionRadius: number;     // detection range for food (pixels)
  threatDetectionRadius: number; // detection range for predators (pixels)
}

/**
 * Traits specific to carnivores.
 */
export interface CarnivoreTraits extends BaseTraits {
  movementSpeed: number;          // pixels per tick
  perceptionRadius: number;       // detection range for prey (pixels)
  huntTargetId?: string | null;   // persisted hunt target; null when not actively hunting
  huntTicksOnTarget?: number;     // ticks spent chasing current target; resets on switch or kill
}

/**
 * Traits specific to fungi.
 */
export interface FungusTraits extends BaseTraits {
  decompositionRate: number;    // fungi only - how quickly they break down matter (0.5-1.5)
  perceptionRadius: number;     // detection range for dead matter (pixels)
}

/**
 * Discriminated union of all possible entity traits.
 * This ensures that each entity type only carries traits relevant to its biology.
 */
export type Traits = 
  | ({ type: 'plant' } & PlantTraits)
  | ({ type: 'herbivore' } & HerbivoreTraits)
  | ({ type: 'carnivore' } & CarnivoreTraits)
  | ({ type: 'fungus' } & FungusTraits);

// ==========================================
// Entity Types - The Living Organisms
// ==========================================

/**
 * Entity type discriminator - the kingdom of life each entity belongs to.
 */
export type EntityType = Traits['type'];

/**
 * Lightweight dead matter entry. Replaces the old pattern of keeping dead
 * entities in the `entities` table with `is_alive = 0`. Only the data
 * needed for decomposition and rendering is stored.
 *
 * Created when an entity dies with energy > DEAD_MATTER_MIN_ENERGY.
 * Deleted when fungi decompose it to 0 or after DEAD_MATTER_TTL_TICKS.
 */
export interface DeadMatter {
  id: string;
  position: Position;
  energy: number;
  type: EntityType;
  deathTick: number;
}

/**
 * Raw database row shape for the dead_matter table.
 */
export interface DeadMatterRow {
  id: string;
  position_x: number;
  position_y: number;
  energy: number;
  type: string;
  death_tick: number;
}

/**
 * The living organisms in our ecosystem.
 * Each entity carries its genetic code, state, and history.
 * 
 * Using a generic T allows for stricter type checking when the entity type is known.
 */
export type Entity = {
  id: string;                   // UUID - unique identifier
  gardenStateId?: number;       // Optional FK to garden state snapshot (born at)
  bornAtTick: number;           // The tick this entity was born
  deathTick?: number;           // The tick this entity died
  isAlive: boolean;             // Whether the entity is currently living
  name: string;                 // Individual name (unique moniker)
  species: string;              // Species name, can evolve through mutations
  position: Position;           // spatial location
  energy: number;               // 0-100, dies at 0 (life force)
  health: number;               // 0-100, dies at 0 (physical condition)
  age: number;                  // ticks lived (time experienced)
  lineage: string | 'origin';   // parent ID or 'origin' for first generation
  createdAt: string;            // ISO timestamp - birth moment
  updatedAt: string;            // ISO timestamp - last update
} & Traits;

// ==========================================
// Environment Types
// ==========================================

/**
 * Discrete weather states that govern the garden's atmospheric conditions.
 * Each state persists for a duration range before transitioning.
 */
export type WeatherStateName =
  | 'CLEAR'
  | 'OVERCAST'
  | 'RAIN'
  | 'STORM'
  | 'DROUGHT'
  | 'FOG';

/**
 * Per-state environmental modifiers applied each tick.
 * These influence (not replace) the baseline environment variables.
 */
export interface WeatherStateModifiers {
  temperatureOffset: number;
  sunlightMultiplier: number;
  moistureChangePerTick: number;
  photosynthesisModifier: number;
  movementModifier: number;
  reproductionModifier: number;
}

/**
 * Transition probability entry: target state and its weight.
 * Weights are normalized at runtime, not required to sum to 1.
 */
export interface WeatherTransitionWeight {
  targetState: WeatherStateName;
  weight: number;
}

/**
 * Complete definition of a weather state including duration and transitions.
 */
export interface WeatherStateDefinition {
  name: WeatherStateName;
  displayLabel: string;
  minimumDurationTicks: number;
  maximumDurationTicks: number;
  modifiers: WeatherStateModifiers;
  transitions: WeatherTransitionWeight[];
}

/**
 * Runtime weather state persisted across ticks.
 * Stored in the garden_state table as a JSON column.
 */
export interface ActiveWeatherState {
  currentState: WeatherStateName;
  stateEnteredAtTick: number;
  plannedDurationTicks: number;
  previousState: WeatherStateName | null;
  transitionProgressTicks: number;
}

/**
 * Environmental conditions that affect all entities in the garden.
 * Like weather and climate, these create the context for life.
 */
export interface Environment {
  temperature: number;  // 0-40°C (affects metabolism)
  sunlight: number;     // 0-1 intensity (affects photosynthesis)
  moisture: number;     // 0-1 humidity/water availability (affects survival)
  tick: number;         // simulation tick counter (time's passage)
  weatherState: ActiveWeatherState | null;
}

// ==========================================
// Garden State Types
// ==========================================

/**
 * Summary of populations by type - a census of life.
 * Tracks both living and dead entities.
 */
export interface PopulationSummary {
  plants: number;
  herbivores: number;
  carnivores: number;
  fungi: number;
  deadPlants: number; // Current dead matter still in garden
  deadHerbivores: number; // Current dead matter still in garden
  deadCarnivores: number; // Current dead matter still in garden
  deadFungi: number; // Current dead matter still in garden
  allTimeDeadPlants: number;
  allTimeDeadHerbivores: number;
  allTimeDeadCarnivores: number;
  allTimeDeadFungi: number;
  total: number;
  totalLiving: number;
  totalDead: number; // Current dead matter still in garden
  allTimeDead: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  gardenState?: {
    tick: number;
    timestamp: string;
  } | null;
  config?: {
    tickIntervalMinutes: number;
  };
  tick?: number;
  version?: string;
  databaseReady?: boolean;
  activeCuratorLease?: boolean;
  canonicalTick?: number;
  schemaVersion?: string;
}

/**
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
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'LEASE_CONFLICT'
  | 'STALE_CANONICAL'
  | 'INVALID_CHECKPOINT'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE';

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

export interface EncodedEngineCheckpoint {
  version: number;
  tick: number;
  seed: number;
  byteLength: number;
  checksum: string;
  payload: string;
}

export interface CuratorLease {
  leaseId: string;
  curatorId: string;
  grantedAtMs: number;
  expiresAtMs: number;
  authorizedTick: number;
}

export interface ChronicleEvent {
  id: string;
  tick: number;
  timestamp: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  tags: string[];
}

export interface CanonicalWorldState {
  id: number;
  tick: number;
  epoch: number;
  timestamp: string;
  seed: number;
  atmospheric: {
    temperature: number;
    sunlight: number;
    moisture: number;
    weatherState?: WeatherStateName | ActiveWeatherState | null;
  };
  populationSummary: PopulationSummary;
  entities: Entity[];
  deadMatter: DeadMatter[];
  soil: {
    cols: number;
    rows: number;
    cellSize?: number;
    moisture: number[] | Float32Array;
    nitrates: number[] | Float32Array;
  };
  checksum: string;
  version?: number;
  prngState?: number;
  checkpoint?: EncodedEngineCheckpoint;
}

export interface CanonicalCheckpointSubmission {
  leaseId: string;
  baseCanonicalTick: number;
  checkpoint: EncodedEngineCheckpoint;
  canonicalState?: CanonicalWorldState;
  chronicleEvents?: ChronicleEvent[];
}

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

export interface CheckpointCommitResult {
  committed: boolean;
  tick?: number;
  canonicalTick: number;
  checksum: string;
  committedAt: string;
  chronicleEventIds: string[];
}

export interface CanonicalAnchorRecord {
  id: number;
  checkpointId: number | null;
  canonicalTick: number;
  checksum: string | null;
  updatedAtMs: number;
}

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

export interface GardenStatsQuery {
  fromTick?: number;
  toTick?: number;
  bucket?: number;
  windowTicks?: number;
}

export interface GardenBootstrapResponse {
  canonicalState: CanonicalWorldState;
  checkpoint?: EncodedEngineCheckpoint;
  events: ChronicleEvent[];
  exactContinuation?: boolean;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle) {
    const arrayBuffer: ArrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const hashBuffer = await subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  if (typeof require !== 'undefined') {
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
    } catch {
      // ignore
    }
  }
  throw new Error('No crypto available to compute SHA-256');
}

export const MAX_CHRONICLE_EVENTS_PER_SUBMISSION = 10;
export const MAX_CHRONICLE_DESCRIPTION_BYTES = 512;
export const MAX_CHRONICLE_TYPE_LENGTH = 64;
export const MAX_CHRONICLE_TAGS_COUNT = 12;
export const MAX_CHRONICLE_TAG_LENGTH = 48;

export const CHRONICLE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ChronicleSeverity = typeof CHRONICLE_SEVERITIES[number];

export function validateChronicleEvent(input: {
  canonicalTick?: number;
  tick?: number;
  occurredAt?: string;
  timestamp?: string;
  type: string;
  severity: string;
  description: string;
  tags?: string[];
}): { valid: boolean; error?: string } {
  const tick = input.canonicalTick ?? input.tick;
  if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
    return { valid: false, error: 'Chronicle event tick must be a non-negative integer' };
  }

  if (typeof input.type !== 'string' || input.type.trim().length === 0) {
    return { valid: false, error: 'Chronicle event type must be a non-empty string' };
  }
  if (input.type.length > MAX_CHRONICLE_TYPE_LENGTH) {
    return { valid: false, error: `Chronicle event type exceeds ${MAX_CHRONICLE_TYPE_LENGTH} characters` };
  }

  if (typeof input.description !== 'string' || input.description.trim().length === 0) {
    return { valid: false, error: 'Chronicle event description must be a non-empty string' };
  }
  const descBytes = new TextEncoder().encode(input.description).byteLength;
  if (descBytes > MAX_CHRONICLE_DESCRIPTION_BYTES) {
    return { valid: false, error: `Chronicle event description exceeds ${MAX_CHRONICLE_DESCRIPTION_BYTES} UTF-8 bytes` };
  }

  if (!CHRONICLE_SEVERITIES.includes(input.severity as ChronicleSeverity)) {
    return { valid: false, error: `Chronicle event severity must be one of: ${CHRONICLE_SEVERITIES.join(', ')}` };
  }

  const tags = input.tags ?? [];
  if (!Array.isArray(tags)) {
    return { valid: false, error: 'Chronicle event tags must be an array of strings' };
  }
  if (tags.length > MAX_CHRONICLE_TAGS_COUNT) {
    return { valid: false, error: `Chronicle event tags exceed maximum count of ${MAX_CHRONICLE_TAGS_COUNT}` };
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length > MAX_CHRONICLE_TAG_LENGTH) {
      return { valid: false, error: `Chronicle event tag must be a string <= ${MAX_CHRONICLE_TAG_LENGTH} characters` };
    }
  }

  return { valid: true };
}

export async function computeChronicleEventChecksum(event: {
  canonicalTick: number;
  occurredAt: string;
  type: string;
  severity: string;
  description: string;
  tags: string[];
}): Promise<string> {
  const canonicalObj = {
    canonicalTick: event.canonicalTick,
    description: event.description.trim(),
    occurredAt: event.occurredAt,
    severity: event.severity,
    tags: [...event.tags].sort(),
    type: event.type.trim(),
  };

  const jsonStr = JSON.stringify(canonicalObj);
  const bytes = new TextEncoder().encode(jsonStr);
  return computeSha256Hex(bytes);
}

/**
 * Snapshot of the world at a point in time.
 * Like a photograph of the ecosystem, preserving a moment in history.
 */
export interface GardenState {
  id: number;
  tick: number;
  timestamp: string;           // ISO timestamp
  environment: Environment;
  populationSummary: PopulationSummary;
}

// ==========================================
// Logging Types - Structured Observability
// ==========================================

/**
 * Severity levels for application logging.
 * Like the urgency of a message in a bottle.
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

/**
 * Component identifiers for logging - which part of the system speaks.
 */
export type LogComponent = 
  | 'SIMULATION' 
  | 'DATABASE' 
  | 'API' 
  | 'ENTITY' 
  | 'ENVIRONMENT'
  | 'LOGGING'
  | 'SYSTEM';

// ==========================================
// Event Types - Simulation Narrative
// ==========================================

/**
 * Types of narrative events that tell the story of the ecosystem.
 */
export type SimulationEventType = 
  | 'BIRTH' 
  | 'DEATH' 
  | 'REPRODUCTION' 
  | 'MUTATION'
  | 'EXTINCTION'
  | 'POPULATION_EXPLOSION'
  | 'ECOSYSTEM_COLLAPSE'
  | 'DISASTER_FIRE'
  | 'DISASTER_FLOOD'
  | 'DISASTER_PLAGUE'
  | 'USER_INTERVENTION'
  | 'ENVIRONMENT_CHANGE'
  | 'POPULATION_DELTA'
  | 'AMBIENT';

/**
 * Severity levels for simulation events - the drama of life.
 */
export type EventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Narrative events for the simulation story.
 * These are the chronicles of life, death, and transformation.
 */
export interface SimulationEvent {
  id?: number;                    // database assigned
  gardenStateId: number;          // when in history this occurred
  tick: number;                   // simulation tick
  timestamp: string;              // ISO timestamp
  eventType: SimulationEventType; // what happened
  description: string;            // human-readable story
  entitiesAffected: string[];     // array of entity IDs involved
  tags: string[];                 // search/filter tags (e.g., 'biology', 'disaster')
  severity: EventSeverity;        // dramatic importance
  metadata?: string;              // JSON for additional context
}

export interface GardenStatsPoint {
  tick: number;
  timestamp: string;
  populations: {
    plants: number;
    herbivores: number;
    carnivores: number;
    fungi: number;
    living: number;
    dead: number;
  };
  environment: {
    temperature: number;
    sunlight: number;
    moisture: number;
    weatherState: WeatherStateName | null;
  };
}

export interface EventTypeBreakdown {
  eventType: SimulationEventType;
  count: number;
}

export interface EventSeverityBreakdown {
  severity: EventSeverity;
  count: number;
}

export interface GardenStatsAggregate {
  tickSpan: number;
  deltas: {
    plants: number;
    herbivores: number;
    carnivores: number;
    fungi: number;
    living: number;
    dead: number;
  };
  growthRates: {
    livingPerTick: number;
    deadPerTick: number;
  };
  mortalityPressure: number;
  populationVolatility: number;
  biodiversityIndex: number;
  predatorPreyRatio: number;
  decompositionPressure: number;
  averageEnvironment: {
    temperature: number;
    sunlight: number;
    moisture: number;
  };
  trendSlopes: {
    temperature: number;
    sunlight: number;
    moisture: number;
  };
}

export interface GardenInsight {
  id: string;
  title: string;
  description: string;
  severity: EventSeverity;
  kind:
    | 'POPULATION_SURGE'
    | 'COLLAPSE_RISK'
    | 'PREDATOR_PREY_IMBALANCE'
    | 'DECOMPOSITION_BACKLOG'
    | 'ENVIRONMENTAL_STRESS'
    | 'STABILITY_WINDOW';
  confidence: number;
  relatedMetrics: string[];
  tickRange: {
    start: number;
    end: number;
  };
}

export interface GardenTypeVitalSummary {
  count: number;
  averageEnergy: number;
  averageHealth: number;
}

export interface GardenEntityVitals {
  totalLiving: number;
  oldestLivingAge: number;
  youngestLivingAge: number;
  youngestCohortCount: number;
  averageEnergyAcrossLiving: number;
  averageHealthAcrossLiving: number;
  byType: {
    plant: GardenTypeVitalSummary;
    herbivore: GardenTypeVitalSummary;
    carnivore: GardenTypeVitalSummary;
    fungus: GardenTypeVitalSummary;
  };
}

export interface GardenStatsResponse {
  current: GardenState;
  history: GardenStatsPoint[];
  eventBreakdown: EventTypeBreakdown[];
  severityBreakdown: EventSeverityBreakdown[];
  derived: GardenStatsAggregate;
  insights: GardenInsight[];
  entityVitals: GardenEntityVitals;
  windowTicks: number;
  generatedAt: string;
}

// ==========================================
// API Types - Communication Protocols
// ==========================================

/**
 * Response from GET /api/garden - the current state of the world.
 */
export interface GardenResponse {
  success: boolean;
  data: {
    gardenState: GardenState;
    entities: Entity[];
    deadMatter: DeadMatter[];
    events: SimulationEvent[];
    timestamp: string;
  };
  error?: string;
  details?: unknown;
  timestamp: string;
}

// ==========================================
// Simulation Types - Internal Workings
// ==========================================

/**
 * Result of executing a simulation tick.
 */
export interface TickResult {
  success: boolean;
  previousState: GardenState;
  newState: GardenState;
  entities: Entity[];
  events: SimulationEvent[];
  duration: number;
}

/**
 * Configuration constants for the simulation.
 * These are the physical laws of our universe.
 */
export interface SimulationConfig {
  // Garden dimensions
  gardenWidth: number;      // 800 pixels
  gardenHeight: number;     // 600 pixels
  
  // Entity limits
  maxPlants: number;        // 200
  maxHerbivores: number;    // 100
  maxCarnivores: number;    // 50
  maxTotalEntities: number; // 500
  
  // Energy thresholds
  plantReproductionThreshold: number;     // 80
  herbivoreReproductionThreshold: number; // 60
  carnivoreReproductionThreshold: number; // 70
  
  // Metabolism costs
  baseEnergyCostPerTick: number;          // 1
  movementEnergyCostPerPixel: number;     // 0.08
  
  // Photosynthesis
  basePhotosynthesisRate: number;         // 2.3
  
  // Mutation
  mutationProbability: number;            // 0.1 (10% chance)
  mutationRange: number;                  // 0.2 (±20%)
  
  // Initial spawn
  initialPlants: number;                  // 20
  initialHerbivores: number;              // 5
}

// ==========================================
// Default Configuration
// ==========================================

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  gardenWidth: 800,
  gardenHeight: 600,
  maxPlants: 200,
  maxHerbivores: 100,
  maxCarnivores: 50,
  maxTotalEntities: 500,
  plantReproductionThreshold: 69,
  herbivoreReproductionThreshold: 60,
  carnivoreReproductionThreshold: 70,
  baseEnergyCostPerTick: 1,
  movementEnergyCostPerPixel: 0.08,
  basePhotosynthesisRate: 2.3,
  mutationProbability: 0.1,
  mutationRange: 0.2,
  initialPlants: 20,
  initialHerbivores: 5,
};

// ==========================================
// Utility Types
// ==========================================

/**
 * Generic result type for operations that may fail.
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Database entity row shapes (for type-safe queries).
 */
export interface GardenStateRow {
  id: number;
  tick: number;
  timestamp: string;
  temperature: number;
  sunlight: number;
  moisture: number;
  weather_state: string | null;
  plants: number;
  herbivores: number;
  carnivores: number;
  fungi: number;
  dead_plants: number;
  dead_herbivores: number;
  dead_carnivores: number;
  dead_fungi: number;
  all_time_dead_plants: number;
  all_time_dead_herbivores: number;
  all_time_dead_carnivores: number;
  all_time_dead_fungi: number;
  total_living: number;
  total_dead: number;
  all_time_dead: number;
  total: number;
}

export interface EntityRow {
  id: string;
  garden_state_id: number | null;
  born_at_tick: number;
  death_tick: number | null;
  is_alive: number;
  type: string;
  name: string;
  species: string;
  position_x: number;
  position_y: number;
  energy: number;
  health: number;
  age: number;
  traits: string; // JSON string
  lineage: string;
  created_at: string;
  updated_at: string;
}

export interface SimulationEventRow {
  id: number;
  garden_state_id: number;
  tick: number;
  timestamp: string;
  event_type: string;
  description: string;
  entities_affected: string;
  tags: string; // JSON string
  severity: string;
  metadata: string | null;
}
