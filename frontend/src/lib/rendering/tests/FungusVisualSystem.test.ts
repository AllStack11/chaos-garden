import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFungusVisualCache,
  generateFungusVisual,
  getFungusVisual,
} from '../FungusVisualSystem.ts';
import { clearVisualGenomeCache } from '../VisualGenome.ts';

interface TestEntity {
  id: string;
  name: string;
  species: string;
  health: number;
  energy: number;
  position: { x: number; y: number };
  traits: {
    reproductionRate: number;
    metabolismEfficiency: number;
    decompositionRate: number;
    perceptionRadius: number;
  };
}

function createEntity(overrides: Partial<TestEntity> = {}): TestEntity {
  const base: TestEntity = {
    id: 'fungus-1',
    name: 'Spore-Bloom',
    species: 'forest-fungus',
    health: 85,
    energy: 70,
    position: { x: 5, y: 8 },
    traits: {
      reproductionRate: 0.7,
      metabolismEfficiency: 1.1,
      decompositionRate: 0.9,
      perceptionRadius: 30,
    },
  };

  return {
    ...base,
    ...overrides,
    traits: {
      ...base.traits,
      ...(overrides.traits ?? {}),
    },
  };
}

describe('rendering/FungusVisualSystem', () => {
  beforeEach(() => {
    clearFungusVisualCache();
    clearVisualGenomeCache();
  });

  it('classifies fungus type from generated name prefixes', () => {
    const puffball = generateFungusVisual(createEntity({ name: 'Spore-Drift' }));
    const toadstool = generateFungusVisual(createEntity({ id: 'fungus-2', name: 'Cap-Sprout' }));
    const shelf = generateFungusVisual(createEntity({ id: 'fungus-3', name: 'Rot-Bloom' }));
    const cluster = generateFungusVisual(createEntity({ id: 'fungus-4', name: 'Mycel-Web' }));

    expect(puffball.fungusType).toBe('puffball');
    expect(toadstool.fungusType).toBe('toadstool');
    expect(shelf.fungusType).toBe('shelf');
    expect(cluster.fungusType).toBe('cluster');
  });

  it('uses deterministic fallback classification for unknown names', () => {
    const first = generateFungusVisual(
      createEntity({
        id: 'fungus-5',
        name: 'Ancient Bloom',
        species: 'cryptic strain',
      }),
    );
    const second = generateFungusVisual(
      createEntity({
        id: 'fungus-6',
        name: 'Ancient Bloom',
        species: 'cryptic strain',
      }),
    );

    expect(second.fungusType).toBe(first.fungusType);
  });

  it('caches visuals by entity id and refreshes after cache clear', () => {
    const firstEntity = createEntity({ id: 'fungus-7', health: 100 });
    const first = getFungusVisual(firstEntity);
    const second = getFungusVisual({ ...firstEntity, health: 10 });

    expect(second).toBe(first);

    clearFungusVisualCache();

    const third = getFungusVisual({ ...firstEntity, health: 10 });
    expect(third).not.toBe(first);
    expect(third.droopFactor).toBeCloseTo(0.9);
  });
});
