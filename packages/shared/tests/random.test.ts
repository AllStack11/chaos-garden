import { describe, it, expect } from 'vitest';
import {
  createSeededRandom,
  randomRange,
  randomInt,
  randomChoice,
  randomChance,
  randomGaussian,
} from '../src/math/random.js';

describe('Deterministic PRNG', () => {
  it('produces identical sequences given identical seeds', () => {
    const prng1 = createSeededRandom(1337);
    const prng2 = createSeededRandom(1337);

    for (let i = 0; i < 100; i++) {
      expect(prng1()).toBe(prng2());
    }
  });

  it('produces different sequences given different seeds', () => {
    const prngA = createSeededRandom(42);
    const prngB = createSeededRandom(999);

    let identicalCount = 0;
    for (let i = 0; i < 50; i++) {
      if (prngA() === prngB()) identicalCount++;
    }
    expect(identicalCount).toBeLessThan(2);
  });

  it('generates values within randomRange bounds', () => {
    const prng = createSeededRandom(2026);
    for (let i = 0; i < 100; i++) {
      const val = randomRange(prng, 10, 25);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(25);
    }
  });

  it('generates integers within randomInt bounds inclusive', () => {
    const prng = createSeededRandom(555);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const val = randomInt(prng, 1, 5);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(5);
      seen.add(val);
    }
    expect(seen.size).toBe(5);
  });

  it('selects random elements from array with randomChoice', () => {
    const prng = createSeededRandom(777);
    const choices = ['plant', 'herbivore', 'carnivore', 'fungus'] as const;
    const counts: Record<string, number> = { plant: 0, herbivore: 0, carnivore: 0, fungus: 0 };

    for (let i = 0; i < 400; i++) {
      const picked = randomChoice(prng, choices);
      counts[picked]++;
    }

    for (const key of choices) {
      expect(counts[key]).toBeGreaterThan(40);
    }
  });

  it('evaluates randomChance according to probability', () => {
    const prng = createSeededRandom(888);
    let trueCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (randomChance(prng, 0.3)) trueCount++;
    }
    // 30% expected, should be roughly within 25% - 35%
    expect(trueCount / trials).toBeGreaterThan(0.24);
    expect(trueCount / trials).toBeLessThan(0.36);
  });

  it('generates Gaussian distribution with expected mean', () => {
    const prng = createSeededRandom(999);
    let sum = 0;
    const samples = 2000;
    for (let i = 0; i < samples; i++) {
      sum += randomGaussian(prng, 50, 10);
    }
    const sampleMean = sum / samples;
    expect(sampleMean).toBeGreaterThan(48);
    expect(sampleMean).toBeLessThan(52);
  });
});

