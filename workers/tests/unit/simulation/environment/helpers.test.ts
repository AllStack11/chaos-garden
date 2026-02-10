import { describe, expect, it } from 'vitest';
import {
  calculateDistanceBetweenEntities,
  clampValueToRange,
  calculateMovementEnergyCost,
  findNearestEntity
} from '../../../../src/simulation/environment/helpers';
import { buildHerbivore, buildPlant } from '../../../fixtures/entities';

describe('simulation/environment/helpers', () => {
  it('calculates euclidean distance between entities', () => {
    const first = buildPlant({ position: { x: 0, y: 0 } });
    const second = buildPlant({ id: 'plant-2', position: { x: 3, y: 4 } });

    expect(calculateDistanceBetweenEntities(first, second)).toBe(5);
  });

  it('clamps values to min and max bounds', () => {
    expect(clampValueToRange(10, 0, 5)).toBe(5);
    expect(clampValueToRange(-1, 0, 5)).toBe(0);
    expect(clampValueToRange(3, 0, 5)).toBe(3);
  });

  it('calculates movement energy cost using distance and efficiency', () => {
    expect(calculateMovementEnergyCost(10, 2)).toBeCloseTo(0.4, 5);
  });

  it('returns nearest entity without maxDistance', () => {
    const source = buildHerbivore({ position: { x: 0, y: 0 } });
    const nearPlant = buildPlant({ id: 'plant-near', position: { x: 10, y: 0 } });
    const farPlant = buildPlant({ id: 'plant-far', position: { x: 20, y: 0 } });

    const target = findNearestEntity(source, [nearPlant, farPlant], 'plant');

    expect(target?.id).toBe('plant-near');
  });

  it('respects maxDistance hard cutoff', () => {
    const source = buildHerbivore({ position: { x: 0, y: 0 } });
    const farPlant = buildPlant({ id: 'plant-far', position: { x: 200, y: 0 } });

    const target = findNearestEntity(source, [farPlant], 'plant', 50);

    expect(target).toBeNull();
  });

  it('accepts targets exactly on maxDistance boundary', () => {
    const source = buildHerbivore({ position: { x: 0, y: 0 } });
    const boundaryPlant = buildPlant({ id: 'plant-boundary', position: { x: 50, y: 0 } });

    const target = findNearestEntity(source, [boundaryPlant], 'plant', 50);

    expect(target?.id).toBe('plant-boundary');
  });

  it('returns null for empty candidates', () => {
    const source = buildHerbivore();

    expect(findNearestEntity(source, [], 'plant')).toBeNull();
  });
});
