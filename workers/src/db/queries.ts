/**
 * Database Queries
 *
 * All database operations for the Chaos Garden simulation.
 * These functions form the bridge between our simulation logic
 * and persistent storage—like the roots that anchor our ecosystem.
 *
 * Each operation is instrumented with logging hooks to ensure
 * complete observability of the system's inner workings.
 */

import type {
  GardenState,
  Entity,
  DeadMatter,
  DeadMatterRow,
  SimulationEvent,
  SimulationEventType,
  EventSeverity,
  EventTypeBreakdown,
  EventSeverityBreakdown,
  GardenStateRow,
  EntityRow,
  SimulationEventRow,
  Environment,
  PopulationSummary,
  ActiveWeatherState,
  EncodedEngineCheckpoint,
  CuratorLease,
  ChronicleEvent,
  CanonicalAnchorRecord,
  CanonicalCheckpointSubmission,
  CheckpointCommitResult,
  DiagnosticsSummary,
} from "@chaos-garden/shared";
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  computeChronicleEventChecksum,
  validateChronicleEvent,
  MAX_CHRONICLE_EVENTS_PER_SUBMISSION,
} from "@chaos-garden/shared";
import { queryFirst, queryAll, executeQuery, executeBatch } from "./connection";
import type { D1Database } from "../types/worker";
import { extractTraits } from "../simulation/environment/helpers";

// ==========================================
// Safe JSON Parsing
// ==========================================

/**
 * Safely parse a JSON string, returning a fallback value if parsing fails.
 * Prevents corrupted database rows from crashing the entire tick or API response.
 */
function safeParseJson<T>(jsonString: string, fallback: T): T;
function safeParseJson<T>(jsonString: string, fallback: T | null): T | null;
function safeParseJson<T>(jsonString: string, fallback: T | null): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    console.error(`Failed to parse JSON: ${jsonString.slice(0, 100)}`);
    return fallback;
  }
}

// ==========================================
// Garden State Queries
// ==========================================

/**
 * Retrieve the most recent garden state snapshot.
 * Like reading the current page of history.
 *
 * @param db - The D1 database instance
 * @returns The latest garden state or null if none exists
 */
export async function getLatestGardenStateFromDatabase(
  db: D1Database,
): Promise<GardenState | null> {
  const row = await queryFirst<GardenStateRow>(
    db,
    `SELECT id, tick, timestamp, temperature, sunlight, moisture, weather_state,
            plants, herbivores, carnivores, fungi,
            dead_plants, dead_herbivores, dead_carnivores, dead_fungi,
            all_time_dead_plants, all_time_dead_herbivores, all_time_dead_carnivores, all_time_dead_fungi,
            total_living, total_dead, all_time_dead, total
     FROM garden_state
     ORDER BY tick DESC
     LIMIT 1`,
  );

  if (!row) {
    return null;
  }

  return mapRowToGardenState(row);
}

/**
 * Load all entities (living and dead).
 */
export async function getAllEntitiesFromDatabase(
  db: D1Database,
): Promise<Entity[]> {
  const rows = await queryAll<EntityRow>(
    db,
    `SELECT id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
            energy, health, age, traits, lineage, created_at, updated_at
     FROM entities`,
  );

  return rows.map(mapRowToEntity);
}

/**
 * Retrieve a specific garden state by tick number.
 * Like opening a specific page in the book of history.
 *
 * @param db - The D1 database instance
 * @param tick - The tick number to retrieve
 * @returns The garden state or null if not found
 */
export async function getGardenStateByTickFromDatabase(
  db: D1Database,
  tick: number,
): Promise<GardenState | null> {
  const row = await queryFirst<GardenStateRow>(
    db,
    `SELECT id, tick, timestamp, temperature, sunlight, moisture, weather_state,
            plants, herbivores, carnivores, fungi,
            dead_plants, dead_herbivores, dead_carnivores, dead_fungi,
            all_time_dead_plants, all_time_dead_herbivores, all_time_dead_carnivores, all_time_dead_fungi,
            total_living, total_dead, all_time_dead, total
     FROM garden_state
     WHERE tick = ?`,
    [tick],
  );

  if (!row) {
    return null;
  }

  return mapRowToGardenState(row);
}

/**
 * Persist a new garden state to the database.
 * Like inscribing a new page in the chronicles of history.
 *
 * @param db - The D1 database instance
 * @param state - The garden state to save
 * @returns The ID of the newly created state
 */
export async function saveGardenStateToDatabase(
  db: D1Database,
  state: GardenState,
): Promise<number> {
  await executeQuery<{ id: number }>(
    db,
    `INSERT INTO garden_state (
      tick, timestamp, temperature, sunlight, moisture, weather_state,
      plants, herbivores, carnivores, fungi,
      dead_plants, dead_herbivores, dead_carnivores, dead_fungi,
      all_time_dead_plants, all_time_dead_herbivores, all_time_dead_carnivores, all_time_dead_fungi,
      total_living, total_dead, all_time_dead, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tick) DO UPDATE SET
      timestamp = excluded.timestamp,
      temperature = excluded.temperature,
      sunlight = excluded.sunlight,
      moisture = excluded.moisture,
      weather_state = excluded.weather_state,
      plants = excluded.plants,
      herbivores = excluded.herbivores,
      carnivores = excluded.carnivores,
      fungi = excluded.fungi,
      dead_plants = excluded.dead_plants,
      dead_herbivores = excluded.dead_herbivores,
      dead_carnivores = excluded.dead_carnivores,
      dead_fungi = excluded.dead_fungi,
      all_time_dead_plants = excluded.all_time_dead_plants,
      all_time_dead_herbivores = excluded.all_time_dead_herbivores,
      all_time_dead_carnivores = excluded.all_time_dead_carnivores,
      all_time_dead_fungi = excluded.all_time_dead_fungi,
      total_living = excluded.total_living,
      total_dead = excluded.total_dead,
      all_time_dead = excluded.all_time_dead,
      total = excluded.total`,
    [
      state.tick,
      state.timestamp,
      state.environment.temperature,
      state.environment.sunlight,
      state.environment.moisture,
      state.environment.weatherState
        ? JSON.stringify(state.environment.weatherState)
        : null,
      state.populationSummary.plants,
      state.populationSummary.herbivores,
      state.populationSummary.carnivores,
      state.populationSummary.fungi,
      state.populationSummary.deadPlants,
      state.populationSummary.deadHerbivores,
      state.populationSummary.deadCarnivores,
      state.populationSummary.deadFungi,
      state.populationSummary.allTimeDeadPlants,
      state.populationSummary.allTimeDeadHerbivores,
      state.populationSummary.allTimeDeadCarnivores,
      state.populationSummary.allTimeDeadFungi,
      state.populationSummary.totalLiving,
      state.populationSummary.totalDead,
      state.populationSummary.allTimeDead,
      state.populationSummary.total,
    ],
  );

  const persistedState = await queryFirst<{ id: number }>(
    db,
    "SELECT id FROM garden_state WHERE tick = ?",
    [state.tick],
  );

  if (!persistedState) {
    throw new Error(`Failed to persist garden state for tick ${state.tick}`);
  }

  return persistedState.id;
}

// ==========================================
// Entity Queries
// ==========================================

/**
 * Load all living entities.
 * Like summoning all creatures to be counted.
 *
 * @param db - The D1 database instance
 * @returns Array of entities
 */
export async function getAllLivingEntitiesFromDatabase(
  db: D1Database,
): Promise<Entity[]> {
  const rows = await queryAll<EntityRow>(
    db,
    `SELECT id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
            energy, health, age, traits, lineage, created_at, updated_at
     FROM entities
     WHERE is_alive = 1
     ORDER BY born_at_tick ASC, id ASC`,
  );

  return rows.map(mapRowToEntity);
}

// ==========================================
// Dead Matter Queries
// ==========================================

/**
 * Load all current dead matter (corpses awaiting decomposition or TTL expiry).
 */
export async function getDeadMatterFromDatabase(
  db: D1Database,
): Promise<DeadMatter[]> {
  const rows = await queryAll<DeadMatterRow>(
    db,
    `SELECT id, position_x, position_y, energy, type, death_tick
     FROM dead_matter
     ORDER BY death_tick ASC, id ASC`,
  );

  return rows.map(mapRowToDeadMatter);
}

/**
 * Insert new dead matter rows for entities that died this tick.
 */
export async function createDeadMatterBatchInDatabase(
  db: D1Database,
  items: DeadMatter[],
): Promise<void> {
  if (items.length === 0) return;

  const statements = items.map((item) => ({
    query: `INSERT OR IGNORE INTO dead_matter (id, position_x, position_y, energy, type, death_tick)
            VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      item.id,
      item.position.x,
      item.position.y,
      item.energy,
      item.type,
      item.deathTick,
    ],
  }));

  await executeBatch(db, statements);
}

/**
 * Update energy on partially-decomposed dead matter items.
 */
export async function updateDeadMatterEnergyBatchInDatabase(
  db: D1Database,
  items: DeadMatter[],
): Promise<void> {
  if (items.length === 0) return;

  const statements = items.map((item) => ({
    query: `UPDATE dead_matter SET energy = ? WHERE id = ?`,
    params: [item.energy, item.id],
  }));

  await executeBatch(db, statements);
}

/**
 * Delete fully-decomposed dead matter items (energy reached 0).
 */
export async function deleteDeadMatterBatchInDatabase(
  db: D1Database,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const statements = ids.map((id) => ({
    query: `DELETE FROM dead_matter WHERE id = ?`,
    params: [id],
  }));

  await executeBatch(db, statements);
}

/**
 * Delete garden_state rows older than a tick threshold.
 * Cascades automatically to simulation_events (ON DELETE CASCADE FK).
 * Call once per tick to keep historical storage bounded forever.
 */
export async function pruneOldGardenStatesFromDatabase(
  db: D1Database,
  keepAfterTick: number,
): Promise<void> {
  if (keepAfterTick <= 0) return;
  await executeQuery(db, `DELETE FROM garden_state WHERE tick < ?`, [
    keepAfterTick,
  ]);
}

/**
 * Delete dead matter rows older than the TTL threshold.
 * Handles corpses that fungi never reached.
 */
export async function purgeExpiredDeadMatterFromDatabase(
  db: D1Database,
  beforeTick: number,
): Promise<void> {
  await executeQuery(db, `DELETE FROM dead_matter WHERE death_tick < ?`, [
    beforeTick,
  ]);
}

/**
 * Remove specific entities from the entities table.
 * Called when living entities die — they either move to dead_matter or disappear.
 */
export async function deleteEntitiesByIdsFromDatabase(
  db: D1Database,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const statements = ids.map((id) => ({
    query: `DELETE FROM entities WHERE id = ?`,
    params: [id],
  }));

  await executeBatch(db, statements);
}

/**
 * Retrieve a specific entity by its ID.
 * Like calling forth a specific creature by name.
 *
 * @param db - The D1 database instance
 * @param entityId - The UUID of the entity
 * @returns The entity or null if not found
 */
export async function getEntityByIdFromDatabase(
  db: D1Database,
  entityId: string,
): Promise<Entity | null> {
  const row = await queryFirst<EntityRow>(
    db,
    `SELECT id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
            energy, health, age, traits, lineage, created_at, updated_at
     FROM entities
     WHERE id = ?`,
    [entityId],
  );

  if (!row) {
    return null;
  }

  return mapRowToEntity(row);
}

/**
 * Save a batch of entities to the database.
 * Like planting a garden all at once.
 *
 * @param db - The D1 database instance
 * @param entities - Array of entities to save
 * @param gardenStateId - Optional garden state ID to associate with (born at)
 */
export async function saveEntitiesToDatabase(
  db: D1Database,
  entities: Entity[],
  gardenStateId?: number,
): Promise<void> {
  if (entities.length === 0) {
    return;
  }

  const statements = entities.map((entity) => {
    const traits = extractTraits(entity);

    return {
      query: `INSERT OR REPLACE INTO entities (
        id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
        energy, health, age, traits, lineage, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        entity.id,
        entity.gardenStateId || gardenStateId || null,
        entity.bornAtTick,
        entity.deathTick || null,
        entity.isAlive ? 1 : 0,
        entity.type,
        entity.name,
        entity.species,
        entity.position.x,
        entity.position.y,
        entity.energy,
        entity.health,
        entity.age,
        JSON.stringify(traits),
        entity.lineage,
        entity.createdAt,
        entity.updatedAt,
      ],
    };
  });

  await executeBatch(db, statements);
}

/**
 * Mark entities as dead in the database.
 * Like recording the passing of seasons.
 *
 * @param db - The D1 database instance
 * @param entityIds - Array of entity IDs to mark as dead
 * @param deathTick - The tick at which they died
 */
export async function markEntitiesAsDeadInDatabase(
  db: D1Database,
  entityIds: string[],
  deathTick: number,
): Promise<void> {
  if (entityIds.length === 0) {
    return;
  }

  const statements = entityIds.map((id) => ({
    query:
      "UPDATE entities SET is_alive = 0, death_tick = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    params: [deathTick, id],
  }));

  await executeBatch(db, statements);
}

// ==========================================
// Simulation Event Queries
// ==========================================

/**
 * Persist a narrative simulation event to the database.
 * Like recording a moment in the epic story of life.
 *
 * @param db - The D1 database instance
 * @param event - The simulation event to log
 */
export async function logSimulationEventToDatabase(
  db: D1Database,
  event: SimulationEvent,
): Promise<void> {
  try {
    await executeQuery(
      db,
      `INSERT INTO simulation_events (
        garden_state_id, tick, timestamp, event_type, description,
        entities_affected, tags, severity, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.gardenStateId,
        event.tick,
        event.timestamp,
        event.eventType,
        event.description,
        JSON.stringify(event.entitiesAffected),
        JSON.stringify(event.tags),
        event.severity,
        event.metadata || null,
      ],
    );
  } catch (error) {
    // Fail silently—event logging should not disrupt the simulation
    console.error("Failed to log simulation event:", error);
  }
}

/**
 * Retrieve recent simulation events.
 * Like reading the recent chapters of history.
 *
 * @param db - The D1 database instance
 * @param limit - Maximum number of events to retrieve
 * @param gardenStateId - Optional garden state ID to scope events to one snapshot
 * @returns Array of simulation events
 */
export async function getRecentSimulationEventsFromDatabase(
  db: D1Database,
  limit: number = 50,
  gardenStateId?: number,
): Promise<SimulationEvent[]> {
  const whereClause =
    typeof gardenStateId === "number" ? "WHERE garden_state_id = ?" : "";
  const queryParams =
    typeof gardenStateId === "number" ? [gardenStateId, limit] : [limit];

  const rows = await queryAll<SimulationEventRow>(
    db,
    `SELECT id, garden_state_id, tick, timestamp, event_type, description,
            entities_affected, tags, severity, metadata
     FROM simulation_events
     ${whereClause}
     ORDER BY tick DESC, timestamp DESC
     LIMIT ?`,
    queryParams,
  );

  return rows.map(mapRowToSimulationEvent);
}

/**
 * Retrieve events for a specific tick range.
 * Useful for analyzing historical periods.
 *
 * @param db - The D1 database instance
 * @param startTick - Start of the tick range (inclusive)
 * @param endTick - End of the tick range (inclusive)
 * @returns Array of simulation events
 */
export async function getSimulationEventsByTickRangeFromDatabase(
  db: D1Database,
  startTick: number,
  endTick: number,
): Promise<SimulationEvent[]> {
  const rows = await queryAll<SimulationEventRow>(
    db,
    `SELECT id, garden_state_id, tick, timestamp, event_type, description,
            entities_affected, tags, severity, metadata
     FROM simulation_events
     WHERE tick >= ? AND tick <= ?
     ORDER BY tick ASC, timestamp ASC`,
    [startTick, endTick],
  );

  return rows.map(mapRowToSimulationEvent);
}

/**
 * Retrieve historical garden states ending at the provided tick.
 * Returns rows in ascending tick order for chart rendering.
 */
export async function getGardenStateHistoryFromDatabase(
  db: D1Database,
  windowTicks: number,
  endTick?: number,
): Promise<GardenState[]> {
  const normalizedWindowTicks = Math.max(1, windowTicks);

  const query =
    typeof endTick === "number"
      ? `SELECT id, tick, timestamp, temperature, sunlight, moisture, weather_state,
              plants, herbivores, carnivores, fungi,
              dead_plants, dead_herbivores, dead_carnivores, dead_fungi,
              all_time_dead_plants, all_time_dead_herbivores, all_time_dead_carnivores, all_time_dead_fungi,
              total_living, total_dead, all_time_dead, total
       FROM garden_state
       WHERE tick <= ?
       ORDER BY tick DESC
       LIMIT ?`
      : `SELECT id, tick, timestamp, temperature, sunlight, moisture, weather_state,
              plants, herbivores, carnivores, fungi,
              dead_plants, dead_herbivores, dead_carnivores, dead_fungi,
              all_time_dead_plants, all_time_dead_herbivores, all_time_dead_carnivores, all_time_dead_fungi,
              total_living, total_dead, all_time_dead, total
       FROM garden_state
       ORDER BY tick DESC
       LIMIT ?`;

  const params =
    typeof endTick === "number"
      ? [endTick, normalizedWindowTicks]
      : [normalizedWindowTicks];

  const rows = await queryAll<GardenStateRow>(db, query, params);
  return rows.map(mapRowToGardenState).reverse();
}

/**
 * Retrieve event counts grouped by event type for a tick window.
 */
export async function getSimulationEventCountsByTypeFromDatabase(
  db: D1Database,
  startTick: number,
  endTick: number,
): Promise<EventTypeBreakdown[]> {
  const rows = await queryAll<{ event_type: string; count: number }>(
    db,
    `SELECT event_type, CAST(COUNT(*) AS INTEGER) AS count
     FROM simulation_events
     WHERE tick >= ? AND tick <= ?
     GROUP BY event_type
     ORDER BY count DESC, event_type ASC`,
    [startTick, endTick],
  );

  return rows.map((row) => ({
    eventType: row.event_type as SimulationEventType,
    count: row.count,
  }));
}

/**
 * Retrieve event counts grouped by severity for a tick window.
 */
export async function getSimulationEventSeverityBreakdownFromDatabase(
  db: D1Database,
  startTick: number,
  endTick: number,
): Promise<EventSeverityBreakdown[]> {
  const rows = await queryAll<{ severity: string; count: number }>(
    db,
    `SELECT severity, CAST(COUNT(*) AS INTEGER) AS count
     FROM simulation_events
     WHERE tick >= ? AND tick <= ?
     GROUP BY severity
     ORDER BY count DESC, severity ASC`,
    [startTick, endTick],
  );

  return rows.map((row) => ({
    severity: row.severity as EventSeverity,
    count: row.count,
  }));
}

export async function deleteSimulationEventsByTickFromDatabase(
  db: D1Database,
  tick: number,
): Promise<void> {
  await executeQuery(db, "DELETE FROM simulation_events WHERE tick = ?", [
    tick,
  ]);
}

// ==========================================
// Row Mapping Functions
// ==========================================

/**
 * Convert a database row to a GardenState object.
 */
function mapRowToGardenState(row: GardenStateRow): GardenState {
  const environment: Environment = {
    temperature: row.temperature,
    sunlight: row.sunlight,
    moisture: row.moisture,
    tick: row.tick,
    weatherState: row.weather_state
      ? safeParseJson<ActiveWeatherState>(row.weather_state, null)
      : null,
  };

  const populationSummary: PopulationSummary = {
    plants: row.plants || 0,
    herbivores: row.herbivores || 0,
    carnivores: row.carnivores || 0,
    fungi: row.fungi || 0,
    deadPlants: row.dead_plants || 0,
    deadHerbivores: row.dead_herbivores || 0,
    deadCarnivores: row.dead_carnivores || 0,
    deadFungi: row.dead_fungi || 0,
    allTimeDeadPlants: row.all_time_dead_plants || 0,
    allTimeDeadHerbivores: row.all_time_dead_herbivores || 0,
    allTimeDeadCarnivores: row.all_time_dead_carnivores || 0,
    allTimeDeadFungi: row.all_time_dead_fungi || 0,
    totalLiving: row.total_living || 0,
    totalDead: row.total_dead || 0,
    allTimeDead: row.all_time_dead || 0,
    total: row.total || 0,
  };

  return {
    id: row.id,
    tick: row.tick,
    timestamp: row.timestamp,
    environment,
    populationSummary,
  };
}

/**
 * Convert a database row to an Entity object.
 */
function mapRowToEntity(row: EntityRow): Entity {
  const traits = safeParseJson<Record<string, unknown>>(row.traits, {});
  return {
    id: row.id,
    gardenStateId: row.garden_state_id || undefined,
    bornAtTick: row.born_at_tick,
    deathTick: row.death_tick || undefined,
    isAlive: row.is_alive === 1,
    type: row.type as Entity["type"],
    name: row.name,
    species: row.species,
    position: {
      x: row.position_x,
      y: row.position_y,
    },
    energy: row.energy,
    health: row.health,
    age: row.age,
    ...traits,
    lineage: row.lineage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Entity;
}

/**
 * Convert a dead_matter database row to a DeadMatter object.
 */
function mapRowToDeadMatter(row: DeadMatterRow): DeadMatter {
  return {
    id: row.id,
    position: { x: row.position_x, y: row.position_y },
    energy: row.energy,
    type: row.type as DeadMatter["type"],
    deathTick: row.death_tick,
  };
}

/**
 * Convert a database row to a SimulationEvent object.
 */
function mapRowToSimulationEvent(row: SimulationEventRow): SimulationEvent {
  return {
    id: row.id,
    gardenStateId: row.garden_state_id,
    tick: row.tick,
    timestamp: row.timestamp,
    eventType: row.event_type as SimulationEvent["eventType"],
    description: row.description,
    entitiesAffected: JSON.parse(row.entities_affected),
    tags: JSON.parse(row.tags || "[]"),
    severity: row.severity as SimulationEvent["severity"],
    metadata: row.metadata || undefined,
  };
}

// ==========================================
// Engine Checkpoints & Curator Leases
// ==========================================

export interface EngineCheckpointRow {
  id: number;
  tick: number;
  engine_version: number;
  seed: number;
  checksum: string;
  payload: unknown;
  created_at: string;
}

export interface CuratorLeaseRow {
  lease_id: string;
  curator_id: string;
  granted_at_ms: number;
  expires_at_ms: number;
  authorized_tick: number;
  created_at: string;
}

function normalizeBlobToUint8Array(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload);
  }
  if (Array.isArray(payload)) {
    return new Uint8Array(payload);
  }
  if (typeof payload === "string") {
    return base64ToUint8Array(payload);
  }
  return new Uint8Array(0);
}

export async function getLatestEngineCheckpoint(
  db: D1Database,
): Promise<EncodedEngineCheckpoint | null> {
  const row = await queryFirst<EngineCheckpointRow>(
    db,
    `SELECT id, tick, engine_version, seed, checksum, payload, created_at
     FROM engine_checkpoints
     ORDER BY tick DESC
     LIMIT 1`,
  );

  if (!row) return null;

  const bytes = normalizeBlobToUint8Array(row.payload);
  const base64Payload = uint8ArrayToBase64(bytes);

  return {
    version: row.engine_version,
    tick: row.tick,
    seed: row.seed,
    byteLength: bytes.byteLength,
    checksum: row.checksum,
    payload: base64Payload,
  };
}

export async function getEngineCheckpointById(
  db: D1Database,
  id: number,
): Promise<EncodedEngineCheckpoint | null> {
  const row = await queryFirst<EngineCheckpointRow>(
    db,
    `SELECT id, tick, engine_version, seed, checksum, payload, created_at
     FROM engine_checkpoints
     WHERE id = ?`,
    [id],
  );

  if (!row) return null;

  const bytes = normalizeBlobToUint8Array(row.payload);
  const base64Payload = uint8ArrayToBase64(bytes);

  return {
    version: row.engine_version,
    tick: row.tick,
    seed: row.seed,
    byteLength: bytes.byteLength,
    checksum: row.checksum,
    payload: base64Payload,
  };
}

export async function getLatestCheckpointTick(db: D1Database): Promise<number> {
  const row = await queryFirst<{ max_tick: number | null }>(
    db,
    `SELECT MAX(tick) as max_tick FROM engine_checkpoints`,
  );
  return row?.max_tick ?? -1;
}

export interface CheckpointAuthorizationContext {
  leaseId: string;
  curatorId: string;
  nowMs?: number;
}

export async function saveEngineCheckpoint(
  db: D1Database,
  checkpoint: EncodedEngineCheckpoint,
  authContext?: CheckpointAuthorizationContext,
): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
  try {
    const bytes = base64ToUint8Array(checkpoint.payload);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );

    if (authContext) {
      const now = authContext.nowMs ?? Date.now();
      const result = await executeQuery(
        db,
        `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM curator_leases
           WHERE id = 1
             AND lease_id = ?
             AND curator_id = ?
             AND expires_at_ms > ?
             AND authorized_tick < ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM engine_checkpoints
           WHERE tick >= ?
         )`,
        [
          checkpoint.tick,
          checkpoint.version,
          checkpoint.seed,
          checkpoint.checksum,
          arrayBuffer,
          authContext.leaseId,
          authContext.curatorId,
          now,
          checkpoint.tick,
          checkpoint.tick,
        ],
      );

      const changes = result.meta?.changes ?? 0;
      if (changes !== 1) {
        return {
          success: false,
          conflict: true,
          error:
            "Curator lease has expired, was superseded, or a checkpoint with an equal or higher tick has already been persisted",
        };
      }

      // Atomically advance authorized_tick on singleton row (ensuring it only strictly advances)
      await executeQuery(
        db,
        `UPDATE curator_leases
         SET authorized_tick = ?, updated_at = datetime('now')
         WHERE id = 1
           AND lease_id = ?
           AND curator_id = ?
           AND expires_at_ms > ?
           AND authorized_tick < ?`,
        [
          checkpoint.tick,
          authContext.leaseId,
          authContext.curatorId,
          now,
          checkpoint.tick,
        ],
      );

      return { success: true };
    }

    const result = await executeQuery(
      db,
      `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        checkpoint.tick,
        checkpoint.version,
        checkpoint.seed,
        checkpoint.checksum,
        arrayBuffer,
      ],
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to insert checkpoint",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pruneEngineCheckpoints(
  db: D1Database,
  maxRetained: number = 500,
): Promise<void> {
  await executeQuery(
    db,
    `DELETE FROM engine_checkpoints
     WHERE id NOT IN (
       SELECT id FROM engine_checkpoints
       ORDER BY tick DESC
       LIMIT ?
     )`,
    [maxRetained],
  );
}

export async function getActiveCuratorLease(
  db: D1Database,
  leaseId?: string,
): Promise<CuratorLease | null> {
  const now = Date.now();
  const query = leaseId
    ? `SELECT lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick, created_at
       FROM curator_leases
       WHERE id = 1 AND lease_id = ? AND expires_at_ms > ?
       LIMIT 1`
    : `SELECT lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick, created_at
       FROM curator_leases
       WHERE id = 1 AND expires_at_ms > ?
       LIMIT 1`;
  const params = leaseId ? [leaseId, now] : [now];
  const row = await queryFirst<CuratorLeaseRow>(db, query, params);

  if (!row) return null;

  return {
    leaseId: row.lease_id,
    curatorId: row.curator_id,
    grantedAtMs: row.granted_at_ms,
    expiresAtMs: row.expires_at_ms,
    authorizedTick: row.authorized_tick,
  };
}

export async function hasActiveCuratorLease(db: D1Database): Promise<boolean> {
  const now = Date.now();
  const row = await queryFirst<{ count: number }>(
    db,
    `SELECT COUNT(*) as count FROM curator_leases WHERE id = 1 AND expires_at_ms > ?`,
    [now],
  );
  return (row?.count ?? 0) > 0;
}

export async function acquireOrRenewCuratorLease(
  db: D1Database,
  curatorId: string,
  authorizedTick: number,
  requestedLeaseId?: string,
  ttlMs: number = 120000,
): Promise<
  { lease: CuratorLease } | { error: string; conflictingCuratorId?: string }
> {
  const now = Date.now();
  const leaseId =
    requestedLeaseId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `lease-${now}-${Math.floor(Math.random() * 100000)}`);
  const expiresAtMs = now + ttlMs;

  // Ensure singleton row exists in case of fresh or unseeded DB
  await executeQuery(
    db,
    `INSERT OR IGNORE INTO curator_leases (id, lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick, created_at, updated_at)
     VALUES (1, 'initial', 'none', 0, 0, 0, datetime('now'), datetime('now'))`,
  );

  // Atomic Compare-And-Swap (CAS) update on singleton lock row:
  // Succeeds with changes === 1 IF AND ONLY IF:
  // 1. Current lease has expired (expires_at_ms <= now), OR
  // 2. The same curator is renewing (curator_id = ?), OR
  // 3. The specific leaseId is being renewed (lease_id = ? AND requestedLeaseId IS NOT NULL)
  const result = await executeQuery(
    db,
    `UPDATE curator_leases
     SET lease_id = ?,
         curator_id = ?,
         granted_at_ms = ?,
         expires_at_ms = ?,
         authorized_tick = ?,
         updated_at = datetime('now')
     WHERE id = 1
       AND (
         expires_at_ms <= ?
         OR curator_id = ?
         OR (lease_id = ? AND ? IS NOT NULL)
       )`,
    [
      leaseId,
      curatorId,
      now,
      expiresAtMs,
      authorizedTick,
      now,
      curatorId,
      requestedLeaseId ?? "",
      requestedLeaseId ?? null,
    ],
  );

  const changes = result.meta?.changes ?? 0;
  if (changes === 1) {
    return {
      lease: {
        leaseId,
        curatorId,
        grantedAtMs: now,
        expiresAtMs,
        authorizedTick,
      },
    };
  }

  // Acquisition failed due to active conflicting lease held by another curator
  const active = await getActiveCuratorLease(db);
  return {
    error: "Active curator lease is currently held by another curator",
    conflictingCuratorId: active?.curatorId,
  };
}

// ==========================================
// Phase 4: Canonical Anchor & Chronicle Queries
// ==========================================

export interface CanonicalAnchorRow {
  id: number;
  checkpoint_id: number | null;
  canonical_tick: number;
  checksum: string | null;
  updated_at_ms: number;
}

export async function getCanonicalAnchor(
  db: D1Database,
): Promise<CanonicalAnchorRecord | null> {
  const row = await queryFirst<CanonicalAnchorRow>(
    db,
    `SELECT id, checkpoint_id, canonical_tick, checksum, updated_at_ms
     FROM canonical_anchor
     WHERE id = 1`,
  );
  if (!row) return null;
  return {
    id: row.id,
    checkpointId: row.checkpoint_id,
    canonicalTick: row.canonical_tick,
    checksum: row.checksum,
    updatedAtMs: row.updated_at_ms,
  };
}

export interface ChronicleEventRow {
  id: string;
  canonical_tick: number;
  occurred_at: string;
  type: string;
  severity: string;
  description: string;
  tags_json: string;
  checksum: string;
  created_at_ms: number;
}

export async function getChronicleEvents(
  db: D1Database,
  limit: number = 50,
): Promise<ChronicleEvent[]> {
  const rows = await queryAll<ChronicleEventRow>(
    db,
    `SELECT id, canonical_tick, occurred_at, type, severity, description, tags_json, checksum, created_at_ms
     FROM chronicle_events
     ORDER BY canonical_tick DESC, created_at_ms DESC
     LIMIT ?`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    tick: row.canonical_tick,
    timestamp: row.occurred_at,
    type: row.type,
    severity: row.severity as ChronicleEvent["severity"],
    description: row.description,
    tags: safeParseJson<string[]>(row.tags_json, []),
  }));
}

export interface CommitCanonicalResult {
  success: boolean;
  result?: CheckpointCommitResult;
  conflict?: boolean;
  staleCanonical?: boolean;
  idempotent?: boolean;
  error?: string;
}

export async function commitCanonicalCheckpoint(
  db: D1Database,
  submission: CanonicalCheckpointSubmission,
  authContext: CheckpointAuthorizationContext,
): Promise<CommitCanonicalResult> {
  const now = authContext.nowMs ?? Date.now();
  const currentAnchor = await getCanonicalAnchor(db);

  // 1. Stale base check: submission's base canonical tick must match current anchor tick
  if (
    currentAnchor &&
    submission.baseCanonicalTick !== currentAnchor.canonicalTick
  ) {
    return {
      success: false,
      staleCanonical: true,
      error: `Stale base canonical tick: submission base is ${submission.baseCanonicalTick} but current anchor is ${currentAnchor.canonicalTick}`,
    };
  }

  // 2. Monotonic tick check & Idempotent retry check
  if (currentAnchor) {
    if (submission.checkpoint.tick === currentAnchor.canonicalTick) {
      if (
        submission.checkpoint.checksum.toLowerCase() ===
        (currentAnchor.checksum ?? "").toLowerCase()
      ) {
        // Idempotent retry: exact same tick and checksum committed previously
        return {
          success: true,
          idempotent: true,
          result: {
            committed: true,
            tick: currentAnchor.canonicalTick,
            canonicalTick: currentAnchor.canonicalTick,
            checksum: currentAnchor.checksum ?? submission.checkpoint.checksum,
            committedAt: new Date(
              currentAnchor.updatedAtMs || now,
            ).toISOString(),
            chronicleEventIds: [],
          },
        };
      }
      return {
        success: false,
        conflict: true,
        error: `Conflicting checkpoint checksum for existing canonical tick ${currentAnchor.canonicalTick}`,
      };
    }
    if (submission.checkpoint.tick < currentAnchor.canonicalTick) {
      return {
        success: false,
        conflict: true,
        error: `Checkpoint tick (${submission.checkpoint.tick}) must be strictly greater than canonical anchor tick (${currentAnchor.canonicalTick})`,
      };
    }
  }

  // 3. Chronicle events validation and checksum computation
  const rawChronicle = submission.chronicleEvents ?? [];
  if (rawChronicle.length > MAX_CHRONICLE_EVENTS_PER_SUBMISSION) {
    return {
      success: false,
      error: `Chronicle events count (${rawChronicle.length}) exceeds maximum allowed (${MAX_CHRONICLE_EVENTS_PER_SUBMISSION})`,
    };
  }

  const validatedEvents: Array<{
    id: string;
    canonicalTick: number;
    occurredAt: string;
    type: string;
    severity: string;
    description: string;
    tagsJson: string;
    checksum: string;
  }> = [];

  for (const raw of rawChronicle) {
    const val = validateChronicleEvent(raw);
    if (!val.valid) {
      return { success: false, error: `Invalid chronicle event: ${val.error}` };
    }
    const tick = raw.tick ?? submission.checkpoint.tick;
    const occurredAt = raw.timestamp || new Date(now).toISOString();
    const tags = raw.tags ?? [];
    const checksum = await computeChronicleEventChecksum({
      canonicalTick: tick,
      occurredAt,
      type: raw.type,
      severity: raw.severity,
      description: raw.description,
      tags,
    });
    const eventId =
      raw.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `event-${now}-${Math.floor(Math.random() * 100000)}`);
    validatedEvents.push({
      id: eventId,
      canonicalTick: tick,
      occurredAt,
      type: raw.type,
      severity: raw.severity,
      description: raw.description,
      tagsJson: JSON.stringify(tags),
      checksum,
    });
  }

  // 4. Decode payload bytes to ArrayBuffer
  const bytes = base64ToUint8Array(submission.checkpoint.payload);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );

  // 5. Construct atomic D1 batch statements
  const statements: Array<{ query: string; params: unknown[] }> = [];

  // Statement 1: Insert into engine_checkpoints conditioned on active lease & tick > max tick
  statements.push({
    query: `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
            SELECT ?, ?, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM curator_leases
              WHERE id = 1
                AND lease_id = ?
                AND curator_id = ?
                AND expires_at_ms > ?
                AND authorized_tick < ?
            )
            AND NOT EXISTS (
              SELECT 1 FROM engine_checkpoints
              WHERE tick >= ?
            )`,
    params: [
      submission.checkpoint.tick,
      submission.checkpoint.version,
      submission.checkpoint.seed,
      submission.checkpoint.checksum,
      arrayBuffer,
      authContext.leaseId,
      authContext.curatorId,
      now,
      submission.checkpoint.tick,
      submission.checkpoint.tick,
    ],
  });

  // Statement 2: Update canonical_anchor pointer
  const expectedAnchorTick = currentAnchor?.canonicalTick ?? 0;
  statements.push({
    query: `UPDATE canonical_anchor
            SET checkpoint_id = (SELECT id FROM engine_checkpoints WHERE tick = ?),
                canonical_tick = ?,
                checksum = ?,
                updated_at_ms = ?
            WHERE id = 1
              AND (canonical_tick = ? OR (canonical_tick = 0 AND checkpoint_id IS NULL))`,
    params: [
      submission.checkpoint.tick,
      submission.checkpoint.tick,
      submission.checkpoint.checksum,
      now,
      expectedAnchorTick,
    ],
  });

  // Statement 3..N: Insert deduplicated chronicle events
  for (const event of validatedEvents) {
    statements.push({
      query: `INSERT OR IGNORE INTO chronicle_events (id, canonical_tick, occurred_at, type, severity, description, tags_json, checksum, created_at_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        event.id,
        event.canonicalTick,
        event.occurredAt,
        event.type,
        event.severity,
        event.description,
        event.tagsJson,
        event.checksum,
        now,
      ],
    });
  }

  // Statement N+1: Update curator_leases authorized_tick
  statements.push({
    query: `UPDATE curator_leases
            SET authorized_tick = ?, updated_at = datetime('now')
            WHERE id = 1
              AND lease_id = ?
              AND curator_id = ?
              AND expires_at_ms > ?
              AND authorized_tick < ?`,
    params: [
      submission.checkpoint.tick,
      authContext.leaseId,
      authContext.curatorId,
      now,
      submission.checkpoint.tick,
    ],
  });

  // Statement N+2: Record metric
  const bucketStartMs = Math.floor(now / 3600000) * 3600000;
  statements.push({
    query: `INSERT INTO api_metric_buckets (bucket_start_ms, checkpoint_commits)
            VALUES (?, 1)
            ON CONFLICT(bucket_start_ms) DO UPDATE SET checkpoint_commits = checkpoint_commits + 1`,
    params: [bucketStartMs],
  });

  try {
    const batchResults = await executeBatch<any>(db, statements);
    const insertResult = batchResults[0];
    const changes = insertResult?.meta?.changes ?? 0;

    if (changes !== 1) {
      return {
        success: false,
        conflict: true,
        error:
          "Curator lease has expired, was superseded, or a checkpoint with an equal or higher tick has already been persisted",
      };
    }

    // Post-commit pruning (non-blocking errors)
    try {
      await pruneEngineCheckpoints(db, 500);
      await pruneChronicleEvents(db, 10000);
      await pruneApiMetricBuckets(db);
    } catch (pruneErr) {
      console.warn("Failed to prune after checkpoint commit:", pruneErr);
    }

    return {
      success: true,
      result: {
        committed: true,
        tick: submission.checkpoint.tick,
        canonicalTick: submission.checkpoint.tick,
        checksum: submission.checkpoint.checksum,
        committedAt: new Date(now).toISOString(),
        chronicleEventIds: validatedEvents.map((e) => e.id),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function recordApiMetric(
  db: D1Database,
  metricType:
    | "garden_reads"
    | "checkpoint_commits"
    | "rejected_writes"
    | "server_errors",
  nowMs: number = Date.now(),
): Promise<void> {
  const bucketStartMs = Math.floor(nowMs / 3600000) * 3600000;
  await executeQuery(
    db,
    `INSERT INTO api_metric_buckets (bucket_start_ms, ${metricType})
     VALUES (?, 1)
     ON CONFLICT(bucket_start_ms) DO UPDATE SET ${metricType} = ${metricType} + 1`,
    [bucketStartMs],
  );
}

export async function getDiagnosticsSummary(
  db: D1Database,
  nowMs: number = Date.now(),
): Promise<DiagnosticsSummary> {
  const [anchor, latestCheckpoint, metricsRows, activeLease, schemaVersionRow] =
    await Promise.all([
      getCanonicalAnchor(db),
      getLatestEngineCheckpoint(db),
      queryAll<{
        garden_reads: number | null;
        checkpoint_commits: number | null;
        rejected_writes: number | null;
        server_errors: number | null;
      }>(
        db,
        `SELECT SUM(garden_reads) as garden_reads,
              SUM(checkpoint_commits) as checkpoint_commits,
              SUM(rejected_writes) as rejected_writes,
              SUM(server_errors) as server_errors
       FROM api_metric_buckets
       WHERE bucket_start_ms > ?`,
        [nowMs - 24 * 60 * 60 * 1000],
      ),
      hasActiveCuratorLease(db),
      queryFirst<{ value: string }>(
        db,
        "SELECT value FROM system_metadata WHERE key = 'schema_version'",
      ),
    ]);

  const canonicalAgeMs = anchor?.updatedAtMs
    ? Math.max(0, nowMs - anchor.updatedAtMs)
    : 0;
  const lastCommitAgeMs = anchor?.updatedAtMs
    ? Math.max(0, nowMs - anchor.updatedAtMs)
    : null;
  const checkpointByteSize = latestCheckpoint?.byteLength ?? 0;
  const canonicalTick = anchor?.canonicalTick ?? 0;

  const metrics = metricsRows[0] ?? {
    garden_reads: 0,
    checkpoint_commits: 0,
    rejected_writes: 0,
    server_errors: 0,
  };

  return {
    schemaVersion: schemaVersionRow?.value ?? "2.0.0",
    canonicalAgeMs,
    lastCommitAgeMs,
    checkpointByteSize,
    canonicalTick,
    activeCuratorLease: activeLease,
    metrics: {
      gardenReads: metrics.garden_reads ?? 0,
      checkpointCommits: metrics.checkpoint_commits ?? 0,
      rejectedWrites: metrics.rejected_writes ?? 0,
      serverErrors: metrics.server_errors ?? 0,
    },
  };
}

export async function pruneChronicleEvents(
  db: D1Database,
  maxRetained: number = 10000,
  maxAgeMs: number = 180 * 24 * 60 * 60 * 1000,
): Promise<void> {
  const cutoffMs = Date.now() - maxAgeMs;
  await executeQuery(
    db,
    `DELETE FROM chronicle_events
     WHERE created_at_ms < ?
        OR id NOT IN (
          SELECT id FROM chronicle_events
          ORDER BY canonical_tick DESC, created_at_ms DESC
          LIMIT ?
        )`,
    [cutoffMs, maxRetained],
  );
}

export async function pruneApiMetricBuckets(
  db: D1Database,
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000,
): Promise<void> {
  const cutoffMs = Date.now() - maxAgeMs;
  await executeQuery(
    db,
    `DELETE FROM api_metric_buckets WHERE bucket_start_ms < ?`,
    [cutoffMs],
  );
}

export interface GardenStatsBucketRow {
  bucket_tick: number;
  plants: number;
  herbivores: number;
  carnivores: number;
  fungi: number;
  total_living: number;
  total_dead: number;
  temperature: number;
  sunlight: number;
  moisture: number;
}

export async function getGardenStatsBucketed(
  db: D1Database,
  fromTick: number,
  toTick: number,
  bucketSize: number,
): Promise<GardenStatsBucketRow[]> {
  const safeBucket = Math.max(1, bucketSize);
  const rows = await queryAll<GardenStatsBucketRow>(
    db,
    `SELECT (tick / ?) * ? as bucket_tick,
            AVG(plants) as plants,
            AVG(herbivores) as herbivores,
            AVG(carnivores) as carnivores,
            AVG(fungi) as fungi,
            AVG(total_living) as total_living,
            AVG(total_dead) as total_dead,
            AVG(temperature) as temperature,
            AVG(sunlight) as sunlight,
            AVG(moisture) as moisture
     FROM garden_state
     WHERE tick >= ? AND tick <= ?
     GROUP BY bucket_tick
     ORDER BY bucket_tick ASC
     LIMIT 500`,
    [safeBucket, safeBucket, fromTick, toTick],
  );
  return rows;
}
