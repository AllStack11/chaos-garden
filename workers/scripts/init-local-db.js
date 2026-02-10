#!/usr/bin/env node
/**
 * Deterministic local D1 initializer for Chaos Garden.
 *
 * Usage:
 *   node scripts/init-local-db.js
 *   node scripts/init-local-db.js --schema-only
 *   node scripts/init-local-db.js --seed=42
 *   node scripts/init-local-db.js --verify-only
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DATABASE_NAME = 'chaos-garden-db';
const WRANGLER_CONFIG = 'wrangler.local.jsonc';
const PERSIST_PATH = '.wrangler/local-state';
const WORKERS_DIR = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.resolve(WORKERS_DIR, 'schema.sql');
const CURRENT_SCHEMA_VERSION = '1.6.0';
const DEFAULT_SEED = 20260210;
const DEFAULT_SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

const GARDEN_WIDTH = 800;
const GARDEN_HEIGHT = 600;

const PLANT_ARCHETYPES = [
  { name: 'standard', count: 7, photosynthesisRate: 1.0, reproductionRate: 0.05, metabolismEfficiency: 1.0 },
  { name: 'fast-growing', count: 6, photosynthesisRate: 1.25, reproductionRate: 0.04, metabolismEfficiency: 0.95 },
  { name: 'prolific', count: 6, photosynthesisRate: 0.85, reproductionRate: 0.07, metabolismEfficiency: 1.0 },
  { name: 'hardy', count: 6, photosynthesisRate: 0.95, reproductionRate: 0.05, metabolismEfficiency: 1.15 }
];

const HERBIVORE_ARCHETYPES = [
  { name: 'fast', count: 4, movementSpeed: 2.8, metabolismEfficiency: 0.95, reproductionRate: 0.03, perceptionRadius: 105 },
  { name: 'efficient', count: 4, movementSpeed: 1.7, metabolismEfficiency: 1.2, reproductionRate: 0.03, perceptionRadius: 95 },
  { name: 'balanced', count: 4, movementSpeed: 2.1, metabolismEfficiency: 1.0, reproductionRate: 0.03, perceptionRadius: 100 },
  { name: 'scout', count: 3, movementSpeed: 2.4, metabolismEfficiency: 0.95, reproductionRate: 0.02, perceptionRadius: 130 }
];

const CARNIVORE_ARCHETYPES = [
  { name: 'sprinter', count: 1, movementSpeed: 3.8, metabolismEfficiency: 1.0, reproductionRate: 0.02, perceptionRadius: 155 },
  { name: 'patient', count: 1, movementSpeed: 3.0, metabolismEfficiency: 1.2, reproductionRate: 0.02, perceptionRadius: 165 }
];

// Start with no fungi; spores now enter the garden dynamically during simulation ticks.
const FUNGUS_ARCHETYPES = [];

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

function parseCliArgs(argv) {
  const parsedArgs = {
    schemaOnly: false,
    verifyOnly: false,
    seed: DEFAULT_SEED
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--schema-only') {
      parsedArgs.schemaOnly = true;
      continue;
    }

    if (token === '--verify-only') {
      parsedArgs.verifyOnly = true;
      continue;
    }

    if (token.startsWith('--seed=')) {
      const seedValue = Number(token.slice('--seed='.length));
      if (!Number.isInteger(seedValue)) {
        throw new Error(`Invalid --seed value: ${token.slice('--seed='.length)}`);
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

    throw new Error(`Unknown argument: ${token}`);
  }

  return parsedArgs;
}

function generateRandomName(type, usedNames, random) {
  const prefixes = {
    plant: ['Fern', 'Flower', 'Grass', 'Vine', 'Succulent', 'Lily', 'Moss', 'Cactus', 'Bush', 'Herb', 'Bloom', 'Root', 'Petal', 'Sprig', 'Ivy', 'Thistle', 'Daisy', 'Willow', 'Briar', 'Aloe'],
    herbivore: ['Butterfly', 'Beetle', 'Rabbit', 'Snail', 'Cricket', 'Ladybug', 'Grasshopper', 'Ant', 'Bee', 'Moth', 'Hare', 'Weevil', 'Pika', 'Locust', 'Wren', 'Mole', 'Mouse', 'Lark', 'Finch', 'Dormouse'],
    carnivore: ['Fang', 'Claw', 'Night', 'Shadow', 'Sharp', 'Hunt', 'Stalk', 'Blood', 'Pounce', 'Roar', 'Razor', 'Talon', 'Snap', 'Rift', 'Dire', 'Gloom', 'Viper', 'Onyx', 'Storm', 'Feral'],
    fungus: ['Spore', 'Cap', 'Mycel', 'Mold', 'Glow', 'Damp', 'Shroom', 'Puff', 'Web', 'Rot', 'Gill', 'Hypha', 'Lichen', 'Bristle', 'Veil', 'Soot', 'Wisp', 'Scale', 'Mire', 'Amber']
  };

  const modifiers = {
    plant: ['sun', 'stone', 'mist', 'meadow', 'river', 'dawn', 'amber', 'silver', 'verdant', 'hollow', 'wild', 'soft'],
    herbivore: ['swift', 'quiet', 'field', 'dust', 'wind', 'rush', 'bright', 'nimble', 'fleet', 'coast', 'hollow', 'reed'],
    carnivore: ['grim', 'night', 'iron', 'ember', 'void', 'ashen', 'frost', 'silent', 'wild', 'scar', 'thorn', 'rage'],
    fungus: ['deep', 'wet', 'moss', 'coal', 'murk', 'umbra', 'dusk', 'root', 'quiet', 'spore', 'bog', 'haze']
  };

  const suffixes = {
    plant: ['whisper', 'glow', 'heart', 'reach', 'shade', 'burst', 'thorn', 'bud', 'leaf', 'petal', 'sprout', 'canopy', 'bloom', 'vine', 'frond', 'seed', 'branch', 'grove', 'stem', 'crest'],
    herbivore: ['stride', 'dash', 'leap', 'bound', 'graze', 'fleet', 'fur', 'step', 'breeze', 'song', 'trail', 'hop', 'skitter', 'drift', 'scurry', 'glide', 'prance', 'flutter', 'forage', 'rush'],
    carnivore: ['strike', 'rip', 'tear', 'fang', 'pounce', 'shade', 'hunter', 'stalker', 'howl', 'ambush', 'slash', 'scourge', 'rake', 'lunge', 'snare', 'chase', 'raid', 'sunder', 'prowl', 'snarl'],
    fungus: ['pulse', 'spread', 'bloom', 'rot', 'puff', 'creep', 'glow', 'web', 'drift', 'spore', 'patch', 'ring', 'veil', 'fume', 'mold', 'tangle', 'cluster', 'raft', 'mat', 'frill']
  };

  const categoryPrefixes = prefixes[type];
  const categoryModifiers = modifiers[type];
  const categorySuffixes = suffixes[type];

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const prefix = categoryPrefixes[randomInt(random, categoryPrefixes.length)];
    const suffix = categorySuffixes[randomInt(random, categorySuffixes.length)];
    const shouldUseModifier = random() > 0.4;
    const modifier = categoryModifiers[randomInt(random, categoryModifiers.length)];
    const name = shouldUseModifier ? `${prefix}-${modifier}-${suffix}` : `${prefix}-${suffix}`;

    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const fallbackName = `${categoryPrefixes[0]}-${type}-${usedNames.size + 1}`;
  usedNames.add(fallbackName);
  return fallbackName;
}

function generateRandomPositionInGarden(random) {
  const x = random() * GARDEN_WIDTH;
  const y = random() * GARDEN_HEIGHT;
  return { x, y };
}

function generateSeedEntities(seed, gardenStateId = 1, timestamp = DEFAULT_SEED_TIMESTAMP) {
  const random = createSeededRandom(seed);
  const entities = [];
  const usedNamesByType = {
    plant: new Set(),
    herbivore: new Set(),
    carnivore: new Set(),
    fungus: new Set()
  };

  for (const archetype of PLANT_ARCHETYPES) {
    for (let index = 0; index < archetype.count; index += 1) {
      const position = generateRandomPositionInGarden(random);

      entities.push({
        id: createDeterministicUuid(random),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'plant',
        name: generateRandomName('plant', usedNamesByType.plant, random),
        species: 'Flora',
        position_x: position.x,
        position_y: position.y,
        energy: 50,
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          metabolismEfficiency: archetype.metabolismEfficiency,
          photosynthesisRate: archetype.photosynthesisRate
        },
        lineage: 'origin',
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }

  for (const archetype of HERBIVORE_ARCHETYPES) {
    for (let index = 0; index < archetype.count; index += 1) {
      const position = generateRandomPositionInGarden(random);

      entities.push({
        id: createDeterministicUuid(random),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'herbivore',
        name: generateRandomName('herbivore', usedNamesByType.herbivore, random),
        species: 'Grazers',
        position_x: position.x,
        position_y: position.y,
        energy: 60,
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          movementSpeed: archetype.movementSpeed,
          metabolismEfficiency: archetype.metabolismEfficiency,
          perceptionRadius: archetype.perceptionRadius
        },
        lineage: 'origin',
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }

  for (const archetype of CARNIVORE_ARCHETYPES) {
    for (let index = 0; index < archetype.count; index += 1) {
      const position = generateRandomPositionInGarden(random);

      entities.push({
        id: createDeterministicUuid(random),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'carnivore',
        name: generateRandomName('carnivore', usedNamesByType.carnivore, random),
        species: 'Stalkers',
        position_x: position.x,
        position_y: position.y,
        energy: 50,
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          movementSpeed: archetype.movementSpeed,
          metabolismEfficiency: archetype.metabolismEfficiency,
          perceptionRadius: archetype.perceptionRadius
        },
        lineage: 'origin',
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }

  for (const archetype of FUNGUS_ARCHETYPES) {
    for (let index = 0; index < archetype.count; index += 1) {
      const position = generateRandomPositionInGarden(random);

      entities.push({
        id: createDeterministicUuid(random),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'fungus',
        name: generateRandomName('fungus', usedNamesByType.fungus, random),
        species: 'Mycelium',
        position_x: position.x,
        position_y: position.y,
        energy: 40,
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          metabolismEfficiency: archetype.metabolismEfficiency,
          decompositionRate: archetype.decompositionRate,
          perceptionRadius: archetype.perceptionRadius
        },
        lineage: 'origin',
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }

  return entities;
}

function getExpectedSeedCounts() {
  const plantCount = PLANT_ARCHETYPES.reduce((sum, archetype) => sum + archetype.count, 0);
  const herbivoreCount = HERBIVORE_ARCHETYPES.reduce((sum, archetype) => sum + archetype.count, 0);
  const carnivoreCount = CARNIVORE_ARCHETYPES.reduce((sum, archetype) => sum + archetype.count, 0);
  const fungusCount = FUNGUS_ARCHETYPES.reduce((sum, archetype) => sum + archetype.count, 0);

  return {
    plantCount,
    herbivoreCount,
    carnivoreCount,
    fungusCount,
    totalLivingCount: plantCount + herbivoreCount + carnivoreCount + fungusCount,
    eventCount: 4
  };
}

function generateEntityInsertSql(entities) {
  return entities
    .map((entity) => {
      return `
INSERT INTO entities (
  id, garden_state_id, born_at_tick, is_alive, type, name, species, position_x, position_y,
  energy, health, age, traits, lineage, created_at, updated_at
) VALUES (
  '${escapeSqlString(entity.id)}', ${entity.garden_state_id}, ${entity.born_at_tick}, ${entity.is_alive}, '${escapeSqlString(entity.type)}', '${escapeSqlString(entity.name)}', '${escapeSqlString(entity.species)}',
  ${entity.position_x}, ${entity.position_y},
  ${entity.energy}, ${entity.health}, ${entity.age},
  '${escapeSqlString(JSON.stringify(entity.traits))}', '${escapeSqlString(entity.lineage)}',
  '${escapeSqlString(entity.created_at)}', '${escapeSqlString(entity.updated_at)}'
);`;
    })
    .join('\n');
}

function createSeedSql(seed) {
  const counts = getExpectedSeedCounts();
  const entities = generateSeedEntities(seed, 1, DEFAULT_SEED_TIMESTAMP);

  return `
${generateEntityInsertSql(entities)}

UPDATE garden_state
SET
  timestamp = '${DEFAULT_SEED_TIMESTAMP}',
  sunlight = 0.0,
  plants = ${counts.plantCount},
  herbivores = ${counts.herbivoreCount},
  carnivores = ${counts.carnivoreCount},
  fungi = ${counts.fungusCount},
  dead_plants = 0,
  dead_herbivores = 0,
  dead_carnivores = 0,
  dead_fungi = 0,
  all_time_dead_plants = 0,
  all_time_dead_herbivores = 0,
  all_time_dead_carnivores = 0,
  all_time_dead_fungi = 0,
  total_living = ${counts.totalLivingCount},
  total_dead = 0,
  all_time_dead = 0,
  total = ${counts.totalLivingCount},
  weather_state = NULL
WHERE tick = 0;

INSERT INTO simulation_events (
  garden_state_id, tick, timestamp, event_type, description,
  entities_affected, tags, severity, metadata
) VALUES
  (1, 0, '${DEFAULT_SEED_TIMESTAMP}', 'BIRTH', 'The Chaos Garden was created', '[]', '["genesis", "birth"]', 'LOW', '{"source": "initialization", "seed": ${seed}}'),
  (1, 0, '${DEFAULT_SEED_TIMESTAMP}', 'BIRTH', '${counts.plantCount} plants sprouted from the fertile soil', '[]', '["biology", "plant", "birth"]', 'LOW', '{"count": ${counts.plantCount}, "type": "plants"}'),
  (1, 0, '${DEFAULT_SEED_TIMESTAMP}', 'BIRTH', '${counts.herbivoreCount} herbivores wandered into the garden', '[]', '["biology", "herbivore", "birth"]', 'LOW', '{"count": ${counts.herbivoreCount}, "type": "herbivores"}'),
  (1, 0, '${DEFAULT_SEED_TIMESTAMP}', 'BIRTH', '${counts.carnivoreCount} carnivores claimed their territories', '[]', '["biology", "carnivore", "birth"]', 'LOW', '{"count": ${counts.carnivoreCount}, "type": "carnivores"}');
`;
}

function runWranglerExecute(extraArgs, description) {
  const baseArgs = [
    'wrangler',
    'd1',
    'execute',
    DATABASE_NAME,
    '--local',
    '--config',
    WRANGLER_CONFIG,
    '--persist-to',
    PERSIST_PATH
  ];

  const commandArgs = [...baseArgs, ...extraArgs];
  const result = spawnSync('npx', commandArgs, {
    cwd: WORKERS_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const lockHint = /database is locked|SQLITE_BUSY/i.test(combinedOutput)
      ? '\nHint: local D1 is locked. Stop `npm run backend` / `wrangler dev` and rerun `npm run db:init:local`.'
      : '';

    throw new Error(
      `${description} failed.\nCommand: npx ${commandArgs.join(' ')}\n${combinedOutput}${lockHint}`
    );
  }

  return result.stdout || '';
}

function executeSqlPhase(sql, phaseName) {
  const tempFileName = `.tmp-init-${phaseName.replace(/\s+/g, '-').toLowerCase()}.sql`;
  const tempFilePath = path.resolve(WORKERS_DIR, tempFileName);

  fs.writeFileSync(tempFilePath, sql, 'utf-8');

  try {
    console.log(`🧩 ${phaseName}...`);
    runWranglerExecute([`--file=${tempFileName}`], phaseName);
    console.log(`✅ ${phaseName} complete`);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

function executeSqlCommandJson(command, description) {
  const output = runWranglerExecute([`--command=${command}`, '--json'], description);
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

function runVerification(schemaOnly) {
  console.log('🔍 Verifying local database invariants...');

  const expectedCounts = getExpectedSeedCounts();
  const tableCheck = executeSqlCommandJson(
    `SELECT COUNT(*) AS table_count
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN ('garden_state', 'entities', 'simulation_events', 'simulation_control', 'system_metadata')`,
    'Verifying required tables'
  );
  assertVerification(
    'required tables',
    tableCheck?.table_count === 5,
    `Expected 5, got ${tableCheck?.table_count ?? 'null'}.`
  );

  const weatherColumnCheck = executeSqlCommandJson(
    `SELECT COUNT(*) AS weather_column_count
     FROM pragma_table_info('garden_state')
     WHERE name = 'weather_state'`,
    'Verifying weather_state column'
  );
  assertVerification(
    'weather_state column',
    weatherColumnCheck?.weather_column_count === 1,
    `Expected 1, got ${weatherColumnCheck?.weather_column_count ?? 'null'}.`
  );

  const versionCheck = executeSqlCommandJson(
    `SELECT value AS schema_version
     FROM system_metadata
     WHERE key = 'schema_version'
     LIMIT 1`,
    'Verifying schema version'
  );
  assertVerification(
    'schema version',
    versionCheck?.schema_version === CURRENT_SCHEMA_VERSION,
    `Expected ${CURRENT_SCHEMA_VERSION}, got ${versionCheck?.schema_version ?? 'null'}.`
  );

  const tickZeroCheck = executeSqlCommandJson(
    'SELECT COUNT(*) AS tick_zero_count FROM garden_state WHERE tick = 0',
    'Verifying tick zero baseline'
  );
  assertVerification(
    'tick zero baseline',
    tickZeroCheck?.tick_zero_count === 1,
    `Expected 1, got ${tickZeroCheck?.tick_zero_count ?? 'null'}.`
  );

  const entityCountCheck = executeSqlCommandJson(
    'SELECT COUNT(*) AS entity_count FROM entities',
    'Verifying entity count'
  );

  const eventCountCheck = executeSqlCommandJson(
    'SELECT COUNT(*) AS event_count FROM simulation_events',
    'Verifying event count'
  );

  if (schemaOnly) {
    assertVerification(
      'schema-only entity count',
      entityCountCheck?.entity_count === 0,
      `Expected 0, got ${entityCountCheck?.entity_count ?? 'null'}.`
    );
    assertVerification(
      'schema-only event count',
      eventCountCheck?.event_count === 0,
      `Expected 0, got ${eventCountCheck?.event_count ?? 'null'}.`
    );
  } else {
    assertVerification(
      'seeded entity count',
      entityCountCheck?.entity_count === expectedCounts.totalLivingCount,
      `Expected ${expectedCounts.totalLivingCount}, got ${entityCountCheck?.entity_count ?? 'null'}.`
    );
    assertVerification(
      'seeded event count',
      eventCountCheck?.event_count === expectedCounts.eventCount,
      `Expected ${expectedCounts.eventCount}, got ${eventCountCheck?.event_count ?? 'null'}.`
    );
  }

  console.log('✅ Verification passed');
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

function createSchemaVersionNormalizationSql() {
  return `
INSERT OR REPLACE INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '${CURRENT_SCHEMA_VERSION}', datetime('now'));
`;
}

function initializeDatabase(options) {
  const { seed, schemaOnly, verifyOnly } = options;

  console.log('🌿 Chaos Garden Local Database Initialization');
  console.log('===========================================');
  console.log(`Mode: ${verifyOnly ? 'verify-only' : schemaOnly ? 'schema-only' : 'full reset + deterministic seed'}`);
  console.log(`Seed: ${seed}`);

  if (verifyOnly) {
    runVerification(schemaOnly);
    return;
  }

  executeSqlPhase(createCleanupSql(), 'Dropping existing schema artifacts');
  executeSqlPhase(fs.readFileSync(SCHEMA_PATH, 'utf-8'), 'Applying schema.sql');
  executeSqlPhase(createSchemaVersionNormalizationSql(), 'Normalizing schema version');

  if (!schemaOnly) {
    executeSqlPhase(createSeedSql(seed), 'Applying deterministic seed data');
  }

  runVerification(schemaOnly);

  console.log('🎉 Local D1 initialization completed successfully');
}

if (require.main === module) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    initializeDatabase(options);
  } catch (error) {
    console.error('❌ Local D1 initialization failed');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_SEED,
  DEFAULT_SEED_TIMESTAMP,
  parseCliArgs,
  createSeededRandom,
  generateSeedEntities,
  getExpectedSeedCounts,
  createSeedSql,
  initializeDatabase
};
