import { describe, expect, it } from 'vitest';
import { processCarnivoreBehaviorDuringTick } from '../../../../src/simulation/creatures/carnivores';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildCarnivore, buildHerbivore } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/carnivores', () => {
  it('does not target prey outside perception radius', async () => {
    const carnivore = buildCarnivore({ position: { x: 0, y: 0 }, perceptionRadius: 30 });
    const farPrey = buildHerbivore({ id: 'prey-far', position: { x: 200, y: 0 } });

    const result = await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [farPrey],
      createFakeEventLogger()
    );

    expect(result.consumed).toEqual([]);
    expect(farPrey.isAlive).toBe(true);
  });

  it('applies biomass model: prey energy 10 and health 100 gives gain 30', async () => {
    const carnivore = buildCarnivore({ position: { x: 0, y: 0 }, energy: 50 });
    const prey = buildHerbivore({ id: 'prey-1', position: { x: 0, y: 0 }, energy: 10, health: 100 });

    await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [prey],
      createFakeEventLogger()
    );

    expect(carnivore.energy).toBeCloseTo(78.625, 3);
    expect(prey.isAlive).toBe(false);
    expect(prey.health).toBe(0);
    expect(prey.energy).toBe(0);
  });

  it('caps gain and leaves carcass energy: prey energy 100 and health 100', async () => {
    const carnivore = buildCarnivore({ position: { x: 0, y: 0 }, energy: 50 });
    const prey = buildHerbivore({ id: 'prey-2', position: { x: 0, y: 0 }, energy: 100, health: 100 });

    await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [prey],
      createFakeEventLogger()
    );

    expect(carnivore.energy).toBeCloseTo(98.625, 3);
    expect(prey.isAlive).toBe(false);
    expect(prey.energy).toBe(70);
  });

  it('does not reproduce after max reproductive age', async () => {
    const carnivore = buildCarnivore({
      age: 170,
      energy: 100,
      reproductionRate: 1,
      position: { x: 0, y: 0 }
    });
    const prey = buildHerbivore({ id: 'prey-old-age', position: { x: 0, y: 0 }, energy: 100, health: 100 });

    const result = await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [prey],
      createFakeEventLogger()
    );

    expect(result.offspring).toEqual([]);
  });
});
