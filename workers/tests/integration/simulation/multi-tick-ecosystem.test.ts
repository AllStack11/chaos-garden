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

function runOneTick(entities: Entity[], tickNumber: number): Entity[] {
  const eventLogger = createFakeEventLogger();
  const environment = updateEnvironmentForNextTick(buildEnvironment({ tick: tickNumber }), eventLogger);
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
    births.push(...processPlantBehaviorDuringTick(plant, environment, eventLogger));
  }

  for (const herbivore of herbivores) {
    births.push(...processHerbivoreBehaviorDuringTick(herbivore, environment, plants, eventLogger).offspring);
  }

  for (const carnivore of carnivores) {
    births.push(...processCarnivoreBehaviorDuringTick(carnivore, environment, herbivores, eventLogger).offspring);
  }

  for (const fungus of fungi) {
    births.push(...processFungusBehaviorDuringTick(fungus, environment, entities, eventLogger).offspring);
  }

  return [...entities, ...births];
}

describe('integration/simulation multi-tick ecosystem', () => {
  it('preserves invariants and allows fungi to consume carcass energy from predation', () => {
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

    entities = runOneTick(entities, 1);
    const deadPreyAfterHunt = entities.find(entity => entity.id === 'prey-a');

    expect(deadPreyAfterHunt?.isAlive).toBe(false);
    expect(deadPreyAfterHunt?.energy).toBeLessThan(70);

    entities = runOneTick(entities, 2);
    entities = runOneTick(entities, 3);

    for (const entity of entities) {
      expect(entity.energy).toBeGreaterThanOrEqual(0);
      expect(entity.health).toBeGreaterThanOrEqual(0);
    }

    const decomposedCarcass = entities.find(entity => entity.id === 'prey-a');
    expect(decomposedCarcass?.energy).toBeGreaterThanOrEqual(0);
    expect(decomposedCarcass?.energy).toBeLessThanOrEqual(70);
  });
});
