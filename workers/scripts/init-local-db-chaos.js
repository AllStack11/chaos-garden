#!/usr/bin/env node
/**
 * CHAOS MODE D1 initializer for Chaos Garden.
 *
 * Every run is pure random chaos:
 * - Wild, unpredictable entity counts (5-80 total)
 * - Traits sampled from extreme ranges far beyond normal bounds
 * - No habitat zoning — entities scattered everywhere
 * - Random starting health and energy
 * - Random environment conditions (temperature, sunlight, moisture)
 * - Could spawn 40 carnivores and 1 plant. Good luck.
 *
 * Usage:
 *   node scripts/init-local-db-chaos.js
 *   node scripts/init-local-db-chaos.js --seed=666
 *   node scripts/init-local-db-chaos.js --remote
 *   node scripts/init-local-db-chaos.js --remote --database=chaos-garden-db
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_DATABASE_NAME = 'chaos-garden-db';
const DEFAULT_LOCAL_WRANGLER_CONFIG = 'wrangler.local.jsonc';
const DEFAULT_PRODUCTION_WRANGLER_CONFIG = 'wrangler.jsonc';
const DEFAULT_PERSIST_PATH = '.wrangler/local-state';
const WORKERS_DIR = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.resolve(WORKERS_DIR, 'schema.sql');
const CURRENT_SCHEMA_VERSION = '1.6.0';

const GARDEN_WIDTH = 800;
const GARDEN_HEIGHT = 600;

// Chaos trait ranges — way beyond normal simulation bounds
const CHAOS_TRAIT_RANGES = {
  plant: {
    energy: [5, 100],
    health: [10, 100],
    reproductionRate: [0.005, 0.2],
    metabolismEfficiency: [0.3, 2.5],
    photosynthesisRate: [0.1, 3.0]
  },
  herbivore: {
    energy: [5, 100],
    health: [10, 100],
    reproductionRate: [0.005, 0.15],
    movementSpeed: [0.3, 6.0],
    metabolismEfficiency: [0.3, 2.5],
    perceptionRadius: [10, 300],
    threatDetectionRadius: [10, 350]
  },
  carnivore: {
    energy: [5, 100],
    health: [10, 100],
    reproductionRate: [0.005, 0.12],
    movementSpeed: [0.5, 8.0],
    metabolismEfficiency: [0.3, 2.5],
    perceptionRadius: [10, 350]
  },
  fungus: {
    energy: [5, 100],
    health: [10, 100],
    reproductionRate: [0.005, 0.15],
    metabolismEfficiency: [0.3, 2.5],
    decompositionRate: [0.2, 3.0],
    perceptionRadius: [5, 200]
  }
};

const NAME_PREFIXES = {
  plant: ['Fern', 'Flower', 'Grass', 'Vine', 'Succulent', 'Lily', 'Moss', 'Cactus', 'Bush', 'Herb', 'Bloom', 'Root', 'Petal', 'Sprig', 'Ivy', 'Thistle', 'Daisy', 'Willow', 'Briar', 'Aloe', 'Crystal', 'Prism', 'Shard', 'Coral', 'Reef', 'Kelp', 'Drake', 'Spike', 'Void', 'Rose'],
  herbivore: ['Butterfly', 'Beetle', 'Rabbit', 'Snail', 'Cricket', 'Ladybug', 'Grasshopper', 'Ant', 'Bee', 'Moth', 'Hare', 'Weevil', 'Pika', 'Locust', 'Wren', 'Mole', 'Mouse', 'Lark', 'Finch', 'Dormouse', 'Centipede', 'Crawler'],
  carnivore: ['Fang', 'Claw', 'Night', 'Shadow', 'Sharp', 'Hunt', 'Stalk', 'Blood', 'Pounce', 'Roar', 'Razor', 'Talon', 'Snap', 'Rift', 'Dire', 'Gloom', 'Viper', 'Onyx', 'Storm', 'Feral', 'Wolf', 'Hawk', 'Eagle', 'Cobra', 'Vulture', 'Slither', 'Bane', 'Grim'],
  fungus: ['Spore', 'Cap', 'Mycel', 'Mold', 'Glow', 'Damp', 'Shroom', 'Puff', 'Web', 'Rot', 'Gill', 'Hypha', 'Lichen', 'Bristle', 'Veil', 'Soot', 'Wisp', 'Scale', 'Mire', 'Amber']
};

const NAME_MODIFIERS = {
  plant: ['sun', 'stone', 'mist', 'chaos', 'void', 'doom', 'wild', 'cursed', 'twisted', 'feral', 'mutant', 'glitch'],
  herbivore: ['frantic', 'lost', 'doomed', 'feral', 'cursed', 'wild', 'panicked', 'rabid', 'warped', 'glitch', 'hyper', 'dizzy'],
  carnivore: ['berserk', 'chaos', 'mad', 'doom', 'cursed', 'void', 'warp', 'feral', 'rabid', 'unhinged', 'rogue', 'savage'],
  fungus: ['toxic', 'chaos', 'void', 'doom', 'cursed', 'mutant', 'twisted', 'aberrant', 'primal', 'eldritch', 'fetid', 'glitch']
};

const NAME_SUFFIXES = {
  plant: ['scream', 'burst', 'warp', 'doom', 'blight', 'surge', 'howl', 'rift', 'quake', 'storm', 'bloom', 'thorn'],
  herbivore: ['panic', 'scramble', 'crash', 'tumble', 'bolt', 'frenzy', 'spiral', 'blur', 'havoc', 'stampede', 'dash', 'chaos'],
  carnivore: ['rampage', 'fury', 'havoc', 'carnage', 'mayhem', 'frenzy', 'blitz', 'doom', 'wrath', 'ruin', 'strike', 'hunt'],
  fungus: ['plague', 'blight', 'swarm', 'eruption', 'cascade', 'miasma', 'sprawl', 'ooze', 'surge', 'creep', 'doom', 'rot']
};

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(random, min, max) {
  return min + random() * (max - min);
}

function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

function createDeterministicUuid(random) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = Math.floor(random() * 16);
    const v = char === 'x' ? n : ((n & 0x3) | 0x8);
    return v.toString(16);
  });
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function parseCliArgs(argv) {
  const parsedArgs = {
    remote: false,
    seed: null,
    databaseName: DEFAULT_DATABASE_NAME,
    wranglerConfig: DEFAULT_LOCAL_WRANGLER_CONFIG,
    persistPath: DEFAULT_PERSIST_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

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

    if (token === '--remote') {
      parsedArgs.remote = true;
      parsedArgs.wranglerConfig = DEFAULT_PRODUCTION_WRANGLER_CONFIG;
      parsedArgs.persistPath = '';
      continue;
    }

    if (token.startsWith('--database=')) {
      parsedArgs.databaseName = token.slice('--database='.length).trim();
      continue;
    }

    if (token === '--database') {
      parsedArgs.databaseName = argv[++index]?.trim();
      continue;
    }

    if (token.startsWith('--config=')) {
      parsedArgs.wranglerConfig = token.slice('--config='.length).trim();
      continue;
    }

    if (token === '--config') {
      parsedArgs.wranglerConfig = argv[++index]?.trim();
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (parsedArgs.seed === null) {
    parsedArgs.seed = Math.floor(Math.random() * 2147483647);
  }

  return parsedArgs;
}

function generateChaosName(type, usedNames, random) {
  const prefixes = NAME_PREFIXES[type];
  const modifiers = NAME_MODIFIERS[type];
  const suffixes = NAME_SUFFIXES[type];

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const prefix = pick(random, prefixes);
    const modifier = pick(random, modifiers);
    const suffix = pick(random, suffixes);

    // Randomly decide name structure
    const roll = random();
    let name;
    if (roll < 0.3) {
      name = `${prefix}-${suffix}`;
    } else if (roll < 0.7) {
      name = `${prefix}-${modifier}-${suffix}`;
    } else {
      name = `${prefix}-${modifier}-${pick(random, modifiers)}-${suffix}`;
    }

    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const fallback = `${pick(random, prefixes)}-chaos-${usedNames.size}`;
  usedNames.add(fallback);
  return fallback;
}

function generateChaosTraits(type, random) {
  const ranges = CHAOS_TRAIT_RANGES[type];
  const traits = {};

  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (key === 'energy' || key === 'health') continue;
    traits[key] = randomFloat(random, min, max);
  }

  return traits;
}

function generateChaosCounts(random) {
  // Total entities: anywhere from 5 to 80. Absolute madness.
  const totalBudget = randomInt(random, 5, 80);

  // Randomly distribute budget across types with no balancing whatsoever
  const weights = [random(), random(), random(), random()];
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let plantCount = Math.max(0, Math.round((weights[0] / totalWeight) * totalBudget));
  let herbivoreCount = Math.max(0, Math.round((weights[1] / totalWeight) * totalBudget));
  let carnivoreCount = Math.max(0, Math.round((weights[2] / totalWeight) * totalBudget));
  let fungusCount = Math.max(0, Math.round((weights[3] / totalWeight) * totalBudget));

  // Ensure at least 1 entity total
  const total = plantCount + herbivoreCount + carnivoreCount + fungusCount;
  if (total === 0) {
    plantCount = 1;
  }

  return { plantCount, herbivoreCount, carnivoreCount, fungusCount };
}

function generateChaosEnvironment(random) {
  return {
    temperature: randomFloat(random, -10, 50),   // could be arctic or scorching
    sunlight: randomFloat(random, 0, 1),          // any time of day
    moisture: randomFloat(random, 0, 1)           // desert to swamp
  };
}

function generateChaosEntities(seed) {
  const random = createSeededRandom(seed);
  const timestamp = new Date().toISOString();
  const counts = generateChaosCounts(random);
  const environment = generateChaosEnvironment(random);
  const entities = [];
  const usedNames = new Set();

  const typeConfigs = [
    { type: 'plant', species: 'Flora', count: counts.plantCount },
    { type: 'herbivore', species: 'Grazers', count: counts.herbivoreCount },
    { type: 'carnivore', species: 'Stalkers', count: counts.carnivoreCount },
    { type: 'fungus', species: 'Mycelium', count: counts.fungusCount }
  ];

  for (const config of typeConfigs) {
    for (let i = 0; i < config.count; i += 1) {
      const ranges = CHAOS_TRAIT_RANGES[config.type];
      const energy = randomFloat(random, ranges.energy[0], ranges.energy[1]);
      const health = randomFloat(random, ranges.health[0], ranges.health[1]);
      const traits = generateChaosTraits(config.type, random);

      entities.push({
        id: createDeterministicUuid(random),
        type: config.type,
        name: generateChaosName(config.type, usedNames, random),
        species: config.species,
        positionX: randomFloat(random, 0, GARDEN_WIDTH),
        positionY: randomFloat(random, 0, GARDEN_HEIGHT),
        energy,
        health,
        traits,
        timestamp
      });
    }
  }

  return { entities, counts, environment, timestamp };
}

function createEntityInsertSql(entity) {
  return `
INSERT INTO entities (
  id, garden_state_id, born_at_tick, is_alive, type, name, species, position_x, position_y,
  energy, health, age, traits, lineage, created_at, updated_at
) VALUES (
  '${escapeSqlString(entity.id)}',
  (SELECT id FROM garden_state WHERE tick = 0 LIMIT 1),
  0, 1,
  '${escapeSqlString(entity.type)}',
  '${escapeSqlString(entity.name)}',
  '${escapeSqlString(entity.species)}',
  ${entity.positionX},
  ${entity.positionY},
  ${entity.energy},
  ${entity.health},
  0,
  '${escapeSqlString(JSON.stringify(entity.traits))}',
  'origin',
  '${entity.timestamp}',
  '${entity.timestamp}'
);`;
}

function createSeedSql(seedData, seed) {
  const { entities, counts, environment, timestamp } = seedData;
  const totalLiving = entities.length;

  const insertStatements = entities.map(createEntityInsertSql).join('\n');

  return `
${insertStatements}

UPDATE garden_state
SET
  timestamp = '${timestamp}',
  temperature = ${environment.temperature},
  sunlight = ${environment.sunlight},
  moisture = ${environment.moisture},
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
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${timestamp}', 'BIRTH', 'CHAOS MODE ACTIVATED. All bets are off.', '[]', '["genesis","chaos"]', 'CRITICAL', '{"source":"chaos-init","seed":${seed},"environment":${escapeSqlString(JSON.stringify(environment))}}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${timestamp}', 'BIRTH', '${counts.plantCount} plants materialized from the void', '[]', '["plant","birth","chaos"]', 'MEDIUM', '{"count":${counts.plantCount}}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${timestamp}', 'BIRTH', '${counts.herbivoreCount} herbivores were hurled into existence', '[]', '["herbivore","birth","chaos"]', 'MEDIUM', '{"count":${counts.herbivoreCount}}'),
  ((SELECT id FROM garden_state WHERE tick = 0 LIMIT 1), 0, '${timestamp}', 'BIRTH', '${counts.carnivoreCount} carnivores and ${counts.fungusCount} fungi emerged from pure entropy', '[]', '["carnivore","fungus","birth","chaos"]', 'MEDIUM', '{"carnivoreCount":${counts.carnivoreCount},"fungusCount":${counts.fungusCount}}');
`;
}

function runWranglerExecute(extraArgs, description, commandOptions) {
  const modeArg = commandOptions.remote ? '--remote' : '--local';
  const baseArgs = [
    'wrangler', 'd1', 'execute',
    commandOptions.databaseName,
    modeArg,
    '--config', commandOptions.wranglerConfig
  ];

  if (!commandOptions.remote) {
    baseArgs.push('--persist-to', commandOptions.persistPath);
  }

  const commandArgs = [...baseArgs, ...extraArgs];
  const result = spawnSync('npx', commandArgs, {
    cwd: WORKERS_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const lockHint = /database is locked|SQLITE_BUSY/i.test(combinedOutput)
      ? '\nHint: local D1 is locked. Stop `npm run backend` / `wrangler dev` and rerun the script.'
      : '';

    throw new Error(
      `${description} failed.\nCommand: npx ${commandArgs.join(' ')}\n${combinedOutput}${lockHint}`
    );
  }

  return result.stdout || '';
}

function executeSqlPhase(sql, phaseName, commandOptions) {
  const tempFileName = `.tmp-chaos-init-${phaseName.replace(/\s+/g, '-').toLowerCase()}.sql`;
  const tempFilePath = path.resolve(WORKERS_DIR, tempFileName);

  fs.writeFileSync(tempFilePath, sql, 'utf-8');

  try {
    console.log(`🔥 ${phaseName}...`);
    runWranglerExecute([`--file=${tempFileName}`], phaseName, commandOptions);
    console.log(`💥 ${phaseName} complete`);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
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

function createSchemaVersionNormalizationSql() {
  return `
INSERT OR REPLACE INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '${CURRENT_SCHEMA_VERSION}', datetime('now'));
`;
}

function initializeChaosDatabase(options) {
  const commandOptions = {
    remote: options.remote,
    databaseName: options.databaseName,
    wranglerConfig: options.wranglerConfig,
    persistPath: options.persistPath
  };

  const seedData = generateChaosEntities(options.seed);
  const { counts, environment, entities } = seedData;
  const totalLiving = entities.length;

  console.log('');
  console.log('🌋🌋🌋  C H A O S   M O D E  🌋🌋🌋');
  console.log('======================================');
  console.log(`Target: ${options.remote ? 'REMOTE D1 (!!!)' : 'local D1'}`);
  console.log(`Database: ${commandOptions.databaseName}`);
  console.log(`Seed: ${options.seed}`);
  console.log('');
  console.log('--- CHAOS MANIFEST ---');
  console.log(`  Plants:     ${counts.plantCount}`);
  console.log(`  Herbivores: ${counts.herbivoreCount}`);
  console.log(`  Carnivores: ${counts.carnivoreCount}`);
  console.log(`  Fungi:      ${counts.fungusCount}`);
  console.log(`  TOTAL:      ${totalLiving}`);
  console.log('');
  console.log('--- ENVIRONMENT ---');
  console.log(`  Temperature: ${environment.temperature.toFixed(1)}°C`);
  console.log(`  Sunlight:    ${environment.sunlight.toFixed(3)}`);
  console.log(`  Moisture:    ${environment.moisture.toFixed(3)}`);
  console.log('');

  executeSqlPhase(createCleanupSql(), 'Obliterating existing world', commandOptions);
  executeSqlPhase(fs.readFileSync(SCHEMA_PATH, 'utf-8'), 'Laying down schema from the ashes', commandOptions);
  executeSqlPhase(createSchemaVersionNormalizationSql(), 'Stamping schema version', commandOptions);
  executeSqlPhase(createSeedSql(seedData, options.seed), 'Unleashing chaos entities', commandOptions);

  console.log('');
  console.log('🌋 CHAOS GARDEN INITIALIZED. THERE ARE NO RULES.');
  console.log('');
}

if (require.main === module) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    initializeChaosDatabase(options);
  } catch (error) {
    console.error('💀 Chaos initialization failed (ironic)');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  parseCliArgs,
  generateChaosEntities,
  generateChaosCounts,
  createSeedSql,
  initializeChaosDatabase
};
