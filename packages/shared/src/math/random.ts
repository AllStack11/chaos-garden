/**
 * Chaos Garden - Deterministic Seeded Pseudo-Random Number Generator
 * 
 * Implements a high-quality, fast Mulberry32 PRNG.
 * Guarantees that passing the same seed reproduces the exact same
 * simulation outcome across browsers, Node.js, and headless tests.
 */

export interface StatefulPRNG {
  (): number;
  getState(): number;
  setState(state: number): void;
}

export type PRNG = StatefulPRNG;

/**
 * Creates a deterministic Mulberry32 PRNG from an unsigned integer seed.
 * Returns a generator function outputting floating point numbers in [0, 1),
 * with serializable state inspection and restoration capabilities.
 */
export function createSeededRandom(seed: number, initialState?: number): StatefulPRNG {
  let state = initialState !== undefined ? (initialState | 0) : ((seed >>> 0) || 1);
  const next = function (): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.getState = (): number => state;
  next.setState = (newState: number): void => {
    state = newState | 0;
  };
  return next as StatefulPRNG;
}

/**
 * Alias for createSeededRandom using standard Mulberry32 algorithm.
 */
export const createMulberry32 = createSeededRandom;

export function randomRange(random: PRNG, min: number, max: number): number {
  return min + random() * (max - min);
}

export function randomInt(random: PRNG, min: number, max: number): number {
  return Math.floor(randomRange(random, min, max + 1));
}

export function randomChoice<T>(random: PRNG, array: readonly T[]): T {
  const index = Math.floor(random() * array.length);
  return array[index];
}

export function randomChance(random: PRNG, probability: number): boolean {
  return random() < probability;
}

/**
 * Generates a normally distributed random number (Gaussian/Normal distribution)
 * using the Box-Muller transform.
 */
export function randomGaussian(random: PRNG, mean: number = 0, stdDev: number = 1): number {
  let u1 = random();
  let u2 = random();
  // Avoid u1 == 0 which causes Math.log(0) == -Infinity
  while (u1 === 0) u1 = random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}
