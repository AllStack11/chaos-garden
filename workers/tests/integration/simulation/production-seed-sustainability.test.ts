import { createRequire } from 'module';
import { describe, expect, it, vi } from 'vitest';
import type { Entity, Environment } from '@chaos-garden/shared';
import { DEFAULT_SIMULATION_CONFIG } from '@chaos-garden/shared';
import { processEntitiesForTick } from '../../../src/simulation/tick/tickHelpers/processEntitiesForTick';
import { createFakeEventLogger } from '../../helpers/fake-event-logger';
import { createFakeApplicationLogger } from '../../helpers/fake-application-logger';
import { buildEnvironment } from '../../fixtures/environment';
import { updateEnvironmentForNextTick } from '../../../src/simulation/environment';
import { applyEnvironmentalEffectsToCreature } from '../../../src/simulation/environment/creature-effects';

const requireModule = createRequire(import.meta.url);

type SeedType = 'plant' | 'herbivore' | 'carnivore' | 'fungus';

interface SeedEntity {
  id: string;
  type: SeedType;
  name: string;
  species: string;
  positionX: number;
  positionY: number;
  energy: number;
  traits: Record<string, number>;
  timestamp: string;
}

interface SeedData {
  entities: SeedEntity[];
  counts: {
    plantCount: number;
    herbivoreCount: number;
    carnivoreCount: number;
    fungusCount: number;
    totalLiving: number;
  };
}

const { generateEntities } = requireModule('../../../scripts/init-remote-db-prod-v3.js') as {
  generateEntities: (seed: number) => SeedData;
};

const DETERMINISTIC_SUSTAINABILITY_TICK_WINDOW = 200;
const STOCHASTIC_SUSTAINABILITY_TICK_WINDOW = 500;
const STOCHASTIC_RUN_COUNT = 10;
const MINIMUM_STOCHASTIC_SUCCESS_COUNT = 8;
const MINIMUM_DECOMPOSABLE_CORPSE_ENERGY = 15;

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function runWithSeededRandom<T>(seed: number, callback: () => Promise<T>): Promise<T> {
  const seededRandom = createSeededRandom(seed);
  const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seededRandom());
  try {
    return await callback();
  } finally {
    randomSpy.mockRestore();
  }
}

function mapSeedEntityToSimulationEntity(seedEntity: SeedEntity): Entity {
  const baseEntity = {
    id: seedEntity.id,
    gardenStateId: 1,
    bornAtTick: 0,
    deathTick: undefined,
    isAlive: true,
    name: seedEntity.name,
    species: seedEntity.species,
    position: {
      x: seedEntity.positionX,
      y: seedEntity.positionY,
    },
    energy: seedEntity.energy,
    health: 100,
    age: 0,
    lineage: 'origin' as const,
    createdAt: seedEntity.timestamp,
    updatedAt: seedEntity.timestamp,
  };

  if (seedEntity.type === 'plant') {
    return {
      ...baseEntity,
      type: 'plant',
      reproductionRate: seedEntity.traits.reproductionRate,
      metabolismEfficiency: seedEntity.traits.metabolismEfficiency,
      photosynthesisRate: seedEntity.traits.photosynthesisRate,
    };
  }

  if (seedEntity.type === 'herbivore') {
    return {
      ...baseEntity,
      type: 'herbivore',
      reproductionRate: seedEntity.traits.reproductionRate,
      movementSpeed: seedEntity.traits.movementSpeed,
      metabolismEfficiency: seedEntity.traits.metabolismEfficiency,
      perceptionRadius: seedEntity.traits.perceptionRadius,
      threatDetectionRadius: seedEntity.traits.threatDetectionRadius,
    };
  }

  if (seedEntity.type === 'carnivore') {
    return {
      ...baseEntity,
      type: 'carnivore',
      reproductionRate: seedEntity.traits.reproductionRate,
      movementSpeed: seedEntity.traits.movementSpeed,
      metabolismEfficiency: seedEntity.traits.metabolismEfficiency,
      perceptionRadius: seedEntity.traits.perceptionRadius,
    };
  }

  return {
    ...baseEntity,
    type: 'fungus',
    reproductionRate: seedEntity.traits.reproductionRate,
    metabolismEfficiency: seedEntity.traits.metabolismEfficiency,
    decompositionRate: seedEntity.traits.decompositionRate,
    perceptionRadius: seedEntity.traits.perceptionRadius,
  };
}

function countLivingByType(entities: Entity[]): {
  plants: number;
  herbivores: number;
  carnivores: number;
  fungi: number;
  totalLiving: number;
} {
  const living = entities.filter((entity) => entity.isAlive);
  return {
    plants: living.filter((entity) => entity.type === 'plant').length,
    herbivores: living.filter((entity) => entity.type === 'herbivore').length,
    carnivores: living.filter((entity) => entity.type === 'carnivore').length,
    fungi: living.filter((entity) => entity.type === 'fungus').length,
    totalLiving: living.length,
  };
}

function applyPopulationLimits(livingEntities: Entity[], deadEntities: Entity[]): Entity[] {
  const sortedLiving = [...livingEntities].sort((left, right) => left.id.localeCompare(right.id));
  const sortedDead = [...deadEntities].sort((left, right) => left.id.localeCompare(right.id));

  const livingPlants = sortedLiving
    .filter((entity) => entity.type === 'plant')
    .slice(0, DEFAULT_SIMULATION_CONFIG.maxPlants);

  const livingHerbivores = sortedLiving
    .filter((entity) => entity.type === 'herbivore')
    .slice(0, DEFAULT_SIMULATION_CONFIG.maxHerbivores);

  const livingCarnivores = sortedLiving
    .filter((entity) => entity.type === 'carnivore')
    .slice(0, DEFAULT_SIMULATION_CONFIG.maxCarnivores);

  const livingFungi = sortedLiving
    .filter((entity) => entity.type === 'fungus')
    .slice(
      0,
      Math.max(
        50,
        DEFAULT_SIMULATION_CONFIG.maxTotalEntities -
          (DEFAULT_SIMULATION_CONFIG.maxPlants +
            DEFAULT_SIMULATION_CONFIG.maxHerbivores +
            DEFAULT_SIMULATION_CONFIG.maxCarnivores),
      ),
    );

  const limitedLiving = [...livingPlants, ...livingHerbivores, ...livingCarnivores, ...livingFungi];
  const availableDeadSlots = Math.max(0, DEFAULT_SIMULATION_CONFIG.maxTotalEntities - limitedLiving.length);
  const limitedDead = sortedDead.slice(0, availableDeadSlots);

  return [...limitedLiving, ...limitedDead];
}

async function runTickWithEnvironment(
  entities: Entity[],
  environment: Environment,
  applyEnvironmentalStress: boolean = true,
): Promise<Entity[]> {
  const eventLogger = createFakeEventLogger();
  const appLogger = createFakeApplicationLogger();

  const livingBeforeTick = entities.filter((entity) => entity.isAlive);
  for (const entity of livingBeforeTick) {
    entity.age += 1;
    if (applyEnvironmentalStress) {
      applyEnvironmentalEffectsToCreature(entity, environment);
    }
  }

  const decomposableDeadBeforeTick = entities.filter((entity) => !entity.isAlive && entity.energy > 0);

  const processingResult = await processEntitiesForTick(
    livingBeforeTick,
    decomposableDeadBeforeTick,
    environment,
    eventLogger,
    appLogger,
  );

  const newlyDead = livingBeforeTick.filter((entity) => !entity.isAlive && entity.energy > 0);
  for (const deadEntity of newlyDead) {
    deadEntity.energy = Math.max(deadEntity.energy, MINIMUM_DECOMPOSABLE_CORPSE_ENERGY);
  }

  const survivors = livingBeforeTick.filter((entity) => entity.isAlive);

  const deadById = new Map<string, Entity>();
  for (const deadEntity of decomposableDeadBeforeTick) {
    deadById.set(deadEntity.id, deadEntity);
  }
  for (const deadEntity of newlyDead) {
    deadById.set(deadEntity.id, deadEntity);
  }

  const persistentDead = Array.from(deadById.values()).filter((entity) => entity.energy > 0);
  const livingCombined = [...survivors, ...processingResult.newEntities].filter((entity) => entity.isAlive);

  return applyPopulationLimits(livingCombined, persistentDead);
}

describe('integration/simulation production seed sustainability', () => {
  it('keeps all trophic groups alive through a deterministic 200-tick baseline run', async () => {
    const livingSummary = await runWithSeededRandom(20260210, async () => {
      const seedData = generateEntities(20260210);
      let entities = seedData.entities.map(mapSeedEntityToSimulationEntity);

      for (let tick = 1; tick <= DETERMINISTIC_SUSTAINABILITY_TICK_WINDOW; tick += 1) {
        const deterministicEnvironment = buildEnvironment({
          tick,
          temperature: 20,
          sunlight: 0.72,
          moisture: 0.58,
        });

        entities = await runTickWithEnvironment(entities, deterministicEnvironment, false);
      }

      return countLivingByType(entities);
    });

    expect(livingSummary.plants).toBeGreaterThanOrEqual(1);
    expect(livingSummary.herbivores).toBeGreaterThanOrEqual(1);
    expect(livingSummary.carnivores).toBeGreaterThanOrEqual(1);
    expect(livingSummary.fungi).toBeGreaterThanOrEqual(1);
    expect(livingSummary.totalLiving).toBeGreaterThanOrEqual(6);
  }, 20_000);

  it('achieves >=80% survival success across 10 stochastic runs at tick 500', async () => {
    const runSummaries: Array<{ seed: number; summary: ReturnType<typeof countLivingByType> }> = [];

    for (let runIndex = 0; runIndex < STOCHASTIC_RUN_COUNT; runIndex += 1) {
      const seed = 20260210 + runIndex;
      const summary = await runWithSeededRandom(seed ^ 0x9e3779b9, async () => {
        const seedData = generateEntities(seed);
        let entities = seedData.entities.map(mapSeedEntityToSimulationEntity);
        let environment = buildEnvironment({
          tick: 0,
          temperature: 20,
          sunlight: 0.7,
          moisture: 0.5,
        });

        for (let tick = 1; tick <= STOCHASTIC_SUSTAINABILITY_TICK_WINDOW; tick += 1) {
          environment = await updateEnvironmentForNextTick(environment);
          entities = await runTickWithEnvironment(entities, environment);
        }

        return countLivingByType(entities);
      });

      runSummaries.push({ seed, summary });
    }

    const successfulRuns = runSummaries.filter(({ summary }) => (
      summary.plants >= 1 &&
      summary.herbivores >= 1 &&
      summary.carnivores >= 1 &&
      summary.fungi >= 1
    )).length;

    if (successfulRuns < MINIMUM_STOCHASTIC_SUCCESS_COUNT) {
      throw new Error(
        `Stochastic sustainability target failed: ${successfulRuns}/${STOCHASTIC_RUN_COUNT} successful runs. ` +
          `Final summaries: ${JSON.stringify(runSummaries)}`,
      );
    }

    expect(successfulRuns).toBeGreaterThanOrEqual(MINIMUM_STOCHASTIC_SUCCESS_COUNT);
  }, 60_000);
});
