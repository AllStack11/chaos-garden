import { describe, expect, it } from 'vitest';
import {
  BLOOM_GEOMETRY_LIMITS,
  calculateFlowerBloomGeometry,
  calculateLilyBloomGeometry,
} from '../entities/bloomGeometry.ts';

describe('rendering/entities/bloomGeometry', () => {
  it('clamps lily bloom geometry for extreme sizes', () => {
    const geometry = calculateLilyBloomGeometry(200);

    expect(geometry.bloomSize).toBe(BLOOM_GEOMETRY_LIMITS.maxLilyBloomSize);
    expect(geometry.petalWidth).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxLilyPetalWidth);
    expect(geometry.petalHeight).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxLilyPetalHeight);
    expect(geometry.centerRadius).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxLilyCenterRadius);
    expect(geometry.tubeWidth).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxLilyTubeWidth);
    expect(geometry.tubeHeight).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxLilyTubeHeight);
  });

  it('clamps generic flower bloom geometry for extreme sizes', () => {
    const geometry = calculateFlowerBloomGeometry(200, 2);

    expect(geometry.bloomSize).toBe(BLOOM_GEOMETRY_LIMITS.maxFlowerBloomSize);
    expect(geometry.outerPetalWidth).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxPetalRadius);
    expect(geometry.outerPetalHeight).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxPetalRadius * 0.5);
    expect(geometry.innerPetalWidth).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxPetalRadius * 0.6);
    expect(geometry.innerPetalHeight).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxPetalRadius * 0.3);
    expect(geometry.centerRadius).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxFlowerCenterRadius);
    expect(geometry.stamenOrbitRadius).toBeLessThanOrEqual(BLOOM_GEOMETRY_LIMITS.maxFlowerStamenOrbit);
  });

  it('preserves proportional scaling in normal range for flowers', () => {
    const smaller = calculateFlowerBloomGeometry(8, 1);
    const larger = calculateFlowerBloomGeometry(12, 1);

    expect(larger.outerPetalWidth).toBeGreaterThan(smaller.outerPetalWidth);
    expect(larger.outerPetalHeight).toBeGreaterThan(smaller.outerPetalHeight);
    expect(larger.centerRadius).toBeGreaterThan(smaller.centerRadius);
    expect(larger.outerPetalWidth).toBeLessThan(BLOOM_GEOMETRY_LIMITS.maxPetalRadius);
    expect(larger.centerRadius).toBeLessThan(BLOOM_GEOMETRY_LIMITS.maxFlowerCenterRadius);
  });

  it('preserves proportional scaling in normal range for lilies', () => {
    const smaller = calculateLilyBloomGeometry(8);
    const larger = calculateLilyBloomGeometry(12);

    expect(larger.petalWidth).toBeGreaterThan(smaller.petalWidth);
    expect(larger.petalHeight).toBeGreaterThan(smaller.petalHeight);
    expect(larger.centerRadius).toBeGreaterThan(smaller.centerRadius);
    expect(larger.petalWidth).toBeLessThan(BLOOM_GEOMETRY_LIMITS.maxLilyPetalWidth);
    expect(larger.centerRadius).toBeLessThan(BLOOM_GEOMETRY_LIMITS.maxLilyCenterRadius);
  });
});
