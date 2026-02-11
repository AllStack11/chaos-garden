import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const requireModule = createRequire(import.meta.url);

type SeedType = 'plant' | 'herbivore' | 'carnivore' | 'fungus';

interface SeedEntity {
  id: string;
  type: SeedType;
  name: string;
  species: string;
  positionX: number;
  positionY: number;
  traits: Record<string, number>;
}

interface SeedData {
  entities: SeedEntity[];
  counts: {
    plantCount: number;
    herbivoreCount: number;
    carnivoreCount: number;
    fungusCount: number;
    totalLiving: number;
  };
  seedTimestamp: string;
}

const {
  generateEntities,
  parseSqlStatements,
  isRemoteImportAuthenticationError,
  determineCandidatePopulationCounts,
  calculateMinimumSameTypeDistance,
  getDiversitySummary,
  MIN_SPACING_BY_TYPE,
}: {
  generateEntities: (seed: number) => SeedData;
  parseSqlStatements: (sql: string) => string[];
  isRemoteImportAuthenticationError: (error: unknown) => boolean;
  determineCandidatePopulationCounts: (seed: number) => SeedData['counts'];
  calculateMinimumSameTypeDistance: (entities: SeedEntity[], type: SeedType) => number;
  getDiversitySummary: (entities: SeedEntity[]) => {
    totalNames: number;
    uniqueNameCount: number;
    uniqueSpeciesCounts: Record<SeedType, number>;
  };
  MIN_SPACING_BY_TYPE: Record<SeedType, number>;
} = requireModule('../../../scripts/init-remote-db-prod.js');

function getEntityTypeEntries(seedData: SeedData, type: SeedType): SeedEntity[] {
  return seedData.entities.filter((entity) => entity.type === type);
}

function getTraitSpread(entities: SeedEntity[], traitKey: string): { min: number; max: number } {
  const values = entities.map((entity) => entity.traits[traitKey]);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function toDeterministicProjection(seedData: SeedData): Array<{
  id: string;
  type: SeedType;
  name: string;
  species: string;
  positionX: number;
  positionY: number;
  traits: Record<string, number>;
}> {
  return seedData.entities.map((entity) => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    species: entity.species,
    positionX: entity.positionX,
    positionY: entity.positionY,
    traits: entity.traits,
  }));
}

describe('scripts/init-remote-db-prod', () => {
  it('produces deterministic entities for the same seed', () => {
    const first = generateEntities(20260210);
    const second = generateEntities(20260210);

    expect(first.counts).toEqual(second.counts);
    expect(toDeterministicProjection(first)).toEqual(toDeterministicProjection(second));
  });

  it('chooses minimal sustainable startup counts with fungi included', () => {
    const counts = determineCandidatePopulationCounts(20260210);

    expect(counts.totalLiving).toBeGreaterThanOrEqual(13);
    expect(counts.totalLiving).toBeLessThanOrEqual(16);
    expect(counts.plantCount).toBeGreaterThanOrEqual(8);
    expect(counts.herbivoreCount).toBeGreaterThanOrEqual(3);
    expect(counts.carnivoreCount).toBeGreaterThanOrEqual(1);
    expect(counts.fungusCount).toBeGreaterThanOrEqual(1);
    expect(counts.fungusCount).toBeLessThanOrEqual(2);
  });

  it('creates globally unique names and diverse species labels', () => {
    const seedData = generateEntities(20260210);
    const diversitySummary = getDiversitySummary(seedData.entities);

    expect(diversitySummary.uniqueNameCount).toBe(diversitySummary.totalNames);
    expect(diversitySummary.uniqueSpeciesCounts.plant).toBeGreaterThanOrEqual(5);
    expect(diversitySummary.uniqueSpeciesCounts.herbivore).toBeGreaterThanOrEqual(3);
    expect(diversitySummary.uniqueSpeciesCounts.carnivore).toBeGreaterThanOrEqual(1);
    expect(diversitySummary.uniqueSpeciesCounts.fungus).toBeGreaterThanOrEqual(1);
  });

  it('uses broad trait spreads across all trophic groups', () => {
    const seedData = generateEntities(20260210);
    const plants = getEntityTypeEntries(seedData, 'plant');
    const herbivores = getEntityTypeEntries(seedData, 'herbivore');
    const carnivores = getEntityTypeEntries(seedData, 'carnivore');
    const fungi = getEntityTypeEntries(seedData, 'fungus');

    const plantPhotosynthesisSpread = getTraitSpread(plants, 'photosynthesisRate');
    const herbivoreSpeedSpread = getTraitSpread(herbivores, 'movementSpeed');
    const carnivoreSpeedSpread = getTraitSpread(carnivores, 'movementSpeed');
    const fungusDecompositionSpread = getTraitSpread(fungi, 'decompositionRate');

    expect(plantPhotosynthesisSpread.max - plantPhotosynthesisSpread.min).toBeGreaterThan(0.35);
    expect(herbivoreSpeedSpread.max - herbivoreSpeedSpread.min).toBeGreaterThan(0.9);
    if (carnivores.length > 1) {
      expect(carnivoreSpeedSpread.max - carnivoreSpeedSpread.min).toBeGreaterThan(0.4);
    } else {
      expect(carnivores.length).toBe(1);
    }
    if (fungi.length > 1) {
      expect(fungusDecompositionSpread.max - fungusDecompositionSpread.min).toBeGreaterThan(0.1);
    } else {
      expect(fungi.length).toBe(1);
    }
  });

  it('enforces natural spacing floors per type while keeping zone structure', () => {
    const seedData = generateEntities(20260210);

    for (const type of ['plant', 'herbivore', 'carnivore', 'fungus'] as const) {
      const minimumDistance = calculateMinimumSameTypeDistance(seedData.entities, type);
      if (Number.isFinite(minimumDistance)) {
        expect(minimumDistance).toBeGreaterThanOrEqual(Math.max(8, MIN_SPACING_BY_TYPE[type] * 0.45));
      }
    }

    const plants = getEntityTypeEntries(seedData, 'plant');
    const herbivores = getEntityTypeEntries(seedData, 'herbivore');

    const averagePlantX = plants.reduce((sum, entity) => sum + entity.positionX, 0) / plants.length;
    const averageHerbivoreX = herbivores.reduce((sum, entity) => sum + entity.positionX, 0) / herbivores.length;

    // Habitat bands should not collapse to exactly the same centroid.
    expect(Math.abs(averagePlantX - averageHerbivoreX)).toBeGreaterThan(2);
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
