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

import type { Entity, DeadMatter } from '@chaos-garden/shared';
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
  countEntitiesByType,
  willRandomEventOccur,
  DEFAULT_SIMULATION_CONFIG
} from '../environment/helpers';
import { applyEnvironmentalEffectsToCreature } from '../environment/creature-effects';
import { updateEnvironmentForNextTick } from '../environment';
import { getPlantCauseOfDeath } from '../creatures/plants';
import { getHerbivoreCauseOfDeath } from '../creatures/herbivores';
import { getCarnivoreCauseOfDeath } from '../creatures/carnivores';
import { getFungusCauseOfDeath } from '../creatures/fungi';
import {
  getGardenStateByTickFromDatabase,
  getLatestGardenStateFromDatabase,
  getAllLivingEntitiesFromDatabase,
  getDeadMatterFromDatabase,
  createDeadMatterBatchInDatabase,
  updateDeadMatterEnergyBatchInDatabase,
  deleteDeadMatterBatchInDatabase,
  deleteEntitiesByIdsFromDatabase,
  purgeExpiredDeadMatterFromDatabase,
  pruneOldGardenStatesFromDatabase,
  deleteSimulationEventsByTickFromDatabase
} from '../../db/queries';
import {
  getLastCompletedTick,
  releaseSimulationLock,
  setLastCompletedTick,
  tryAcquireSimulationLock
} from '../../db/simulation-control';
import { maybeSpawnWildFungus } from './tickHelpers/maybeSpawnWildFungus';
import { maybeSpawnWildCarnivore } from './tickHelpers/maybeSpawnWildCarnivore';
import { maybeSpawnWildHerbivores } from './tickHelpers/maybeSpawnWildHerbivores';
import { maybeSpawnWildPlants } from './tickHelpers/maybeSpawnWildPlants';
import { processEntitiesForTick } from './tickHelpers/processEntitiesForTick';
import { filterDeadEntities } from './tickHelpers/filterDeadEntities';
import { applyAllTimeDeadSummary } from './tickHelpers/applyAllTimeDeadSummary';
import { createAndSaveGardenState } from './tickHelpers/createAndSaveGardenState';
import { saveEntitiesAndCleanup } from './tickHelpers/saveEntitiesAndCleanup';
import { logPopulationChanges } from './tickHelpers/logPopulationChanges';

// Minimum energy an entity must have at death to leave a dead_matter row.
// Starvation deaths (energy = 0) don't create a corpse — nothing to decompose.
const DEAD_MATTER_MIN_ENERGY = 5;

// Dead matter rows older than this many ticks are purged regardless of decomposition.
// 30 ticks × 15 min = 7.5 hours.
const DEAD_MATTER_TTL_TICKS = 30;

// How many ticks of garden_state (and cascade-linked simulation_events) to retain.
// 1000 ticks ≈ 10.4 days — safely covers the max analytics window (500 ticks).
// Older rows are deleted each tick; ON DELETE CASCADE handles simulation_events.
const GARDEN_STATE_RETENTION_TICKS = 1000;

type TickSkipReason = 'already_processed' | 'lock_unavailable';

function enforcePopulationCaps(entities: Entity[]): Entity[] {
  const plants: Entity[] = [];
  const herbivores: Entity[] = [];
  const carnivores: Entity[] = [];
  const fungi: Entity[] = [];
  const maxFungi = DEFAULT_SIMULATION_CONFIG.maxTotalEntities
    - DEFAULT_SIMULATION_CONFIG.maxPlants
    - DEFAULT_SIMULATION_CONFIG.maxHerbivores
    - DEFAULT_SIMULATION_CONFIG.maxCarnivores;

  // Sort youngest-first so overflow culls remove the oldest (post-reproductive)
  // individuals first, keeping the reproductively active cohort alive.
  const sorted = [...entities].sort((a, b) => b.bornAtTick - a.bornAtTick);

  for (const e of sorted) {
    if (e.type === 'plant' && plants.length < DEFAULT_SIMULATION_CONFIG.maxPlants) plants.push(e);
    else if (e.type === 'herbivore' && herbivores.length < DEFAULT_SIMULATION_CONFIG.maxHerbivores) herbivores.push(e);
    else if (e.type === 'carnivore' && carnivores.length < DEFAULT_SIMULATION_CONFIG.maxCarnivores) carnivores.push(e);
    else if (e.type === 'fungus' && fungi.length < maxFungi) fungi.push(e);
  }

  return [...plants, ...herbivores, ...carnivores, ...fungi];
}

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
  const AMBIENT_EVENT_PROBABILITY = 0.5;

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
        tick: requestedTickNumber, reason: 'lock_unavailable', duration
      });
      return {
        executed: false, skipReason: 'lock_unavailable',
        tickNumber: requestedTickNumber, duration,
        newEntities: 0, deaths: 0, populations: latestState.populationSummary
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
        requestedTick: tickNumber, lastCompletedTick: lockedLastCompletedTick,
        reason: 'already_processed', duration
      });
      return {
        executed: false, skipReason: 'already_processed',
        tickNumber, duration, newEntities: 0, deaths: 0,
        populations: lockedPreviousState.populationSummary
      };
    }
    await appLogger.info('tick_progress', `Starting tick ${tickNumber}`, { previousTick: lockedPreviousState.tick });

    // 2. Create buffered event logger.
    const bufferedEventLogger = createBufferedEventLogger();
    let eventLogger: EventLogger = bufferedEventLogger.logger;
    if (isDevelopment) {
      const consoleLogger = createConsoleEventLogger(tickNumber, lockedPreviousState.id);
      eventLogger = createCompositeEventLogger([bufferedEventLogger.logger, consoleLogger]);
    }

    // 3. Update environment.
    const envUpdateStart = Date.now();
    const updatedEnvironment = await updateEnvironmentForNextTick(lockedPreviousState.environment, eventLogger);
    metrics.environment_update_duration = Date.now() - envUpdateStart;
    await appLogger.debug('environment_updated', 'Environment updated for new tick', {
      temperature: updatedEnvironment.temperature,
      sunlight: updatedEnvironment.sunlight,
      moisture: updatedEnvironment.moisture
    });

    // 4. Load living entities and current dead matter.
    const entityLoadStart = Date.now();
    const allLoadedEntities = await getAllLivingEntitiesFromDatabase(db);
    const deadMatter = await getDeadMatterFromDatabase(db);
    metrics.load_entities_duration = Date.now() - entityLoadStart;

    // Hard-cull overflowing living populations back to configured caps.
    // enforcePopulationCaps sorts youngest-first so surplus culls remove the
    // oldest (likely post-reproductive) individuals, preserving active breeders.
    const livingEntities = enforcePopulationCaps(allLoadedEntities);
    const livingEntityIdSet = new Set(livingEntities.map(e => e.id));
    const culledEntityIds = allLoadedEntities
      .filter(e => !livingEntityIdSet.has(e.id))
      .map(e => e.id);

    if (culledEntityIds.length > 0) {
      await appLogger.info('population_culled', `Culled ${culledEntityIds.length} excess entities from DB`, {
        before: allLoadedEntities.length, after: livingEntities.length
      });
      await deleteEntitiesByIdsFromDatabase(db, culledEntityIds);
    }

    await appLogger.debug('entities_loaded', `Loaded ${livingEntities.length} living, ${deadMatter.length} dead matter`, {
      livingCount: livingEntities.length, deadMatterCount: deadMatter.length
    });

    // Age and apply environmental effects to all living entities.
    for (const entity of livingEntities) {
      entity.age += 1;
      applyEnvironmentalEffectsToCreature(entity, updatedEnvironment);
    }

    // Snapshot counts before any wild spawning so each spawner sees pre-spawn state.
    // This prevents a single tick from simultaneously recovering multiple trophic levels:
    // plants recover first, then herbivores can follow on a later tick.
    const plantCount = livingEntities.filter(e => e.type === 'plant').length;
    const herbivoreCount = livingEntities.filter(e => e.type === 'herbivore').length;
    const carnivoreCount = livingEntities.filter(e => e.type === 'carnivore').length;
    const fungiCount = livingEntities.filter(e => e.type === 'fungus').length;

    // If fungi went extinct, wild spores may germinate to restore decomposition.
    const wildFungi = await maybeSpawnWildFungus(lockedPreviousState.id, fungiCount, eventLogger, appLogger);
    livingEntities.push(...wildFungi);

    // If plants went extinct, seeds may blow in from outside the garden.
    const wildPlants = await maybeSpawnWildPlants(lockedPreviousState.id, plantCount, eventLogger, appLogger);
    livingEntities.push(...wildPlants);

    // If herbivores went extinct, wanderers may migrate in while plants remain.
    const wildHerbivores = await maybeSpawnWildHerbivores(
      lockedPreviousState.id, herbivoreCount, plantCount, eventLogger, appLogger
    );
    livingEntities.push(...wildHerbivores);

    // If carnivores went extinct, a wild predator may emerge to restore the food chain.
    const wildCarnivore = await maybeSpawnWildCarnivore(
      lockedPreviousState.id, carnivoreCount, herbivoreCount, eventLogger, appLogger
    );
    if (wildCarnivore) livingEntities.push(wildCarnivore);

    // 5. Process all entities for this tick.
    const processingStart = Date.now();
    const processingResult = await processEntitiesForTick(
      livingEntities,
      deadMatter,
      updatedEnvironment,
      eventLogger,
      appLogger
    );
    metrics.processing_duration = Date.now() - processingStart;

    // 6. Identify and log deaths.
    const deadEntities = filterDeadEntities(livingEntities);
    for (const dead of deadEntities) {
      let cause = 'unknown cause';
      if (dead.type === 'plant') cause = getPlantCauseOfDeath(dead);
      else if (dead.type === 'herbivore') cause = getHerbivoreCauseOfDeath(dead);
      else if (dead.type === 'carnivore') cause = getCarnivoreCauseOfDeath(dead);
      else if (dead.type === 'fungus') cause = getFungusCauseOfDeath(dead);
      await eventLogger.logDeath(dead, cause);
    }

    // Build the dead matter entries for entities that died this tick with
    // meaningful energy. Starvation deaths (energy <= DEAD_MATTER_MIN_ENERGY)
    // leave no corpse.
    const newDeadMatter: DeadMatter[] = deadEntities
      .filter(e => e.energy > DEAD_MATTER_MIN_ENERGY)
      .map(e => ({
        id: e.id,
        position: { ...e.position },
        energy: e.energy,
        type: e.type,
        deathTick: tickNumber
      }));

    // Compute the dead matter state after this tick for population counts.
    const fullyDecomposedIds = new Set(
      processingResult.touchedDeadMatter.filter(dm => dm.energy <= 0).map(dm => dm.id)
    );
    const deadMatterAfterTick: DeadMatter[] = [
      ...deadMatter.filter(dm => !fullyDecomposedIds.has(dm.id)),
      ...newDeadMatter
    ];

    const stillLivingEntities = livingEntities.filter(e => !deadEntities.includes(e));
    const allLivingEntitiesAfterTick = [...stillLivingEntities, ...processingResult.newEntities];

    const previousPopulations = lockedPreviousState.populationSummary;
    const newPopulations = countEntitiesByType(allLivingEntitiesAfterTick, deadMatterAfterTick);
    applyAllTimeDeadSummary(newPopulations, previousPopulations, deadEntities);

    for (const entity of allLivingEntitiesAfterTick) {
      entity.updatedAt = createTimestamp();
    }

    // 7. Log population changes and ambient narrative.
    await logPopulationChanges(tickNumber, previousPopulations, newPopulations, eventLogger);
    if (willRandomEventOccur(AMBIENT_EVENT_PROBABILITY)) {
      await eventLogger.logAmbientNarrative(updatedEnvironment, newPopulations, allLivingEntitiesAfterTick);
    }

    // 8. Persist everything.
    const persistenceStart = Date.now();

    const savedGardenState = await createAndSaveGardenState(
      db, tickNumber, updatedEnvironment, newPopulations, appLogger
    );
    metrics.save_state_duration = Date.now() - persistenceStart;

    const entitySaveStart = Date.now();
    await saveEntitiesAndCleanup(
      db,
      savedGardenState.id,
      tickNumber,
      processingResult.newEntities,
      deadEntities.map(e => e.id),
      stillLivingEntities,
      appLogger
    );
    metrics.save_entities_duration = Date.now() - entitySaveStart;

    // Dead matter persistence: create new, update partial, delete full, purge TTL.
    const deadMatterStart = Date.now();
    const partiallyDecomposed = processingResult.touchedDeadMatter.filter(dm => dm.energy > 0);
    const fullyDecomposed = processingResult.touchedDeadMatter.filter(dm => dm.energy <= 0);

    await createDeadMatterBatchInDatabase(db, newDeadMatter);
    await updateDeadMatterEnergyBatchInDatabase(db, partiallyDecomposed);
    await deleteDeadMatterBatchInDatabase(db, fullyDecomposed.map(dm => dm.id));
    await purgeExpiredDeadMatterFromDatabase(db, tickNumber - DEAD_MATTER_TTL_TICKS);
    metrics.dead_matter_duration = Date.now() - deadMatterStart;

    await deleteSimulationEventsByTickFromDatabase(db, tickNumber);
    const dbEventLogger = createEventLogger(db, tickNumber, savedGardenState.id);
    await bufferedEventLogger.flushTo(dbEventLogger);
    await setLastCompletedTick(db, tickNumber);
    await pruneOldGardenStatesFromDatabase(db, tickNumber - GARDEN_STATE_RETENTION_TICKS);

    metrics.persistence_duration = Date.now() - persistenceStart;

    const duration = Date.now() - startTime;
    metrics.total_duration = duration;

    await appLogger.info('tick_complete', `Tick ${tickNumber} completed in ${duration}ms`, {
      tick: tickNumber,
      metrics,
      summary: {
        newEntities: processingResult.newEntities.length,
        deaths: deadEntities.length,
        newDeadMatter: newDeadMatter.length,
        decomposed: fullyDecomposed.length,
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
      error: error instanceof Error ? error.message : String(error), duration
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
