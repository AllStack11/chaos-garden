import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const requireModule = createRequire(import.meta.url);

interface SeedEntity {
  id: string;
  type: 'plant' | 'herbivore' | 'carnivore';
  name: string;
  species: string;
  traits: Record<string, number>;
}

interface SeedData {
  entities: SeedEntity[];
  counts: {
    plantCount: number;
    herbivoreCount: number;
    carnivoreCount: number;
  };
  seedTimestamp: string;
}

const {
  generateEntities,
  parseSqlStatements,
  isRemoteImportAuthenticationError
}: {
  generateEntities: (seed: number, totalEntities: number) => SeedData;
  parseSqlStatements: (sql: string) => string[];
  isRemoteImportAuthenticationError: (error: unknown) => boolean;
} = requireModule('../../../scripts/init-remote-db-prod.js');

function getEntityTypeEntries(seedData: SeedData, type: SeedEntity['type']): SeedEntity[] {
  return seedData.entities.filter((entity) => entity.type === type);
}

function getTraitSpread(entities: SeedEntity[], traitKey: string): { min: number; max: number } {
  const values = entities.map((entity) => entity.traits[traitKey]);
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function toDeterministicProjection(seedData: SeedData): Array<{
  id: string;
  type: SeedEntity['type'];
  name: string;
  species: string;
  traits: Record<string, number>;
}> {
  return seedData.entities.map((entity) => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    species: entity.species,
    traits: entity.traits
  }));
}

describe('scripts/init-remote-db-prod', () => {
  it('produces deterministic entities for the same seed and total', () => {
    const first = generateEntities(20260210, 22);
    const second = generateEntities(20260210, 22);

    expect(first.counts).toEqual(second.counts);
    expect(toDeterministicProjection(first)).toEqual(toDeterministicProjection(second));
  });

  it('creates globally unique names to maximize entity identity variety', () => {
    const seedData = generateEntities(20260210, 22);
    const names = seedData.entities.map((entity) => entity.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('includes classifier keywords across names to drive visible type diversity', () => {
    const seedData = generateEntities(20260210, 22);
    const plantNamePrefixes = new Set(getEntityTypeEntries(seedData, 'plant').map((entity) => entity.name.split('-')[0]));
    const herbivoreNamePrefixes = new Set(getEntityTypeEntries(seedData, 'herbivore').map((entity) => entity.name.split('-')[0]));
    const carnivoreNamePrefixes = new Set(getEntityTypeEntries(seedData, 'carnivore').map((entity) => entity.name.split('-')[0]));

    expect(plantNamePrefixes.size).toBeGreaterThanOrEqual(8);
    expect(herbivoreNamePrefixes.size).toBeGreaterThanOrEqual(5);
    expect(carnivoreNamePrefixes.size).toBeGreaterThanOrEqual(3);
  });

  it('spreads trait values across each range instead of clustering near one archetype', () => {
    const seedData = generateEntities(20260210, 22);
    const plants = getEntityTypeEntries(seedData, 'plant');
    const herbivores = getEntityTypeEntries(seedData, 'herbivore');
    const carnivores = getEntityTypeEntries(seedData, 'carnivore');

    const plantPhotosynthesisSpread = getTraitSpread(plants, 'photosynthesisRate');
    const herbivoreSpeedSpread = getTraitSpread(herbivores, 'movementSpeed');
    const carnivoreSpeedSpread = getTraitSpread(carnivores, 'movementSpeed');

    expect(plantPhotosynthesisSpread.max - plantPhotosynthesisSpread.min).toBeGreaterThan(0.4);
    expect(herbivoreSpeedSpread.max - herbivoreSpeedSpread.min).toBeGreaterThan(0.9);
    expect(carnivoreSpeedSpread.max - carnivoreSpeedSpread.min).toBeGreaterThan(0.4);
  });

  it('parses SQL statements without splitting semicolons inside string literals', () => {
    const sql = `
      INSERT INTO demo(text_value) VALUES ('alpha;beta');
      INSERT INTO demo(text_value) VALUES ('gamma');
    `;

    const statements = parseSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("'alpha;beta'");
  });

  it('parses SQL statements while preserving comment blocks safely', () => {
    const sql = `
      -- Ensure table exists;
      CREATE TABLE demo(id INTEGER PRIMARY KEY, label TEXT);
      /* this semicolon should not split; */
      INSERT INTO demo(label) VALUES ('sprout');
    `;

    const statements = parseSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('CREATE TABLE demo');
    expect(statements[1]).toContain("INSERT INTO demo(label) VALUES ('sprout')");
  });

  it('recognizes remote import auth failures across wrangler output formats', () => {
    const bracketedError = new Error('Authentication error [code: 10000]');
    const compactError = new Error('authentication error [code:10000]');
    const importEndpointError = new Error('request failed on /import with code: 10000');
    const nonAuthError = new Error('Syntax error near "DROPP"');

    expect(isRemoteImportAuthenticationError(bracketedError)).toBe(true);
    expect(isRemoteImportAuthenticationError(compactError)).toBe(true);
    expect(isRemoteImportAuthenticationError(importEndpointError)).toBe(true);
    expect(isRemoteImportAuthenticationError(nonAuthError)).toBe(false);
  });
});
