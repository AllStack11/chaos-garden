import { describe, expect, it } from 'vitest';
import { processFungusBehaviorDuringTick } from '../../../../src/simulation/creatures/fungi';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildFungus, buildHerbivore } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/fungi', () => {
  it('ignores dead matter outside perception radius', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 20 });
    const farDead = buildHerbivore({
      id: 'dead-far',
      position: { x: 100, y: 0 },
      isAlive: false,
      health: 0,
      energy: 50
    });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [farDead],
      createFakeEventLogger()
    );

    expect(result.decomposed).toEqual([]);
    expect(farDead.energy).toBe(50);
  });

  it('moves slowly toward dead matter within perception but outside decomposition range', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 50, energy: 40 });
    const nearbyDead = buildHerbivore({
      id: 'dead-mid',
      position: { x: 40, y: 0 },
      isAlive: false,
      health: 0,
      energy: 50
    });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [nearbyDead],
      createFakeEventLogger()
    );

    expect(result.decomposed).toEqual([]);
    expect(nearbyDead.energy).toBe(50);
    expect(fungus.position.x).toBeGreaterThan(0);
    expect(fungus.position.x).toBeLessThan(1);
  });

  it('decomposes dead matter in range and gains energy', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 100, energy: 40, decompositionRate: 1 });
    const deadHerbivore = buildHerbivore({
      id: 'dead-near',
      position: { x: 5, y: 0 },
      isAlive: false,
      health: 0,
      energy: 50
    });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment({ moisture: 1 }),
      [deadHerbivore],
      createFakeEventLogger()
    );

    expect(result.decomposed).toEqual(['dead-near']);
    expect(fungus.energy).toBeCloseTo(79.875, 3);
    expect(deadHerbivore.energy).toBe(10);
  });

  it('loses health first when energy reaches zero', async () => {
    const fungus = buildFungus({ energy: 0.01 });

    await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [],
      createFakeEventLogger()
    );

    expect(fungus.isAlive).toBe(true);
    expect(fungus.energy).toBe(0);
    expect(fungus.health).toBe(99);
  });
});
