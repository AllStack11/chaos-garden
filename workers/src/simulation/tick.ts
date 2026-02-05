/**
 * Core Tick Loop
 * 
 * The heartbeat of the Chaos Garden simulation.
 * Orchestrates a complete simulation cycle—the grand dance
 * of life, death, and transformation in our digital ecosystem.
 * 
 * This function is called every 15 minutes by Cron trigger
 * and can also be invoked manually via API.
 * It must be idempotent—running it twice produces the same result.
 */

import type { Entity, GardenState, Environment, PopulationSummary } from '@chaos-garden/shared';
import type { D1Database } from '../types/worker';
import { createEventLogger, type EventLogger } from '../logging/event-logger';
import type { ApplicationLogger } from '../logging/application-logger';
import {
  createTimestamp,
  countEntitiesByType
} from './environment/helpers';
import { updateEnvironmentForNextTick } from './environment';
import { processPlantBehaviorDuringTick, isPlantDead, getPlantCauseOfDeath } from './creatures/plants';
import { processHerbivoreBehaviorDuringTick, isHerbivoreDead, getHerbivoreCauseOfDeath } from './creatures/herbivores';
import {
  getLatestGardenStateFromDatabase,
  saveGardenStateToDatabase,
  getAllEntitiesFromDatabase,
  getAllLivingEntitiesFromDatabase,
  saveEntitiesToDatabase,
  markEntitiesAsDeadInDatabase
} from '../db/queries';

// ==========================================
// Simulation Orchestration
// ==========================================

/**
 * Run one complete simulation tick.
 * This is the master conductor of the symphony of life.
 * 
 * @param db - D1 database instance
 * @param appLogger - Application logger for system observability
 * @returns The result of the simulation tick
 */
export async function runSimulationTick(
  db: D1Database,
  appLogger: ApplicationLogger
): Promise<{
  tickNumber: number;
  duration: number;
  newEntities: number;
  deaths: number;
  populations: {
    plants: number;
    herbivores: number;
    carnivores: number;
    fungi: number;
    total: number;
  };
}> {
  const startTime = Date.now();
  const metrics: Record<string, number> = {};
  
  try {
    await appLogger.info('tick_start', 'Beginning simulation tick');
    
    // 1. Load current state
    const stateLoadStart = Date.now();
    const previousState = await getLatestGardenStateFromDatabase(db);
    if (!previousState) {
      await appLogger.error('tick_error', 'No garden state found - cannot run tick');
      throw new Error('No garden state found');
    }
    metrics.load_state_duration = Date.now() - stateLoadStart;
    
    const tickNumber = previousState.tick + 1;
    await appLogger.info('tick_progress', `Starting tick ${tickNumber}`, { previousTick: previousState.tick });
    
    // 2. Create event logger for this tick (Placeholder ID, updated after state save)
    const eventLogger = createEventLogger(db, tickNumber, previousState.id);
    
    // 3. Update environment
    const envUpdateStart = Date.now();
    const updatedEnvironment = updateEnvironmentForNextTick(previousState.environment, eventLogger);
    metrics.environment_update_duration = Date.now() - envUpdateStart;
    
    await appLogger.debug('environment_updated', 'Environment updated for new tick', {
      temperature: updatedEnvironment.temperature,
      sunlight: updatedEnvironment.sunlight,
      moisture: updatedEnvironment.moisture
    });
    
    // 4. Load all living entities
    const entityLoadStart = Date.now();
    const livingEntities = await getAllLivingEntitiesFromDatabase(db);
    metrics.load_entities_duration = Date.now() - entityLoadStart;
    
    await appLogger.debug('entities_loaded', `Loaded ${livingEntities.length} entities`, {
      entityCount: livingEntities.length
    });
    
    // 5. Process entities (plants → herbivores)
    const processingStart = Date.now();
    const processingResult = await processEntitiesForTick(
      livingEntities,
      updatedEnvironment,
      eventLogger,
      appLogger
    );
    metrics.processing_duration = Date.now() - processingStart;
    
    // 6. Filter dead entities and log their passing
    const deadEntities = filterDeadEntities(livingEntities);
    for (const dead of deadEntities) {
      const cause = dead.type === 'plant' ? getPlantCauseOfDeath(dead) : getHerbivoreCauseOfDeath(dead);
      await eventLogger.logDeath(dead, cause);
    }
    
    // Create the next generation: survivors + new births
    const stillLivingEntities = livingEntities.filter(entity => !deadEntities.includes(entity));
    const allLivingEntitiesAfterTick = [...stillLivingEntities, ...processingResult.newEntities];

    // Ensure all living entities are updated for this tick
    for (const entity of allLivingEntitiesAfterTick) {
      entity.age += 1;
      entity.updatedAt = createTimestamp();
    }
    
    // 7. Save new garden state
    const stateSaveStart = Date.now();
    const newGardenState = await createAndSaveGardenState(
      db,
      tickNumber,
      updatedEnvironment,
      allLivingEntitiesAfterTick,
      appLogger
    );
    metrics.save_state_duration = Date.now() - stateSaveStart;

    // Update event logger with the real garden state ID
    (eventLogger as any).gardenStateId = newGardenState.id;
    
    // 8. Save updated entities and mark dead ones
    const entitySaveStart = Date.now();
    await saveEntitiesAndCleanup(
      db,
      newGardenState.id,
      tickNumber,
      processingResult.newEntities,
      deadEntities,
      stillLivingEntities,
      appLogger
    );
    metrics.save_entities_duration = Date.now() - entitySaveStart;
    
    // 9. Log population changes
    const previousPopulations = previousState.populationSummary;
    const currentEntities = await getAllEntitiesFromDatabase(db);
    const newPopulations = countEntitiesByType(currentEntities);
    
    await logPopulationChanges(
      db,
      tickNumber,
      previousPopulations,
      newPopulations,
      eventLogger
    );
    
    const duration = Date.now() - startTime;
    metrics.total_duration = duration;
    
    await appLogger.info('tick_complete', `Tick ${tickNumber} completed in ${duration}ms`, {
      tick: tickNumber,
      metrics,
      summary: {
        newEntities: processingResult.newEntities.length,
        deaths: deadEntities.length,
        populations: newPopulations
      }
    });
    
    return {
      tickNumber,
      duration,
      newEntities: processingResult.newEntities.length,
      deaths: deadEntities.length,
      populations: newPopulations
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    await appLogger.error('tick_failed', `Tick failed after ${duration}ms`, {
      error: error instanceof Error ? error.message : String(error),
      duration
    });
    throw error;
  }
}

// ==========================================
// Entity Processing
// ==========================================

/**
 * Process all entities for one tick.
 * Order matters: plants first (create energy), then herbivores (consume plants).
 */
async function processEntitiesForTick(
  entities: Entity[],
  environment: Environment,
  eventLogger: EventLogger,
  appLogger: ApplicationLogger
): Promise<{
  newEntities: Entity[];
  consumedPlantIds: string[];
}> {
  const newEntities: Entity[] = [];
  const consumedPlantIds: string[] = [];
  
  // Separate entities by type
  const plants = entities.filter(e => e.type === 'plant');
  const herbivores = entities.filter(e => e.type === 'herbivore');
  
  // Process plants first (they create energy)
  for (const plant of plants) {
    const offspring = processPlantBehaviorDuringTick(plant, environment, eventLogger);
    // Link offspring to parent for lineage
    for (const child of offspring) {
      child.lineage = plant.id;
    }
    newEntities.push(...offspring);
    
    // Log plant death if applicable
    if (isPlantDead(plant)) {
      await appLogger.debug('plant_death', `Plant ${plant.id.substring(0, 8)} died`, {
        plantId: plant.id,
        age: plant.age,
        energy: plant.energy,
        health: plant.health,
        cause: getPlantCauseOfDeath(plant)
      });
    }
  }
  
  // Process herbivores (they consume plants)
  for (const herbivore of herbivores) {
    const result = processHerbivoreBehaviorDuringTick(herbivore, environment, plants, eventLogger);
    // Link offspring to parent for lineage
    for (const child of result.offspring) {
      child.lineage = herbivore.id;
    }
    newEntities.push(...result.offspring);
    consumedPlantIds.push(...result.consumed);
    
    // Log herbivore death if applicable
    if (isHerbivoreDead(herbivore)) {
      await appLogger.debug('herbivore_death', `Herbivore ${herbivore.id.substring(0, 8)} died`, {
        herbivoreId: herbivore.id,
        age: herbivore.age,
        energy: herbivore.energy,
        health: herbivore.health,
        cause: getHerbivoreCauseOfDeath(herbivore)
      });
    }
  }
  
  return { newEntities, consumedPlantIds };
}

/**
 * Filter out dead entities from the array.
 */
function filterDeadEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => {
    if (entity.type === 'plant') return isPlantDead(entity);
    if (entity.type === 'herbivore') return isHerbivoreDead(entity);
    return false; // Future types will be added here
  });
}

// ==========================================
// State Management
// ==========================================

/**
 * Create and save a new garden state to the database.
 * 
 * @param db - D1 database instance
 * @param tickNumber - Current tick number
 * @param environment - Updated environment conditions
 * @param allLivingEntities - Complete list of entities currently alive (including new offspring)
 * @param appLogger - Application logger
 */
async function createAndSaveGardenState(
  db: D1Database,
  tickNumber: number,
  environment: Environment,
  allLivingEntities: Entity[],
  appLogger: ApplicationLogger
): Promise<GardenState> {
  const populations = countEntitiesByType(allLivingEntities);
  
  const gardenState: Omit<GardenState, 'id'> = {
    tick: tickNumber,
    timestamp: createTimestamp(),
    environment,
    populationSummary: populations
  };
  
  const stateId = await saveGardenStateToDatabase(db, gardenState as GardenState);
  await appLogger.debug('state_saved', `Garden state saved with ID ${stateId}`, {
    tick: tickNumber,
    stateId
  });
  
  return {
    ...gardenState,
    id: stateId
  } as GardenState;
}

/**
 * Save new entities and update existing ones.
 * Also marks dead entities in the database.
 */
async function saveEntitiesAndCleanup(
  db: D1Database,
  gardenStateId: number,
  tickNumber: number,
  newEntities: Entity[],
  deadEntities: Entity[],
  livingEntities: Entity[],
  appLogger: ApplicationLogger
): Promise<void> {
  // 1. Prepare new entities for the world
  for (const entity of newEntities) {
    entity.bornAtTick = tickNumber;
    entity.gardenStateId = gardenStateId;
  }

  // 2. Save all entities (new offspring + updated living ones)
  const entitiesToSave = [...newEntities, ...livingEntities];
  await saveEntitiesToDatabase(db, entitiesToSave);
  
  await appLogger.debug('entities_saved', `Saved ${entitiesToSave.length} entities at tick ${tickNumber}`, {
    newCount: newEntities.length,
    livingCount: livingEntities.length,
    totalSaved: entitiesToSave.length
  });
  
  // 3. Mark dead entities
  const deadEntityIds = deadEntities.map(e => e.id);
  await markEntitiesAsDeadInDatabase(db, deadEntityIds, tickNumber);
  await appLogger.debug('dead_marked', `Marked ${deadEntities.length} entities as dead`, {
    deadCount: deadEntities.length
  });
}

// ==========================================
// Event Logging
// ==========================================


/**
 * Log significant population changes between ticks.
 */
async function logPopulationChanges(
  db: D1Database,
  tickNumber: number,
  previous: PopulationSummary,
  current: PopulationSummary,
  eventLogger: EventLogger
): Promise<void> {
  // Check for extinction
  if (previous.plants > 0 && current.plants === 0) {
    await eventLogger.logExtinction('plants', 'plant');
  }
  if (previous.herbivores > 0 && current.herbivores === 0) {
    await eventLogger.logExtinction('herbivores', 'herbivore');
  }
  
  // Check for ecosystem collapse
  if (current.total < 10 && previous.total >= 10) {
    await eventLogger.logEcosystemCollapse(current.total);
  }
  
  // Check for population explosions (300% growth)
  const checkExplosion = (type: string, previousCount: number, currentCount: number) => {
    if (previousCount > 0 && currentCount >= previousCount * 3) {
      eventLogger.logPopulationExplosion(type as any, currentCount);
    }
  };
  
  checkExplosion('plants', previous.plants, current.plants);
  checkExplosion('herbivores', previous.herbivores, current.herbivores);

  // Log population deltas if significant
  const plantDelta = current.plants - previous.plants;
  const herbivoreDelta = current.herbivores - previous.herbivores;

  if (Math.abs(plantDelta) > 5 || Math.abs(herbivoreDelta) > 2) {
    await eventLogger.logCustom(
      'POPULATION_DELTA',
      `Population shift: Plants (${plantDelta > 0 ? '+' : ''}${plantDelta}), Herbivores (${herbivoreDelta > 0 ? '+' : ''}${herbivoreDelta})`,
      [],
      'LOW',
      { plantDelta, herbivoreDelta, total: current.total }
    );
  }
}
