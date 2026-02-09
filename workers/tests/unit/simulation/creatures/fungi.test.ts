import { describe, expect, it } from 'vitest';
import { processFungusBehaviorDuringTick } from '../../../../src/simulation/creatures/fungi';
import { buildEnvironment } from '../../../fixtures/environment';
import { buildFungus, buildHerbivore } from '../../../fixtures/entities';
import { createFakeEventLogger } from '../../../helpers/fake-event-logger';

describe('simulation/creatures/fungi', () => {
  it('ignores dead matter outside perception radius', () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 20 });
    const farDead = buildHerbivore({
      id: 'dead-far',
      position: { x: 100, y: 0 },
      isAlive: false,
      health: 0,
      energy: 50
    });

    const result = processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [farDead],
      createFakeEventLogger()
    );

    expect(result.decomposed).toEqual([]);
    expect(farDead.energy).toBe(50);
  });

  it('decomposes dead matter in range and gains energy', () => {
    const fungus = buildFungus({ position: { x: 0, y: 0 }, perceptionRadius: 100, energy: 40, decompositionRate: 1 });
    const deadHerbivore = buildHerbivore({
      id: 'dead-near',
      position: { x: 5, y: 0 },
      isAlive: false,
      health: 0,
      energy: 50
    });

    const result = processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment({ moisture: 1 }),
      [deadHerbivore],
      createFakeEventLogger()
    );

    expect(result.decomposed).toEqual(['dead-near']);
    expect(fungus.energy).toBeCloseTo(79.875, 3);
    expect(deadHerbivore.energy).toBe(10);
  });

  it('dies when energy reaches zero', () => {
    const fungus = buildFungus({ energy: 0.01 });

    processFungusBehaviorDuringTick(
      fungus,
      buildEnvironment(),
      [],
      createFakeEventLogger()
    );

    expect(fungus.isAlive).toBe(false);
    expect(fungus.energy).toBe(0);
  });
});
