import { describe, expect, it, vi } from 'vitest';
import {
  calculatePlantEnergyGainFromPhotosynthesis,
  doesPlantHaveEnoughEnergyToReproduce,
  processPlantBehaviorDuringTick
} from '../../../../src/simulation/creatures/plants';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildPlant } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/plants', () => {
  it('calculates higher photosynthesis gain at peak sunlight and ideal moisture', () => {
    const plant = buildPlant({ photosynthesisRate: 1 });
    const environment = buildEnvironment({ tick: 48, moisture: 0.5 });

    const energyGain = calculatePlantEnergyGainFromPhotosynthesis(plant, environment);

    expect(energyGain).toBeCloseTo(3, 5);
  });

  it('checks reproduction threshold correctly', () => {
    expect(doesPlantHaveEnoughEnergyToReproduce(buildPlant({ energy: 80 }))).toBe(true);
    expect(doesPlantHaveEnoughEnergyToReproduce(buildPlant({ energy: 79.99 }))).toBe(false);
  });

  it('creates offspring when energy and reproduction chance allow', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const plant = buildPlant({ energy: 95, reproductionRate: 1 });
    const environment = buildEnvironment({ tick: 48, moisture: 0.5 });

    const offspring = processPlantBehaviorDuringTick(plant, environment, createFakeEventLogger());

    expect(offspring.length).toBe(1);
    expect(plant.energy).toBeLessThan(95);
    expect(offspring[0].type).toBe('plant');
  });

  it('dies from old age when max age reached', () => {
    const plant = buildPlant({ age: 200, energy: 50, health: 100 });

    processPlantBehaviorDuringTick(plant, buildEnvironment(), createFakeEventLogger());

    expect(plant.isAlive).toBe(false);
    expect(plant.health).toBe(0);
  });

  it('dies when energy reaches zero', () => {
    const plant = buildPlant({ energy: 0.1, photosynthesisRate: 0 });
    const environment = buildEnvironment({ tick: 0, moisture: 0.5 });

    processPlantBehaviorDuringTick(plant, environment, createFakeEventLogger());

    expect(plant.isAlive).toBe(false);
    expect(plant.energy).toBe(0);
  });
});
