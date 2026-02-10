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

import type { Entity } from '@chaos-garden/shared';
import type { D1Database } from '../../types/worker';
import {
  createEventLogger,
  createBufferedEventLogger,
  createConsoleEventLogger,
  createCompositeEventLogger,
  type EventLogger
} from '../../logging/event-logger';
import type { ApplicationLogger } from '../../logging/application-logger';
import {
  createTimestamp,
  countEntitiesByType
} from '../environment/helpers';
import { applyEnvironmentalEffectsToCreature } from '../environment/creature-effects';
import { updateEnvironmentForNextTick } from '../environment';
import {
  getPlantCauseOfDeath
} from '../creatures/plants';
import {
  getHerbivoreCauseOfDeath
} from '../creatures/herbivores';
import {
  getCarnivoreCauseOfDeath
} from '../creatures/carnivores';
import {
  getFungusCauseOfDeath
} from '../creatures/fungi';
import {
  getGardenStateByTickFromDatabase,
  getLatestGardenStateFromDatabase,
  getAllLivingEntitiesFromDatabase,
  getAllDecomposableDeadEntitiesFromDatabase,
  deleteSimulationEventsByTickFromDatabase
} from '../../db/queries';
import {
  getLastCompletedTick,
  releaseSimulationLock,
  setLastCompletedTick,
  tryAcquireSimulationLock
} from '../../db/simulation-control';
import { maybeSpawnWildFungus } from './tickHelpers/maybeSpawnWildFungus';
import { processEntitiesForTick } from './tickHelpers/processEntitiesForTick';
import { filterDeadEntities } from './tickHelpers/filterDeadEntities';
import { getCurrentDeadEntitiesInGarden } from './tickHelpers/getCurrentDeadEntitiesInGarden';
import { applyAllTimeDeadSummary } from './tickHelpers/applyAllTimeDeadSummary';
import { createAndSaveGardenState } from './tickHelpers/createAndSaveGardenState';
import { saveEntitiesAndCleanup } from './tickHelpers/saveEntitiesAndCleanup';
import { logPopulationChanges } from './tickHelpers/logPopulationChanges';

type TickSkipReason = 'already_processed' | 'lock_unavailable';

export interface RunSimulationTickResult {
  executed: boolean;
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
  skipReason?: TickSkipReason;
}

// ==========================================
// Simulation Orchestration
// ==========================================

/**
 * Run one complete simulation tick.
 * This is the master conductor of the symphony of life.
 * 
 * @param db - D1 database instance
 * @param appLogger - Application logger for system observability
 * @param isDevelopment - Whether the simulation is running in a development environment
 * @returns The result of the simulation tick
 */
export async function runSimulationTick(
  db: D1Database,
  appLogger: ApplicationLogger,
  isDevelopment: boolean = false
): Promise<RunSimulationTickResult> {
  const startTime = Date.now();
  const metrics: Record<string, number> = {};
  const lockTtlMs = 120000;
  let lockOwnerId: string | null = null;
  let hasAcquiredLock = false;
  
  try {
    await appLogger.info('tick_start', 'Beginning simulation tick');
    
    // 1. Load latest state for baseline observability.
    const stateLoadStart = Date.now();
    const latestState = await getLatestGardenStateFromDatabase(db);
    if (!latestState) {
      await appLogger.error('tick_error', 'No garden state found - cannot run tick');
      throw new Error('No garden state found');
    }
    metrics.load_state_duration = Date.now() - stateLoadStart;

    const preLockLastCompletedTick = await getLastCompletedTick(db);
    const requestedTickNumber = preLockLastCompletedTick + 1;
    lockOwnerId = `${requestedTickNumber}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const lockAcquired = await tryAcquireSimulationLock(db, lockOwnerId, Date.now(), lockTtlMs);
    if (!lockAcquired) {
      const duration = Date.now() - startTime;
      await appLogger.info('tick_skipped', `Skipping tick ${requestedTickNumber}: lock unavailable`, {
        tick: requestedTickNumber,
        reason: 'lock_unavailable',
        duration
      });

      return {
        executed: false,
        skipReason: 'lock_unavailable',
        tickNumber: requestedTickNumber,
        duration,
        newEntities: 0,
        deaths: 0,
        populations: latestState.populationSummary
      };
    }
    hasAcquiredLock = true;

    const lockedLastCompletedTick = await getLastCompletedTick(db);
    const lockedPreviousState = await getGardenStateByTickFromDatabase(db, lockedLastCompletedTick);
    if (!lockedPreviousState) {
      await appLogger.error('tick_error', 'No completed garden state found after lock acquisition', {
        lastCompletedTick: lockedLastCompletedTick
      });
      throw new Error(`No completed garden state found for tick ${lockedLastCompletedTick}`);
    }

    const tickNumber = lockedLastCompletedTick + 1;
    if (lockedLastCompletedTick >= requestedTickNumber) {
      const duration = Date.now() - startTime;
      await appLogger.info('tick_skipped', `Skipping tick ${tickNumber}: already completed`, {
        requestedTick: tickNumber,
        lastCompletedTick: lockedLastCompletedTick,
        reason: 'already_processed',
        duration
      });

      return {
        executed: false,
        skipReason: 'already_processed',
        tickNumber,
        duration,
        newEntities: 0,
        deaths: 0,
        populations: lockedPreviousState.populationSummary
      };
    }
    await appLogger.info('tick_progress', `Starting tick ${tickNumber}`, { previousTick: lockedPreviousState.tick });
    
    // 2. Create buffered event logger for this tick.
    // In development, mirror events to console immediately while still buffering for DB persistence.
    const bufferedEventLogger = createBufferedEventLogger();
    let eventLogger: EventLogger = bufferedEventLogger.logger;
    
    if (isDevelopment) {
      const consoleLogger = createConsoleEventLogger(tickNumber, lockedPreviousState.id);
      eventLogger = createCompositeEventLogger([bufferedEventLogger.logger, consoleLogger]);
    }
    
    // 3. Update environment
    const envUpdateStart = Date.now();
    const updatedEnvironment = await updateEnvironmentForNextTick(lockedPreviousState.environment, eventLogger);
    metrics.environment_update_duration = Date.now() - envUpdateStart;
    
    await appLogger.debug('environment_updated', 'Environment updated for new tick', {
      temperature: updatedEnvironment.temperature,
      sunlight: updatedEnvironment.sunlight,
      moisture: updatedEnvironment.moisture
    });
    
    // 4. Load all living entities
    const entityLoadStart = Date.now();
    const livingEntities = await getAllLivingEntitiesFromDatabase(db);
    const decomposableDeadEntities = await getAllDecomposableDeadEntitiesFromDatabase(db);
    metrics.load_entities_duration = Date.now() - entityLoadStart;
    
    await appLogger.debug('entities_loaded', `Loaded ${livingEntities.length} entities`, {
      entityCount: livingEntities.length
    });

    // Age all currently living entities exactly once per tick.
    for (const entity of livingEntities) {
      entity.age += 1;
      applyEnvironmentalEffectsToCreature(entity, updatedEnvironment);
    }

    // Wild spores occasionally drift in and germinate anywhere on the map.
    const wildFungus = await maybeSpawnWildFungus(lockedPreviousState.id, eventLogger, appLogger);
    if (wildFungus) {
      livingEntities.push(wildFungus);
    }
    
    // 5. Process entities 
    const processingStart = Date.now();
    const processingResult = await processEntitiesForTick(
      livingEntities,
      decomposableDeadEntities,
      updatedEnvironment,
      eventLogger,
      appLogger
    );
    metrics.processing_duration = Date.now() - processingStart;
    
    // 6. Filter dead entities and log their passing
    const deadEntities = filterDeadEntities(livingEntities);
    for (const dead of deadEntities) {
      let cause = 'unknown cause';
      if (dead.type === 'plant') cause = getPlantCauseOfDeath(dead);
      else if (dead.type === 'herbivore') cause = getHerbivoreCauseOfDeath(dead);
      else if (dead.type === 'carnivore') cause = getCarnivoreCauseOfDeath(dead);
      else if (dead.type === 'fungus') cause = getFungusCauseOfDeath(dead);
      
      await eventLogger.logDeath(dead, cause);
    }
    
    // Create the next generation: survivors + new births
    const stillLivingEntities = livingEntities.filter(entity => !deadEntities.includes(entity));
    const allLivingEntitiesAfterTick = [...stillLivingEntities, ...processingResult.newEntities];
    const currentDeadEntitiesInGarden = getCurrentDeadEntitiesInGarden(
      deadEntities,
      decomposableDeadEntities
    );
    const allEntitiesAfterTick = [...allLivingEntitiesAfterTick, ...currentDeadEntitiesInGarden];
    const previousPopulations = lockedPreviousState.populationSummary;
    const newPopulations = countEntitiesByType(allEntitiesAfterTick);
    applyAllTimeDeadSummary(
      newPopulations,
      previousPopulations,
      deadEntities
    );

    // Ensure all living entities are updated for this tick
    for (const entity of allLivingEntitiesAfterTick) {
      entity.updatedAt = createTimestamp();
    }
    
    // 7. Log population changes and ambient narrative to the buffered logger
    await logPopulationChanges(
      tickNumber,
      previousPopulations,
      newPopulations,
      eventLogger
    );

    // 8. Generate ambient narrative (guarantees at least one narrative event per tick)
    await eventLogger.logAmbientNarrative(updatedEnvironment, newPopulations, allLivingEntitiesAfterTick);

    // 9. Persist state/entity/event updates.
    const persistenceStart = Date.now();
    const stateSaveStart = Date.now();
    const savedGardenState = await createAndSaveGardenState(
      db,
      tickNumber,
      updatedEnvironment,
      newPopulations,
      appLogger
    );
    metrics.save_state_duration = Date.now() - stateSaveStart;

    const entitySaveStart = Date.now();
    await saveEntitiesAndCleanup(
      db,
      savedGardenState.id,
      tickNumber,
      processingResult.newEntities,
      deadEntities,
      stillLivingEntities,
      processingResult.updatedDeadEntities,
      appLogger
    );
    metrics.save_entities_duration = Date.now() - entitySaveStart;

    // Reruns of an interrupted tick should replace prior partial event logs.
    await deleteSimulationEventsByTickFromDatabase(db, tickNumber);
    const dbEventLogger = createEventLogger(db, tickNumber, savedGardenState.id);
    await bufferedEventLogger.flushTo(dbEventLogger);
    await setLastCompletedTick(db, tickNumber);

    metrics.persistence_duration = Date.now() - persistenceStart;

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
      executed: true,
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
  } finally {
    if (hasAcquiredLock && lockOwnerId) {
      try {
        await releaseSimulationLock(db, lockOwnerId);
      } catch (releaseError) {
        await appLogger.error('tick_lock_release_failed', 'Failed to release simulation lock', {
          lockOwnerId,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError)
        });
      }
    }
  }
}
