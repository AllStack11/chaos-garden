import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const requireModule = createRequire(import.meta.url);

interface SeedEntity {
  id: string;
  type: string;
  name: string;
  position_x: number;
  position_y: number;
  traits: Record<string, unknown>;
}

interface ParsedArgs {
  schemaOnly: boolean;
  verifyOnly: boolean;
  remote: boolean;
  seed: number;
  databaseName: string;
  wranglerConfig: string;
  persistPath: string;
}

const {
  DEFAULT_SEED,
  parseCliArgs,
  generateSeedEntities,
  getExpectedSeedCounts
}: {
  DEFAULT_SEED: number;
  parseCliArgs: (argv: string[]) => ParsedArgs;
  generateSeedEntities: (seed: number, gardenStateId?: number, timestamp?: string) => SeedEntity[];
  getExpectedSeedCounts: () => {
    plantCount: number;
    herbivoreCount: number;
    carnivoreCount: number;
    fungusCount: number;
    totalLivingCount: number;
    eventCount: number;
  };
} = requireModule('../../../scripts/init-local-db.js');

describe('scripts/init-local-db', () => {
  it('uses expected defaults when no CLI flags are provided', () => {
    const parsed = parseCliArgs([]);

    expect(parsed).toEqual({
      schemaOnly: false,
      verifyOnly: false,
      remote: false,
      seed: DEFAULT_SEED,
      databaseName: 'chaos-garden-db',
      wranglerConfig: 'wrangler.local.jsonc',
      persistPath: '.wrangler/local-state'
    });
  });

  it('parses schema-only and explicit seed flags', () => {
    const parsed = parseCliArgs(['--schema-only', '--seed=42']);

    expect(parsed).toEqual({
      schemaOnly: true,
      verifyOnly: false,
      remote: false,
      seed: 42,
      databaseName: 'chaos-garden-db',
      wranglerConfig: 'wrangler.local.jsonc',
      persistPath: '.wrangler/local-state'
    });
  });

  it('produces deterministic entities for the same seed', () => {
    const firstEntities = generateSeedEntities(20260210);
    const secondEntities = generateSeedEntities(20260210);

    const firstProjection = firstEntities.map((entity) => ({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      position_x: entity.position_x,
      position_y: entity.position_y,
      traits: entity.traits
    }));

    const secondProjection = secondEntities.map((entity) => ({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      position_x: entity.position_x,
      position_y: entity.position_y,
      traits: entity.traits
    }));

    expect(firstProjection).toEqual(secondProjection);
  });

  it('produces different deterministic outputs for different seeds', () => {
    const firstEntities = generateSeedEntities(20260210);
    const secondEntities = generateSeedEntities(42);

    const firstSignature = firstEntities.slice(0, 5).map((entity) => `${entity.id}:${entity.name}:${entity.position_x}:${entity.position_y}`);
    const secondSignature = secondEntities.slice(0, 5).map((entity) => `${entity.id}:${entity.name}:${entity.position_x}:${entity.position_y}`);

    expect(firstSignature).not.toEqual(secondSignature);
  });

  it('matches expected deterministic seed population totals', () => {
    const counts = getExpectedSeedCounts();
    const entities = generateSeedEntities(20260210);

    expect(entities.length).toBe(counts.totalLivingCount);
    expect(entities.filter((entity) => entity.type === 'plant')).toHaveLength(counts.plantCount);
    expect(entities.filter((entity) => entity.type === 'herbivore')).toHaveLength(counts.herbivoreCount);
    expect(entities.filter((entity) => entity.type === 'carnivore')).toHaveLength(counts.carnivoreCount);
    expect(entities.filter((entity) => entity.type === 'fungus')).toHaveLength(counts.fungusCount);
  });
});
