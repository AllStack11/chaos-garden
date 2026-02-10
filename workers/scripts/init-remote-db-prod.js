#!/usr/bin/env node
/**
 * Production D1 initializer for Chaos Garden.
 *
 * Uses a seeded generator to create a fair population ratio of:
 * - mostly plants
 * - fewer herbivores
 * - fewest carnivores
 *
 * Usage:
 *   node scripts/init-remote-db-prod.js
 *   node scripts/init-remote-db-prod.js --seed=12345
 *   node scripts/init-remote-db-prod.js --total=22
 *   node scripts/init-remote-db-prod.js --verify-only
 *   node scripts/init-remote-db-prod.js --database=chaos-garden-db
 *   node scripts/init-remote-db-prod.js --config=wrangler.jsonc
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_DATABASE_NAME = 'chaos-garden-db';
const DEFAULT_WRANGLER_CONFIG = 'wrangler.jsonc';
const WORKERS_DIR = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.resolve(WORKERS_DIR, 'schema.sql');
const GARDEN_WIDTH = 800;
const GARDEN_HEIGHT = 600;
const DEFAULT_TOTAL_ENTITIES = 22;
const MIN_TOTAL_ENTITIES = 11;

function parseCliArgs(argv) {
  const parsedArgs = {
    verifyOnly: false,
    databaseName: DEFAULT_DATABASE_NAME,
    wranglerConfig: DEFAULT_WRANGLER_CONFIG,
    seed: null,
    totalEntities: DEFAULT_TOTAL_ENTITIES
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--verify-only') {
      parsedArgs.verifyOnly = true;
      continue;
    }

    if (token.startsWith('--seed=')) {
      const seedValue = Number(token.slice('--seed='.length));
      if (!Number.isInteger(seedValue)) {
        throw new Error('Invalid --seed value. Expected integer.');
      }
      parsedArgs.seed = seedValue;
      continue;
    }

    if (token === '--seed') {
      const nextToken = argv[index + 1];
      const seedValue = Number(nextToken);
      if (!nextToken || !Number.isInteger(seedValue)) {
        throw new Error('Invalid --seed value. Expected integer.');
      }
      parsedArgs.seed = seedValue;
      index += 1;
      continue;
    }

    if (token.startsWith('--total=')) {
      const totalValue = Number(token.slice('--total='.length));
      if (!Number.isInteger(totalValue) || totalValue < MIN_TOTAL_ENTITIES) {
        throw new Error(`Invalid --total value. Expected integer >= ${MIN_TOTAL_ENTITIES}.`);
      }
      parsedArgs.totalEntities = totalValue;
      continue;
    }

    if (token === '--total') {
      const nextToken = argv[index + 1];
      const totalValue = Number(nextToken);
      if (!nextToken || !Number.isInteger(totalValue) || totalValue < MIN_TOTAL_ENTITIES) {
        throw new Error(`Invalid --total value. Expected integer >= ${MIN_TOTAL_ENTITIES}.`);
      }
      parsedArgs.totalEntities = totalValue;
      index += 1;
      continue;
    }

    if (token.startsWith('--database=')) {
      const databaseName = token.slice('--database='.length).trim();
      if (!databaseName) {
        throw new Error('Invalid --database value. Expected non-empty database name.');
      }
      parsedArgs.databaseName = databaseName;
      continue;
    }

    if (token === '--database') {
      const nextToken = argv[index + 1];
      if (!nextToken) {
        throw new Error('Invalid --database value. Expected non-empty database name.');
      }
      parsedArgs.databaseName = nextToken.trim();
      index += 1;
      continue;
    }

    if (token.startsWith('--config=')) {
      const configPath = token.slice('--config='.length).trim();
      if (!configPath) {
        throw new Error('Invalid --config value. Expected non-empty config path.');
      }
      parsedArgs.wranglerConfig = configPath;
      continue;
    }

    if (token === '--config') {
      const nextToken = argv[index + 1];
      if (!nextToken) {
        throw new Error('Invalid --config value. Expected non-empty config path.');
      }
      parsedArgs.wranglerConfig = nextToken.trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (parsedArgs.seed === null) {
    parsedArgs.seed = Math.floor(Date.now() % 2147483647);
  }

  return parsedArgs;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, max) {
  return Math.floor(random() * max);
}

function randomFloatInRange(random, min, max) {
  return min + random() * (max - min);
}

function createDeterministicUuid(random) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = randomInt(random, 16);
    const v = char === 'x' ? n : ((n & 0x3) | 0x8);
    return v.toString(16);
  });
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function generatePopulationCounts(random, totalEntities) {
  const plantWeight = randomFloatInRange(random, 5.4, 6.6);
  const herbivoreWeight = randomFloatInRange(random, 2.8, 3.8);
  const carnivoreWeight = randomFloatInRange(random, 0.9, 1.4);
  const totalWeight = plantWeight + herbivoreWeight + carnivoreWeight;

  let plantCount = Math.round((plantWeight / totalWeight) * totalEntities);
  let herbivoreCount = Math.round((herbivoreWeight / totalWeight) * totalEntities);
  let carnivoreCount = totalEntities - plantCount - herbivoreCount;

  if (plantCount < 6) {
    const deficit = 6 - plantCount;
    plantCount = 6;
    herbivoreCount = Math.max(3, herbivoreCount - deficit);
  }

  if (herbivoreCount < 3) {
    const deficit = 3 - herbivoreCount;
    herbivoreCount = 3;
    plantCount = Math.max(6, plantCount - deficit);
  }

  if (carnivoreCount < 1) {
    const deficit = 1 - carnivoreCount;
    carnivoreCount = 1;
    plantCount = Math.max(6, plantCount - deficit);
  }

  const correctedTotal = plantCount + herbivoreCount + carnivoreCount;
  if (correctedTotal !== totalEntities) {
    plantCount += totalEntities - correctedTotal;
  }

  return { plantCount, herbivoreCount, carnivoreCount };
}

function generateName(type, index) {
  const prefixes = {
    plant: 'Flora',
    herbivore: 'Grazer',
    carnivore: 'Stalker'
  };

  return `${prefixes[type]}-${String(index + 1).padStart(2, '0')}`;
}

function createEntity(type, index, random, timestamp) {
  if (type === 'plant') {
    return {
      id: createDeterministicUuid(random),
      type,
      name: generateName(type, index),
      species: 'Flora',
      positionX: randomFloatInRange(random, 0, GARDEN_WIDTH),
      positionY: randomFloatInRange(random, 0, GARDEN_HEIGHT),
      energy: randomFloatInRange(random, 46, 58),
      traits: {
        reproductionRate: randomFloatInRange(random, 0.04, 0.07),
        metabolismEfficiency: randomFloatInRange(random, 0.9, 1.15),
        photosynthesisRate: randomFloatInRange(random, 0.85, 1.25)
      },
      timestamp
    };
  }

  if (type === 'herbivore') {
    return {
      id: createDeterministicUuid(random),
      type,
      name: generateName(type, index),
      species: 'Grazers',
      positionX: randomFloatInRange(random, 0, GARDEN_WIDTH),
      positionY: randomFloatInRange(random, 0, GARDEN_HEIGHT),
      energy: randomFloatInRange(random, 54, 66),
      traits: {
        reproductionRate: randomFloatInRange(random, 0.024, 0.036),
        movementSpeed: randomFloatInRange(random, 1.7, 2.7),
        metabolismEfficiency: randomFloatInRange(random, 0.9, 1.2),
        perceptionRadius: randomFloatInRange(random, 90, 130)
      },
      timestamp
    };
  }

  return {
    id: createDeterministicUuid(random),
    type,
    name: generateName(type, index),
    species: 'Stalkers',
    positionX: randomFloatInRange(random, 0, GARDEN_WIDTH),
    positionY: randomFloatInRange(random, 0, GARDEN_HEIGHT),
    energy: randomFloatInRange(random, 50, 62),
    traits: {
      reproductionRate: randomFloatInRange(random, 0.015, 0.025),
      movementSpeed: randomFloatInRange(random, 3.0, 3.9),
      metabolismEfficiency: randomFloatInRange(random, 0.95, 1.2),
      perceptionRadius: randomFloatInRange(random, 140, 175)
    },
    timestamp
  };
}

function generateEntities(seed, totalEntities) {
  const random = createSeededRandom(seed);
  const seedTimestamp = new Date().toISOString();
  const counts = generatePopulationCounts(random, totalEntities);

  const plants = Array.from({ length: counts.plantCount }, (_, index) =>
    createEntity('plant', index, random, seedTimestamp)
  );
  const herbivores = Array.from({ length: counts.herbivoreCount }, (_, index) =>
    createEntity('herbivore', index, random, seedTimestamp)
  );
  const carnivores = Array.from({ length: counts.carnivoreCount }, (_, index) =>
    createEntity('carnivore', index, random, seedTimestamp)
  );

  return {
    entities: [...plants, ...herbivores, ...carnivores],
    counts,
    seedTimestamp
  };
}

function runWranglerExecute(extraArgs, description, commandOptions) {
  const commandArgs = [
    'wrangler',
    'd1',
    'execute',
    commandOptions.databaseName,
    '--remote',
    '--config',
    commandOptions.wranglerConfig,
    ...extraArgs
  ];

  const result = spawnSync('npx', commandArgs, {
    cwd: WORKERS_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(`${description} failed.\nCommand: npx ${commandArgs.join(' ')}\n${combinedOutput}`);
  }

  return result.stdout || '';
}

function executeSqlPhase(sql, phaseName, commandOptions) {
  const tempFileName = `.tmp-prod-init-${phaseName.replace(/\s+/g, '-').toLowerCase()}.sql`;
  const tempFilePath = path.resolve(WORKERS_DIR, tempFileName);

  fs.writeFileSync(tempFilePath, sql, 'utf-8');

  try {
    console.log(`🧩 ${phaseName}...`);
    runWranglerExecute([`--file=${tempFileName}`], phaseName, commandOptions);
    console.log(`✅ ${phaseName} complete`);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

function executeSqlCommandJson(command, description, commandOptions) {
  const output = runWranglerExecute([`--command=${command}`, '--json'], description, commandOptions);
  const parsedOutput = JSON.parse(output);
  const [firstResult] = Array.isArray(parsedOutput) ? parsedOutput : [];
  const [firstRow] = firstResult?.results || [];
  return firstRow || null;
}

function assertVerification(checkName, isValid, details) {
  if (!isValid) {
    throw new Error(`Verification failed: ${checkName}. ${details}`);
  }
}

function createCleanupSql() {
  return `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS simulation_events;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS garden_state;
DROP TABLE IF EXISTS simulation_control;
DROP TABLE IF EXISTS system_metadata;
DROP TABLE IF EXISTS application_logs;
DROP INDEX IF EXISTS idx_application_logs_timestamp;
DROP INDEX IF EXISTS idx_application_logs_level;
DROP INDEX IF EXISTS idx_application_logs_component;
DROP INDEX IF EXISTS idx_application_logs_tick;
DROP INDEX IF EXISTS idx_application_logs_entity;
PRAGMA foreign_keys = ON;
`;
}

function createEntityInsertSql(entity) {
  return `
INSERT INTO entities (
  id, garden_state_id, born_at_tick, is_alive, type, name, species, position_x, position_y,
  energy, health, age, traits, lineage, created_at, updated_at
) VALUES (
  '${escapeSqlString(entity.id)}',
  (SELECT id FROM garden_state WHERE tick = 0 LIMIT 1),
  0,
  1,
  '${escapeSqlString(entity.type)}',
  '${escapeSqlString(entity.name)}',
  '${escapeSqlString(entity.species)}',
  ${entity.positionX},
  ${entity.positionY},
  ${entity.energy},
  100,
  0,
  '${escapeSqlString(JSON.stringify(entity.traits))}',
  'origin',
  '${entity.timestamp}',
  '${entity.timestamp}'
);`;
}

function createSeedSql(seedData, seed) {
  const { entities, counts, seedTimestamp } = seedData;
  const totalLiving = entities.length;

  const insertStatements = entities.map(createEntityInsertSql).join('\n');

  return `
${insertStatements}

UPDATE garden_state
SET
  timestamp = '${seedTimestamp}',
  sunlight = 0.0,
  plants = ${counts.plantCount},
  herbivores = ${counts.herbivoreCount},
  carnivores = ${counts.carnivoreCount},
  fungi = 0,
  dead_plants = 0,
  dead_herbivores = 0,
  dead_carnivores = 0,
  dead_fungi = 0,
  all_time_dead_plants = 0,
  all_time_dead_herbivores = 0,
  all_time_dead_carnivores = 0,
  all_time_dead_fungi = 0,
  total_living = ${totalLiving},
  total_dead = 0,
  all_time_dead = 0,
  total = ${totalLiving},
  weather_state = NULL
WHERE tick = 0;

INSERT INTO simulation_events (
  garden_state_id, tick, timestamp, event_type, description,
  entities_affected, tags, severity, metadata
) VALUES
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', 'Production garden initialized with fair-ratio seeded entities', '[]', '["genesis","production"]', 'LOW', '{"source":"production-init","seed":${seed}}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', '${counts.plantCount} plants seeded for production start', '[]', '["plant","birth"]', 'LOW', '{"count":${counts.plantCount},"type":"plants"}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', '${counts.herbivoreCount} herbivores seeded for production start', '[]', '["herbivore","birth"]', 'LOW', '{"count":${counts.herbivoreCount},"type":"herbivores"}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${seedTimestamp}', 'BIRTH', '${counts.carnivoreCount} carnivores seeded for production start', '[]', '["carnivore","birth"]', 'LOW', '{"count":${counts.carnivoreCount},"type":"carnivores"}');
`;
}

function runVerification(commandOptions) {
  console.log('🔍 Verifying production database invariants...');

  const population = executeSqlCommandJson(
    'SELECT plants, herbivores, carnivores, fungi, total_living FROM garden_state WHERE tick = 0 LIMIT 1',
    'Verifying tick zero population summary',
    commandOptions
  );

  assertVerification('tick zero row exists', population !== null, 'Expected a tick 0 row in garden_state.');

  const totalLiving = population.total_living;
  const plants = population.plants;
  const herbivores = population.herbivores;
  const carnivores = population.carnivores;
  const fungi = population.fungi;

  assertVerification('minimum plant count', plants >= 6, `Expected plants >= 6, got ${plants}.`);
  assertVerification('minimum herbivore count', herbivores >= 3, `Expected herbivores >= 3, got ${herbivores}.`);
  assertVerification('minimum carnivore count', carnivores >= 1, `Expected carnivores >= 1, got ${carnivores}.`);
  assertVerification('fungi count', fungi === 0, `Expected fungi = 0, got ${fungi}.`);

  const ratioLooksFair = plants > herbivores && herbivores > carnivores;
  assertVerification(
    'fair ratio ordering',
    ratioLooksFair,
    `Expected plants > herbivores > carnivores, got ${plants}/${herbivores}/${carnivores}.`
  );

  const entityCounts = executeSqlCommandJson(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN type='plant' AND is_alive=1 THEN 1 ELSE 0 END) AS plants, SUM(CASE WHEN type='herbivore' AND is_alive=1 THEN 1 ELSE 0 END) AS herbivores, SUM(CASE WHEN type='carnivore' AND is_alive=1 THEN 1 ELSE 0 END) AS carnivores FROM entities",
    'Verifying entity table counts',
    commandOptions
  );

  assertVerification('entity total matches garden_state', entityCounts.total === totalLiving, `Expected ${totalLiving}, got ${entityCounts.total}.`);
  assertVerification('plant table count matches', entityCounts.plants === plants, `Expected ${plants}, got ${entityCounts.plants}.`);
  assertVerification('herbivore table count matches', entityCounts.herbivores === herbivores, `Expected ${herbivores}, got ${entityCounts.herbivores}.`);
  assertVerification('carnivore table count matches', entityCounts.carnivores === carnivores, `Expected ${carnivores}, got ${entityCounts.carnivores}.`);

  console.log(`✅ Verification passed (plants/herbivores/carnivores: ${plants}/${herbivores}/${carnivores})`);
}

function initializeProductionDatabase(options) {
  const commandOptions = {
    databaseName: options.databaseName,
    wranglerConfig: options.wranglerConfig
  };

  console.log('🌿 Chaos Garden Production Database Initialization');
  console.log('===================================================');
  console.log(`Mode: ${options.verifyOnly ? 'verify-only' : 'full reset + seeded fair-ratio population'}`);
  console.log(`Database: ${commandOptions.databaseName}`);
  console.log(`Wrangler config: ${commandOptions.wranglerConfig}`);
  console.log(`Seed: ${options.seed}`);
  console.log(`Target population size: ${options.totalEntities}`);

  if (options.verifyOnly) {
    runVerification(commandOptions);
    return;
  }

  const seedData = generateEntities(options.seed, options.totalEntities);
  console.log(
    `Generated counts => plants: ${seedData.counts.plantCount}, herbivores: ${seedData.counts.herbivoreCount}, carnivores: ${seedData.counts.carnivoreCount}`
  );

  executeSqlPhase(createCleanupSql(), 'Dropping existing schema artifacts', commandOptions);
  executeSqlPhase(fs.readFileSync(SCHEMA_PATH, 'utf-8'), 'Applying schema.sql', commandOptions);
  executeSqlPhase(createSeedSql(seedData, options.seed), 'Applying production seed data', commandOptions);

  runVerification(commandOptions);
  console.log('🎉 Production D1 initialization completed successfully');
}

if (require.main === module) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    initializeProductionDatabase(options);
  } catch (error) {
    console.error('❌ Production D1 initialization failed');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  parseCliArgs,
  generatePopulationCounts,
  generateEntities,
  createSeedSql,
  initializeProductionDatabase
};
