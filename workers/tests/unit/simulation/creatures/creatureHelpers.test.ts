import { describe, expect, it } from 'vitest';
import {
  applyStarvationHealthDecay,
  isEntityDead
} from '../../../../src/simulation/creatures/creatureHelpers';
import { buildHerbivore } from '../../../fixtures/entities';

describe('simulation/creatures/creatureHelpers', () => {
  it('does not consider entity dead when only energy is zero', () => {
    const herbivore = buildHerbivore({ energy: 0, health: 50, isAlive: true });

    expect(isEntityDead(herbivore)).toBe(false);
  });

  it('marks entity dead when energy and health are both zero', () => {
    const herbivore = buildHerbivore({ energy: 0, health: 0, isAlive: true });

    expect(isEntityDead(herbivore)).toBe(true);
  });

  it('applies starvation decay and only dies when both pools are depleted', () => {
    const herbivore = buildHerbivore({ energy: 0, health: 2, isAlive: true });

    applyStarvationHealthDecay(herbivore, 1);
    expect(herbivore.isAlive).toBe(true);
    expect(herbivore.health).toBe(1);
    expect(herbivore.energy).toBe(0);

    applyStarvationHealthDecay(herbivore, 1);
    expect(herbivore.isAlive).toBe(false);
    expect(herbivore.health).toBe(0);
    expect(herbivore.energy).toBe(0);
  });
});
