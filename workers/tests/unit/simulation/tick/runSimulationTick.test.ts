import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity, GardenState } from '@chaos-garden/shared';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildPlant } from '../../../fixtures/entities';
import { createFakeApplicationLogger } from '../../../helpers/fake-application-logger';

const mockQueries = vi.hoisted(() => ({
  getLatestGardenStateFromDatabase: vi.fn(),
  getGardenStateByTickFromDatabase: vi.fn(),
  saveGardenStateToDatabase: vi.fn(),
  getAllEntitiesFromDatabase: vi.fn(),
  getAllLivingEntitiesFromDatabase: vi.fn(),
  deleteSimulationEventsByTickFromDatabase: vi.fn(),
  saveEntitiesToDatabase: vi.fn(),
  markEntitiesAsDeadInDatabase: vi.fn()
}));

const mockSimulationControl = vi.hoisted(() => ({
  tryAcquireSimulationLock: vi.fn(async () => true),
  releaseSimulationLock: vi.fn(async () => {}),
  getLastCompletedTick: vi.fn(async () => 0),
  setLastCompletedTick: vi.fn(async () => {})
}));

const mockEnvironment = vi.hoisted(() => ({
  updateEnvironmentForNextTick: vi.fn((current) => ({
    ...current,
    tick: current.tick + 1,
    sunlight: 0.6
  }))
}));

const mockEventLoggerFactories = vi.hoisted(() => {
  const eventLogger = {
    logBirth: vi.fn(async () => {}),
    logDeath: vi.fn(async () => {}),
    logReproduction: vi.fn(async () => {}),
    logMutation: vi.fn(async () => {}),
    logExtinction: vi.fn(async () => {}),
    logPopulationExplosion: vi.fn(async () => {}),
    logEcosystemCollapse: vi.fn(async () => {}),
    logDisaster: vi.fn(async () => {}),
    logUserIntervention: vi.fn(async () => {}),
    logEnvironmentChange: vi.fn(async () => {}),
    logCustom: vi.fn(async () => {}),
    logAmbientNarrative: vi.fn(async () => {})
  };

  const bufferedEventLogger = {
    logger: eventLogger,
    flushTo: vi.fn(async () => {}),
    size: vi.fn(() => 0)
  };

  return {
    eventLogger,
    bufferedEventLogger,
    createBufferedEventLogger: vi.fn(() => bufferedEventLogger),
    createEventLogger: vi.fn(() => eventLogger),
    createConsoleEventLogger: vi.fn(() => eventLogger),
    createCompositeEventLogger: vi.fn(() => eventLogger)
  };
});

vi.mock('../../../../src/db/queries', () => mockQueries);
vi.mock('../../../../src/db/simulation-control', () => mockSimulationControl);
vi.mock('../../../../src/simulation/environment', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../src/simulation/environment')>();
  return {
    ...original,
    updateEnvironmentForNextTick: mockEnvironment.updateEnvironmentForNextTick
  };
});
vi.mock('../../../../src/logging/event-logger', () => mockEventLoggerFactories);

import { runSimulationTick } from '../../../../src/simulation/tick';

describe('simulation/tick/runSimulationTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const previousState: GardenState = {
      id: 1,
      tick: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      environment: buildEnvironment({ tick: 0 }),
      populationSummary: {
        plants: 1,
        herbivores: 0,
        carnivores: 0,
        fungi: 0,
        deadPlants: 0,
        deadHerbivores: 0,
        deadCarnivores: 0,
        deadFungi: 0,
        total: 1,
        totalLiving: 1,
        totalDead: 0
      }
    };

    const livingPlant = buildPlant({ energy: 40, reproductionRate: 0, age: 0 });

    mockQueries.getLatestGardenStateFromDatabase.mockResolvedValue(previousState);
    mockQueries.getGardenStateByTickFromDatabase.mockResolvedValue(previousState);
    mockQueries.getAllLivingEntitiesFromDatabase.mockResolvedValue([livingPlant]);
    mockQueries.deleteSimulationEventsByTickFromDatabase.mockResolvedValue(undefined);
    mockQueries.saveGardenStateToDatabase.mockResolvedValue(2);
    mockQueries.saveEntitiesToDatabase.mockResolvedValue(undefined);
    mockQueries.markEntitiesAsDeadInDatabase.mockResolvedValue(undefined);
    mockSimulationControl.tryAcquireSimulationLock.mockResolvedValue(true);
    mockSimulationControl.getLastCompletedTick.mockResolvedValue(0);
    mockSimulationControl.releaseSimulationLock.mockResolvedValue(undefined);
    mockSimulationControl.setLastCompletedTick.mockResolvedValue(undefined);
  });

  it('increments tick and persists state updates', async () => {
    const result = await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(result.executed).toBe(true);
    expect(result.tickNumber).toBe(1);
    expect(mockEnvironment.updateEnvironmentForNextTick).toHaveBeenCalledTimes(1);
    expect(mockQueries.saveGardenStateToDatabase).toHaveBeenCalledTimes(1);
    expect(mockQueries.saveEntitiesToDatabase).toHaveBeenCalledTimes(1);
    expect(mockSimulationControl.setLastCompletedTick).toHaveBeenCalledWith({}, 1);
  });

  it('increments age for living entities each tick', async () => {
    const agingPlant = buildPlant({ id: 'plant-aging', age: 3, reproductionRate: 0 });
    mockQueries.getAllLivingEntitiesFromDatabase.mockResolvedValue([agingPlant]);

    await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    const savedEntities = mockQueries.saveEntitiesToDatabase.mock.calls[0][1] as Entity[];
    const persistedPlant = savedEntities.find((entity) => entity.id === 'plant-aging');
    expect(persistedPlant?.age).toBe(4);
  });

  it('marks dead entities when energy depletes', async () => {
    const dyingPlant = buildPlant({ id: 'plant-dead', energy: 0.1, photosynthesisRate: 0, reproductionRate: 0 });
    mockQueries.getAllLivingEntitiesFromDatabase.mockResolvedValue([dyingPlant]);

    const result = await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(result.executed).toBe(true);
    expect(result.deaths).toBe(1);
    expect(mockEventLoggerFactories.eventLogger.logDeath).toHaveBeenCalledTimes(1);
    expect(mockQueries.markEntitiesAsDeadInDatabase).toHaveBeenCalledWith({}, ['plant-dead'], 1);
    expect(result.populations.total).toBe(1);
  });

  it('persists offspring with assigned bornAtTick and gardenStateId', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const reproducingPlant = buildPlant({
      id: 'plant-parent',
      energy: 95,
      reproductionRate: 1,
      photosynthesisRate: 1,
      age: 0
    });

    mockQueries.getAllLivingEntitiesFromDatabase.mockResolvedValue([reproducingPlant]);

    const result = await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(result.executed).toBe(true);
    expect(result.newEntities).toBeGreaterThanOrEqual(1);

    const savedEntities = mockQueries.saveEntitiesToDatabase.mock.calls[0][1] as Entity[];
    const childEntity = savedEntities.find((entity) => entity.id !== 'plant-parent');

    expect(childEntity).toBeDefined();
    expect(childEntity?.bornAtTick).toBe(1);
    expect(childEntity?.gardenStateId).toBe(2);
    expect(childEntity?.lineage).toBe('plant-parent');
  });

  it('logs ambient narrative once per successful tick', async () => {
    await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(mockEventLoggerFactories.eventLogger.logAmbientNarrative).toHaveBeenCalledTimes(1);
  });

  it('binds persisted events to the newly created garden state', async () => {
    await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(mockEventLoggerFactories.createEventLogger).toHaveBeenCalledWith({}, 1, 2);
    expect(mockEventLoggerFactories.bufferedEventLogger.flushTo).toHaveBeenCalledTimes(1);
  });

  it('uses composite logger in development mode', async () => {
    await runSimulationTick({} as any, createFakeApplicationLogger(), true);

    expect(mockEventLoggerFactories.createConsoleEventLogger).toHaveBeenCalledTimes(1);
    expect(mockEventLoggerFactories.createCompositeEventLogger).toHaveBeenCalledTimes(1);
  });

  it('returns no-op when lock is unavailable', async () => {
    mockSimulationControl.tryAcquireSimulationLock.mockResolvedValue(false);

    const result = await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(result.executed).toBe(false);
    expect(result.skipReason).toBe('lock_unavailable');
    expect(mockQueries.saveGardenStateToDatabase).not.toHaveBeenCalled();
    expect(mockSimulationControl.releaseSimulationLock).not.toHaveBeenCalled();
  });

  it('returns no-op when requested tick is already processed', async () => {
    mockSimulationControl.getLastCompletedTick
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const result = await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(result.executed).toBe(false);
    expect(result.skipReason).toBe('already_processed');
    expect(mockQueries.saveGardenStateToDatabase).not.toHaveBeenCalled();
    expect(mockSimulationControl.releaseSimulationLock).toHaveBeenCalledTimes(1);
  });

  it('releases lock on success', async () => {
    await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(mockSimulationControl.releaseSimulationLock).toHaveBeenCalledTimes(1);
  });

  it('releases lock when persistence fails', async () => {
    mockQueries.saveGardenStateToDatabase.mockRejectedValue(new Error('save failed'));

    await expect(runSimulationTick({} as any, createFakeApplicationLogger(), false)).rejects.toThrow('save failed');

    expect(mockSimulationControl.releaseSimulationLock).toHaveBeenCalledTimes(1);
  });

  it('throws when no prior garden state exists', async () => {
    const appLogger = createFakeApplicationLogger();
    mockQueries.getLatestGardenStateFromDatabase.mockResolvedValue(null);

    await expect(runSimulationTick({} as any, appLogger, false)).rejects.toThrow('No garden state found');

    expect(appLogger.error).toHaveBeenCalled();
    expect(mockQueries.saveGardenStateToDatabase).not.toHaveBeenCalled();
  });

  it('replays an incomplete tick using last completed state as baseline', async () => {
    const completedState: GardenState = {
      id: 1,
      tick: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      environment: buildEnvironment({ tick: 0 }),
      populationSummary: {
        plants: 1,
        herbivores: 0,
        carnivores: 0,
        fungi: 0,
        deadPlants: 0,
        deadHerbivores: 0,
        deadCarnivores: 0,
        deadFungi: 0,
        total: 1,
        totalLiving: 1,
        totalDead: 0
      }
    };

    const incompleteLatestState: GardenState = {
      id: 2,
      tick: 1,
      timestamp: '2026-01-01T00:15:00.000Z',
      environment: buildEnvironment({ tick: 1 }),
      populationSummary: {
        plants: 2,
        herbivores: 1,
        carnivores: 0,
        fungi: 0,
        deadPlants: 0,
        deadHerbivores: 0,
        deadCarnivores: 0,
        deadFungi: 0,
        total: 3,
        totalLiving: 3,
        totalDead: 0
      }
    };

    mockQueries.getLatestGardenStateFromDatabase.mockResolvedValue(incompleteLatestState);
    mockQueries.getGardenStateByTickFromDatabase.mockResolvedValue(completedState);

    const result = await runSimulationTick({} as any, createFakeApplicationLogger(), false);

    expect(result.executed).toBe(true);
    expect(result.tickNumber).toBe(1);
    expect(mockQueries.saveGardenStateToDatabase).toHaveBeenCalledTimes(1);
    expect(mockQueries.deleteSimulationEventsByTickFromDatabase).toHaveBeenCalledWith({}, 1);
    expect(mockSimulationControl.setLastCompletedTick).toHaveBeenCalledWith({}, 1);
    expect(mockSimulationControl.releaseSimulationLock).toHaveBeenCalledTimes(1);
  });
});
