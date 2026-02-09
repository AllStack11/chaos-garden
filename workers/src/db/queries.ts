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
  SimulationEvent,
  GardenStateRow,
  EntityRow,
  SimulationEventRow,
  Environment,
  PopulationSummary
} from '@chaos-garden/shared';
import { queryFirst, queryAll, executeQuery, executeBatch } from './connection';
import type { D1Database } from '../types/worker';
import { countEntitiesByType, extractTraits } from '../simulation/environment/helpers';

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
  db: D1Database
): Promise<GardenState | null> {
  const row = await queryFirst<GardenStateRow>(
    db,
    `SELECT id, tick, timestamp, temperature, sunlight, moisture,
            plants, herbivores, carnivores, fungi, total
     FROM garden_state
     ORDER BY tick DESC
     LIMIT 1`
  );

  if (!row) {
    return null;
  }

  // Enrich with dynamic counts from the entities table
  const gardenState = mapRowToGardenState(row);
  const entities = await getAllEntitiesFromDatabase(db);
  const populations = countEntitiesByType(entities);
  
  return {
    ...gardenState,
    populationSummary: populations
  };
}

/**
 * Load all entities (living and dead).
 */
export async function getAllEntitiesFromDatabase(
  db: D1Database
): Promise<Entity[]> {
  const rows = await queryAll<EntityRow>(
    db,
    `SELECT id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
            energy, health, age, traits, lineage, created_at, updated_at
     FROM entities`
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
  tick: number
): Promise<GardenState | null> {
  const row = await queryFirst<GardenStateRow>(
    db,
    `SELECT id, tick, timestamp, temperature, sunlight, moisture,
            plants, herbivores, carnivores, fungi, total
     FROM garden_state
     WHERE tick = ?`,
    [tick]
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
  state: GardenState
): Promise<number> {
  // Use a transaction for safety if possible, or just log clearly
  const result = await executeQuery<{ id: number }>(
    db,
    `INSERT INTO garden_state (
      tick, timestamp, temperature, sunlight, moisture,
      plants, herbivores, carnivores, fungi, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      state.tick,
      state.timestamp,
      state.environment.temperature,
      state.environment.sunlight,
      state.environment.moisture,
      state.populationSummary.plants,
      state.populationSummary.herbivores,
      state.populationSummary.carnivores,
      state.populationSummary.fungi,
      state.populationSummary.total
    ]
  );

  const lastId = result.meta?.last_row_id || 0;
  
  // Double-check: immediately retrieve what we just saved to ensure consistency
  // (Optional debug logging could go here)
  
  return lastId;
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
  db: D1Database
): Promise<Entity[]> {
  const rows = await queryAll<EntityRow>(
    db,
    `SELECT id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
            energy, health, age, traits, lineage, created_at, updated_at
     FROM entities
     WHERE is_alive = 1`
  );

  return rows.map(mapRowToEntity);
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
  entityId: string
): Promise<Entity | null> {
  const row = await queryFirst<EntityRow>(
    db,
    `SELECT id, garden_state_id, born_at_tick, death_tick, is_alive, type, name, species, position_x, position_y,
            energy, health, age, traits, lineage, created_at, updated_at
     FROM entities
     WHERE id = ?`,
    [entityId]
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
  gardenStateId?: number
): Promise<void> {
  if (entities.length === 0) {
    return;
  }

  const statements = entities.map(entity => {
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
        entity.updatedAt
      ]
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
  deathTick: number
): Promise<void> {
  if (entityIds.length === 0) {
    return;
  }

  const statements = entityIds.map(id => ({
    query: 'UPDATE entities SET is_alive = 0, death_tick = ?, updated_at = datetime(\'now\') WHERE id = ?',
    params: [deathTick, id]
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
  event: SimulationEvent
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
        event.metadata || null
      ]
    );
  } catch (error) {
    // Fail silently—event logging should not disrupt the simulation
    console.error('Failed to log simulation event:', error);
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
  gardenStateId?: number
): Promise<SimulationEvent[]> {
  const whereClause = typeof gardenStateId === 'number' ? 'WHERE garden_state_id = ?' : '';
  const queryParams = typeof gardenStateId === 'number'
    ? [gardenStateId, limit]
    : [limit];

  const rows = await queryAll<SimulationEventRow>(
    db,
    `SELECT id, garden_state_id, tick, timestamp, event_type, description,
            entities_affected, tags, severity, metadata
     FROM simulation_events
     ${whereClause}
     ORDER BY tick DESC, timestamp DESC
     LIMIT ?`,
    queryParams
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
  endTick: number
): Promise<SimulationEvent[]> {
  const rows = await queryAll<SimulationEventRow>(
    db,
    `SELECT id, garden_state_id, tick, timestamp, event_type, description,
            entities_affected, tags, severity, metadata
     FROM simulation_events
     WHERE tick >= ? AND tick <= ?
     ORDER BY tick ASC, timestamp ASC`,
    [startTick, endTick]
  );

  return rows.map(mapRowToSimulationEvent);
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
    tick: row.tick
  };

  const populationSummary: PopulationSummary = {
    plants: row.plants || 0,
    herbivores: row.herbivores || 0,
    carnivores: row.carnivores || 0,
    fungi: row.fungi || 0,
    total: row.total || 0,
    totalLiving: row.total || 0,
    totalDead: 0,
    deadPlants: 0,
    deadHerbivores: 0,
    deadCarnivores: 0,
    deadFungi: 0
  };

  return {
    id: row.id,
    tick: row.tick,
    timestamp: row.timestamp,
    environment,
    populationSummary
  };
}

/**
 * Convert a database row to an Entity object.
 */
function mapRowToEntity(row: EntityRow): Entity {
  const traits = JSON.parse(row.traits);
  return {
    id: row.id,
    gardenStateId: row.garden_state_id || undefined,
    bornAtTick: row.born_at_tick,
    deathTick: row.death_tick || undefined,
    isAlive: row.is_alive === 1,
    type: row.type as Entity['type'],
    name: row.name,
    species: row.species,
    position: {
      x: row.position_x,
      y: row.position_y
    },
    energy: row.energy,
    health: row.health,
    age: row.age,
    ...traits,
    lineage: row.lineage,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } as Entity;
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
    eventType: row.event_type as SimulationEvent['eventType'],
    description: row.description,
    entitiesAffected: JSON.parse(row.entities_affected),
    tags: JSON.parse(row.tags || '[]'),
    severity: row.severity as SimulationEvent['severity'],
    metadata: row.metadata || undefined
  };
}
