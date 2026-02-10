import { describe, expect, it } from 'vitest';
import { processHerbivoreBehaviorDuringTick } from '../../../../src/simulation/creatures/herbivores';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildHerbivore, buildPlant } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/herbivores', () => {
  it('does not target plants outside perception radius', async () => {
    const herbivore = buildHerbivore({ position: { x: 0, y: 0 }, perceptionRadius: 50 });
    const farPlant = buildPlant({ id: 'plant-far', position: { x: 200, y: 0 } });

    const result = await processHerbivoreBehaviorDuringTick(
      herbivore,
      buildEnvironment(),
      [farPlant],
      createFakeEventLogger()
    );

    expect(result.consumed).toEqual([]);
    expect(farPlant.isAlive).toBe(true);
    expect(herbivore.energy).toBeLessThan(60);
  });

  it('consumes plant when within eating range', async () => {
    const herbivore = buildHerbivore({ position: { x: 0, y: 0 } });
    const plant = buildPlant({ id: 'plant-food', position: { x: 1, y: 1 }, energy: 20 });

    const result = await processHerbivoreBehaviorDuringTick(
      herbivore,
      buildEnvironment(),
      [plant],
      createFakeEventLogger()
    );

    expect(result.consumed).toEqual(['plant-food']);
    expect(plant.isAlive).toBe(false);
    expect(plant.health).toBe(0);
  });

  it('restores health when a starving herbivore feeds', async () => {
    const herbivore = buildHerbivore({
      position: { x: 0, y: 0 },
      energy: 0,
      health: 40
    });
    const plant = buildPlant({ id: 'plant-recovery', position: { x: 1, y: 1 }, energy: 20 });

    await processHerbivoreBehaviorDuringTick(
      herbivore,
      buildEnvironment(),
      [plant],
      createFakeEventLogger()
    );

    expect(herbivore.health).toBeGreaterThan(40);
    expect(herbivore.energy).toBeGreaterThan(0);
  });

  it('applies regular feeding effects to both energy and health', async () => {
    const herbivore = buildHerbivore({
      position: { x: 0, y: 0 },
      energy: 40,
      health: 80
    });
    const plant = buildPlant({ id: 'plant-regular-feed', position: { x: 1, y: 1 }, energy: 20 });

    const result = await processHerbivoreBehaviorDuringTick(
      herbivore,
      buildEnvironment(),
      [plant],
      createFakeEventLogger()
    );

    expect(result.consumed).toEqual(['plant-regular-feed']);
    expect(herbivore.energy).toBe(59);
    expect(herbivore.health).toBe(85);
    expect(plant.isAlive).toBe(false);
    expect(plant.energy).toBe(0);
  });

  it('loses health first when energy falls to zero', async () => {
    const herbivore = buildHerbivore({ energy: 0.1, position: { x: 0, y: 0 }, perceptionRadius: 10 });

    await processHerbivoreBehaviorDuringTick(
      herbivore,
      buildEnvironment(),
      [],
      createFakeEventLogger()
    );

    expect(herbivore.isAlive).toBe(true);
    expect(herbivore.energy).toBe(0);
    expect(herbivore.health).toBe(99);
  });

  it('does not reproduce after max reproductive age', async () => {
    const herbivore = buildHerbivore({
      age: 120,
      energy: 100,
      reproductionRate: 1
    });
    const nearbyPlant = buildPlant({ position: { x: 0, y: 0 } });

    const result = await processHerbivoreBehaviorDuringTick(
      herbivore,
      buildEnvironment(),
      [nearbyPlant],
      createFakeEventLogger()
    );

    expect(result.offspring).toEqual([]);
  });
});
