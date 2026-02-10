import { describe, expect, it } from 'vitest';
import type { Entity } from '@chaos-garden/shared';
import { processPlantBehaviorDuringTick } from '../../../src/simulation/creatures/plants';
import { processHerbivoreBehaviorDuringTick } from '../../../src/simulation/creatures/herbivores';
import { processCarnivoreBehaviorDuringTick } from '../../../src/simulation/creatures/carnivores';
import { processFungusBehaviorDuringTick } from '../../../src/simulation/creatures/fungi';
import { updateEnvironmentForNextTick } from '../../../src/simulation/environment';
import { buildCarnivore, buildFungus, buildHerbivore, buildPlant } from '../../fixtures/entities';
import { buildEnvironment } from '../../fixtures/environment';
import { createFakeEventLogger } from '../../helpers/fake-event-logger';

async function runOneTick(entities: Entity[], tickNumber: number): Promise<Entity[]> {
  const eventLogger = createFakeEventLogger();
  const environment = await updateEnvironmentForNextTick(buildEnvironment({ tick: tickNumber }), eventLogger);
  const living = entities.filter(entity => entity.isAlive);

  for (const entity of living) {
    entity.age += 1;
  }

  const plants = living.filter(entity => entity.type === 'plant');
  const herbivores = living.filter(entity => entity.type === 'herbivore');
  const carnivores = living.filter(entity => entity.type === 'carnivore');
  const fungi = living.filter(entity => entity.type === 'fungus');

  const births: Entity[] = [];

  for (const plant of plants) {
    births.push(...await processPlantBehaviorDuringTick(plant, environment, eventLogger));
  }

  for (const herbivore of herbivores) {
    births.push(...(await processHerbivoreBehaviorDuringTick(herbivore, environment, plants, eventLogger)).offspring);
  }

  for (const carnivore of carnivores) {
    births.push(...(await processCarnivoreBehaviorDuringTick(carnivore, environment, herbivores, eventLogger)).offspring);
  }

  for (const fungus of fungi) {
    births.push(...(await processFungusBehaviorDuringTick(fungus, environment, entities, eventLogger)).offspring);
  }

  return [...entities, ...births];
}

async function runOneDeterministicTick(entities: Entity[], tickNumber: number): Promise<Entity[]> {
  const eventLogger = createFakeEventLogger();
  const environment = buildEnvironment({
    tick: tickNumber,
    temperature: 20,
    sunlight: 0.7,
    moisture: 0.5
  });
  const living = entities.filter(entity => entity.isAlive);

  for (const entity of living) {
    entity.age += 1;
  }

  const plants = living.filter(entity => entity.type === 'plant');
  const herbivores = living.filter(entity => entity.type === 'herbivore');
  const carnivores = living.filter(entity => entity.type === 'carnivore');
  const fungi = living.filter(entity => entity.type === 'fungus');

  const births: Entity[] = [];

  for (const plant of plants) {
    births.push(...await processPlantBehaviorDuringTick(plant, environment, eventLogger));
  }

  for (const herbivore of herbivores) {
    births.push(...(await processHerbivoreBehaviorDuringTick(herbivore, environment, plants, eventLogger)).offspring);
  }

  for (const carnivore of carnivores) {
    births.push(...(await processCarnivoreBehaviorDuringTick(carnivore, environment, herbivores, eventLogger)).offspring);
  }

  for (const fungus of fungi) {
    births.push(...(await processFungusBehaviorDuringTick(fungus, environment, entities, eventLogger)).offspring);
  }

  return [...entities, ...births];
}

describe('integration/simulation multi-tick ecosystem', () => {
  it('preserves invariants and allows fungi to consume carcass energy from predation', async () => {
    const carnivore = buildCarnivore({ position: { x: 0, y: 0 }, energy: 50, reproductionRate: 0 });
    const herbivore = buildHerbivore({
      id: 'prey-a',
      position: { x: 0, y: 0 },
      energy: 100,
      health: 100,
      reproductionRate: 0
    });
    const fungus = buildFungus({ id: 'fungus-a', position: { x: 2, y: 0 }, perceptionRadius: 100, reproductionRate: 0 });
    const plant = buildPlant({ id: 'plant-a', position: { x: 40, y: 0 }, reproductionRate: 0 });

    let entities: Entity[] = [carnivore, herbivore, fungus, plant];

    entities = await runOneTick(entities, 1);
    const deadPreyAfterHunt = entities.find(entity => entity.id === 'prey-a');

    expect(deadPreyAfterHunt?.isAlive).toBe(false);
    expect(deadPreyAfterHunt?.energy).toBeLessThan(70);

    entities = await runOneTick(entities, 2);
    entities = await runOneTick(entities, 3);

    for (const entity of entities) {
      expect(entity.energy).toBeGreaterThanOrEqual(0);
      expect(entity.health).toBeGreaterThanOrEqual(0);
    }

    const decomposedCarcass = entities.find(entity => entity.id === 'prey-a');
    expect(decomposedCarcass?.energy).toBeGreaterThanOrEqual(0);
    expect(decomposedCarcass?.energy).toBeLessThanOrEqual(70);
  });

  it('keeps carnivores alive past tick 30 and preserves non-zero plants', async () => {
    const carnivoreStart = { x: 760, y: 120 };
    const startX = carnivoreStart.x;
    const startY = carnivoreStart.y;
    const carnivore = buildCarnivore({
      id: 'carnivore-far',
      position: carnivoreStart,
      perceptionRadius: 30,
      movementSpeed: 4.6,
      energy: 50,
      reproductionRate: 0
    });

    const herbivore = buildHerbivore({
      id: 'herbivore-far',
      position: { x: 200, y: 300 },
      perceptionRadius: 1,
      movementSpeed: 0,
      energy: 60,
      reproductionRate: 0
    });

    const plants: Entity[] = [
      buildPlant({ id: 'plant-1', position: { x: 120, y: 120 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-2', position: { x: 220, y: 180 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-3', position: { x: 320, y: 220 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-4', position: { x: 420, y: 260 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-5', position: { x: 520, y: 320 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-6', position: { x: 620, y: 380 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-7', position: { x: 180, y: 420 }, reproductionRate: 0 }),
      buildPlant({ id: 'plant-8', position: { x: 280, y: 500 }, reproductionRate: 0 })
    ];

    let entities: Entity[] = [carnivore, herbivore, ...plants];
    for (let tick = 1; tick <= 30; tick += 1) {
      entities = await runOneDeterministicTick(entities, tick);
    }

    const carnivoreAfter30 = entities.find(entity => entity.id === 'carnivore-far');
    const livingPlantsAfter30 = entities.filter(entity => entity.type === 'plant' && entity.isAlive);

    expect(carnivoreAfter30?.isAlive).toBe(true);
    expect(carnivoreAfter30?.energy).toBeGreaterThan(0);
    const distanceMoved = Math.hypot(
      (carnivoreAfter30?.position.x ?? startX) - startX,
      (carnivoreAfter30?.position.y ?? startY) - startY
    );
    expect(distanceMoved).toBeGreaterThan(0);
    expect(livingPlantsAfter30.length).toBeGreaterThan(0);
  });
});
