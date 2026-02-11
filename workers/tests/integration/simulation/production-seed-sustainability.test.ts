import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import type { Entity } from '@chaos-garden/shared';
import { processEntitiesForTick } from '../../../src/simulation/tick/tickHelpers/processEntitiesForTick';
import { createFakeEventLogger } from '../../helpers/fake-event-logger';
import { createFakeApplicationLogger } from '../../helpers/fake-application-logger';
import { buildEnvironment } from '../../fixtures/environment';

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

const {
  generateEntities,
  SUSTAINABILITY_TICK_WINDOW,
  SUSTAINABILITY_MINIMUMS,
} = requireModule('../../../scripts/init-remote-db-prod.js') as {
  generateEntities: (seed: number) => SeedData;
  SUSTAINABILITY_TICK_WINDOW: number;
  SUSTAINABILITY_MINIMUMS: {
    plants: number;
    herbivores: number;
    carnivores: number;
    fungi: number;
    totalLiving: number;
  };
};

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

async function runDeterministicTick(entities: Entity[], tickNumber: number): Promise<Entity[]> {
  const eventLogger = createFakeEventLogger();
  const appLogger = createFakeApplicationLogger();
  const environment = buildEnvironment({
    tick: tickNumber,
    temperature: 20,
    sunlight: 0.72,
    moisture: 0.58,
  });

  const livingBeforeTick = entities.filter((entity) => entity.isAlive);
  for (const entity of livingBeforeTick) {
    entity.age += 1;
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
  const survivors = livingBeforeTick.filter((entity) => entity.isAlive);

  const deadById = new Map<string, Entity>();
  for (const deadEntity of decomposableDeadBeforeTick) {
    deadById.set(deadEntity.id, deadEntity);
  }
  for (const deadEntity of newlyDead) {
    deadById.set(deadEntity.id, deadEntity);
  }

  const persistentDead = Array.from(deadById.values()).filter((entity) => entity.energy > 0);

  return [...survivors, ...processingResult.newEntities, ...persistentDead];
}

describe('integration/simulation production seed sustainability', () => {
  it('keeps all trophic groups alive through the 120-tick sustainability horizon', async () => {
    const seedData = generateEntities(20260210);
    let entities = seedData.entities.map(mapSeedEntityToSimulationEntity);

    for (let tick = 1; tick <= SUSTAINABILITY_TICK_WINDOW; tick += 1) {
      entities = await runDeterministicTick(entities, tick);
    }

    const livingSummary = countLivingByType(entities);

    expect(livingSummary.plants).toBeGreaterThanOrEqual(SUSTAINABILITY_MINIMUMS.plants);
    expect(livingSummary.herbivores).toBeGreaterThanOrEqual(SUSTAINABILITY_MINIMUMS.herbivores);
    expect(livingSummary.carnivores).toBeGreaterThanOrEqual(SUSTAINABILITY_MINIMUMS.carnivores);
    expect(livingSummary.fungi).toBeGreaterThanOrEqual(SUSTAINABILITY_MINIMUMS.fungi);
    expect(livingSummary.totalLiving).toBeGreaterThanOrEqual(SUSTAINABILITY_MINIMUMS.totalLiving);
  });
});
