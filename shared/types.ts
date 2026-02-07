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
  perceptionRadius: number;     // detection range for food/predators (pixels)
}

/**
 * Traits specific to carnivores.
 */
export interface CarnivoreTraits extends BaseTraits {
  movementSpeed: number;        // pixels per tick
  perceptionRadius: number;     // detection range for prey (pixels)
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
 * Environmental conditions that affect all entities in the garden.
 * Like weather and climate, these create the context for life.
 */
export interface Environment {
  temperature: number;  // 0-40°C (affects metabolism)
  sunlight: number;     // 0-1 intensity (affects photosynthesis)
  moisture: number;     // 0-1 humidity/water availability (affects survival)
  tick: number;         // simulation tick counter (time's passage)
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
  deadPlants: number;
  deadHerbivores: number;
  deadCarnivores: number;
  deadFungi: number;
  total: number;
  totalLiving: number;
  totalDead: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  gardenState: {
    tick: number;
    timestamp: string;
  } | null;
  config: {
    tickIntervalMinutes: number;
  };
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

/**
 * Structured application logs for debugging and observability.
 * These are the telemetry of our ecosystem, revealing its inner workings.
 */
export interface ApplicationLog {
  id?: number;                  // database assigned
  timestamp: string;            // ISO timestamp
  level: LogLevel;              // severity
  component: LogComponent;      // source component
  operation: string;            // specific operation name (descriptive)
  message: string;              // human-readable description
  metadata?: string;            // JSON string for structured data
  tick?: number;                // simulation tick if applicable
  entityId?: string;            // related entity if applicable
  duration?: number;            // operation duration in ms
}

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
  | 'POPULATION_DELTA';

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

// ==========================================
// API Types - Communication Protocols
// ==========================================

/**
 * Response from GET /api/garden - the current state of the world.
 */
export interface GardenResponse {
  state: GardenState;
  entities: Entity[];
  recentEvents: SimulationEvent[];
  tick: number;
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
  herbivoreReproductionThreshold: number; // 90
  carnivoreReproductionThreshold: number; // 95
  
  // Metabolism costs
  baseEnergyCostPerTick: number;          // 1
  movementEnergyCostPerPixel: number;     // 0.1
  
  // Photosynthesis
  basePhotosynthesisRate: number;         // 2
  
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
  plantReproductionThreshold: 80,
  herbivoreReproductionThreshold: 90,
  carnivoreReproductionThreshold: 95,
  baseEnergyCostPerTick: 1,
  movementEnergyCostPerPixel: 0.1,
  basePhotosynthesisRate: 2,
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
  plants: number;
  herbivores: number;
  carnivores: number;
  fungi: number;
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

export interface ApplicationLogRow {
  id: number;
  timestamp: string;
  level: string;
  component: string;
  operation: string;
  message: string;
  metadata: string | null;
  tick: number | null;
  entity_id: string | null;
  duration: number | null;
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
