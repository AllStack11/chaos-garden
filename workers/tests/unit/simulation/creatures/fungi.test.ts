import { describe, expect, it } from 'vitest';
import { processFungusBehaviorDuringTick } from '../../../../src/simulation/creatures/fungi';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildDeadMatter, buildFungus } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/fungi', () => {
  it('ignores dead matter outside perception radius', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 20 });
    const farDead = buildDeadMatter({ id: 'dead-far', position: { x: 100, y: 0 }, energy: 50 });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [farDead],
      createFakeEventLogger()
    );

    expect(result.touchedDeadMatter).toEqual([]);
    expect(farDead.energy).toBe(50);
  });

  it('moves slowly toward dead matter within perception but outside decomposition range', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 50, energy: 40 });
    const nearbyDead = buildDeadMatter({ id: 'dead-mid', position: { x: 40, y: 0 }, energy: 50 });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [nearbyDead],
      createFakeEventLogger()
    );

    expect(result.touchedDeadMatter).toEqual([]);
    expect(nearbyDead.energy).toBe(50);
    expect(fungus.position.x).toBeGreaterThan(0);
    expect(fungus.position.x).toBeLessThan(1);
  });

  it('decomposes dead matter in range and gains energy', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 100, energy: 40, decompositionRate: 1 });
    const deadMatter = buildDeadMatter({ id: 'dead-near', position: { x: 5, y: 0 }, energy: 50 });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment({ moisture: 1 }),
      [deadMatter],
      createFakeEventLogger()
    );

    expect(result.touchedDeadMatter).toHaveLength(1);
    expect(result.touchedDeadMatter[0].id).toBe('dead-near');
    expect(fungus.energy).toBeCloseTo(79.875, 3);
    expect(deadMatter.energy).toBe(10);
  });

  it('mutates dead matter energy in place so caller can persist the delta', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 100, energy: 40, decompositionRate: 1 });
    const deadMatter = buildDeadMatter({ id: 'dead-ref', position: { x: 5, y: 0 }, energy: 50 });
    const originalRef = deadMatter;

    await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment({ moisture: 1 }),
      [deadMatter],
      createFakeEventLogger()
    );

    // Same object reference — energy must be mutated in place
    expect(originalRef).toBe(deadMatter);
    expect(deadMatter.energy).toBeLessThan(50);
  });

  it('fully decomposes dead matter when energy is reduced to zero', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 100, energy: 40, decompositionRate: 10 });
    const deadMatter = buildDeadMatter({ id: 'dead-tiny', position: { x: 3, y: 0 }, energy: 2 });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment({ moisture: 1 }),
      [deadMatter],
      createFakeEventLogger()
    );

    expect(result.touchedDeadMatter).toHaveLength(1);
    expect(deadMatter.energy).toBe(0);
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

  it('picks nearest dead matter when multiple are in range', async () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 100, energy: 40, decompositionRate: 1 });
    const close = buildDeadMatter({ id: 'close', position: { x: 3, y: 0 }, energy: 20 });
    const far = buildDeadMatter({ id: 'far', position: { x: 60, y: 0 }, energy: 80 });

    const result = await processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment({ moisture: 1 }),
      [far, close],
      createFakeEventLogger()
    );

    // Only the nearest item should be touched
    expect(result.touchedDeadMatter[0].id).toBe('close');
    expect(far.energy).toBe(80);
  });
});
