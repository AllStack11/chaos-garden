import { describe, expect, it } from 'vitest';
import { processCarnivoreBehaviorDuringTick } from '../../../../src/simulation/creatures/carnivores';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildCarnivore, buildHerbivore } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/carnivores', () => {
  it('explores randomly when no prey in perception radius', async () => {
    const carnivore = buildCarnivore({ position: { x: 100, y: 100 }, perceptionRadius: 30, energy: 50 });
    const farPrey = buildHerbivore({ id: 'prey-far', position: { x: 200, y: 0 } });

    const result = await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [farPrey],
      createFakeEventLogger()
    );

    expect(result.consumed).toEqual([]);
    expect(farPrey.isAlive).toBe(true);
    // Carnivore should have moved (exploration behavior)
    const hasMoved = carnivore.position.x !== 100 || carnivore.position.y !== 100;
    expect(hasMoved).toBe(true);
    // Energy should have decreased
    expect(carnivore.energy).toBeLessThan(50);
  });

  it('applies biomass model: prey energy 10 and health 100 produces current gain', async () => {
    const carnivore = buildCarnivore({ position: { x: 0, y: 0 }, energy: 50 });
    const prey = buildHerbivore({ id: 'prey-1', position: { x: 0, y: 0 }, energy: 10, health: 100 });

    await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [prey],
      createFakeEventLogger()
    );

    expect(carnivore.energy).toBeCloseTo(78.875, 3);
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

    expect(carnivore.energy).toBeCloseTo(98.875, 3);
    expect(prey.isAlive).toBe(false);
    expect(prey.energy).toBe(62);
  });

  it('restores health when a starving carnivore feeds', async () => {
    const carnivore = buildCarnivore({ position: { x: 0, y: 0 }, energy: 0, health: 40 });
    const prey = buildHerbivore({ id: 'prey-recovery', position: { x: 0, y: 0 }, energy: 20, health: 100 });

    await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [prey],
      createFakeEventLogger()
    );

    expect(carnivore.health).toBeGreaterThan(40);
    expect(carnivore.energy).toBeGreaterThan(0);
  });

  it('applies regular feeding effects to both energy and health', async () => {
    const carnivore = buildCarnivore({
      position: { x: 0, y: 0 },
      energy: 30,
      health: 70
    });
    const prey = buildHerbivore({
      id: 'prey-regular-feed',
      position: { x: 0, y: 0 },
      energy: 20,
      health: 60
    });

    const result = await processCarnivoreBehaviorDuringTick(
      carnivore,
      buildEnvironment(),
      [prey],
      createFakeEventLogger()
    );

    expect(result.consumed).toEqual(['prey-regular-feed']);
    expect(carnivore.energy).toBe(60.875);
    expect(carnivore.health).toBe(75);
    expect(prey.isAlive).toBe(false);
    expect(prey.energy).toBe(0);
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
