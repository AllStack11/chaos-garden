import type { Entity } from '@chaos-garden/shared';

const BASE_POSITION = { x: 100, y: 100 };
const BASE_TIMESTAMPS = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

export function buildPlant(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'plant-1',
    gardenStateId: 1,
    bornAtTick: 0,
    isAlive: true,
    type: 'plant',
    name: 'fern-whisper',
    species: 'fern',
    position: BASE_POSITION,
    energy: 50,
    health: 100,
    age: 0,
    reproductionRate: 0,
    metabolismEfficiency: 1,
    photosynthesisRate: 1,
    lineage: 'origin',
    ...BASE_TIMESTAMPS,
    ...overrides
  } as Entity;
}

export function buildHerbivore(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'herbivore-1',
    gardenStateId: 1,
    bornAtTick: 0,
    isAlive: true,
    type: 'herbivore',
    name: 'hare-stride',
    species: 'hare',
    position: BASE_POSITION,
    energy: 60,
    health: 100,
    age: 0,
    reproductionRate: 0,
    movementSpeed: 2,
    metabolismEfficiency: 1,
    perceptionRadius: 100,
    lineage: 'origin',
    ...BASE_TIMESTAMPS,
    ...overrides
  } as Entity;
}

export function buildCarnivore(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'carnivore-1',
    gardenStateId: 1,
    bornAtTick: 0,
    isAlive: true,
    type: 'carnivore',
    name: 'fang-hunter',
    species: 'stalkers',
    position: BASE_POSITION,
    energy: 50,
    health: 100,
    age: 0,
    reproductionRate: 0,
    movementSpeed: 3.5,
    metabolismEfficiency: 1.1,
    perceptionRadius: 150,
    lineage: 'origin',
    ...BASE_TIMESTAMPS,
    ...overrides
  } as Entity;
}

export function buildFungus(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'fungus-1',
    gardenStateId: 1,
    bornAtTick: 0,
    isAlive: true,
    type: 'fungus',
    name: 'spore-web',
    species: 'mycelium',
    position: BASE_POSITION,
    energy: 40,
    health: 100,
    age: 0,
    reproductionRate: 0,
    metabolismEfficiency: 1.2,
    decompositionRate: 1,
    perceptionRadius: 50,
    lineage: 'origin',
    ...BASE_TIMESTAMPS,
    ...overrides
  } as Entity;
}
