#!/usr/bin/env node
/**
 * Chaos Garden Local Database Initialization Script
 * 
 * This script initializes the local D1 database with schema and seed data.
 * It creates the first garden state and populates it with initial entities.
 * 
 * Usage: node scripts/init-local-db.js
 * 
 * Divine Purpose: To cultivate the first life in our local garden,
 * creating a foundation from which complexity can emerge.
 */

const { execSync } = require('child_process');

// Inline UUID v4 generator — matches generateEntityId() in the simulation engine
function generateEntityId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

// Naming Utility — matches generateRandomName() in the simulation engine (helpers.ts)
// Prefixes map to visual renderers on the frontend
function generateRandomName(type) {
  const prefixes = {
    plant: ['Fern', 'Flower', 'Grass', 'Vine', 'Succulent', 'Lily', 'Moss', 'Cactus', 'Bush', 'Herb'],
    herbivore: ['Butterfly', 'Beetle', 'Rabbit', 'Snail', 'Cricket', 'Ladybug', 'Grasshopper', 'Ant', 'Bee', 'Moth'],
    carnivore: ['Fang', 'Claw', 'Night', 'Shadow', 'Sharp', 'Hunt', 'Stalk', 'Blood', 'Pounce', 'Roar'],
    fungus: ['Spore', 'Cap', 'Mycel', 'Mold', 'Glow', 'Damp', 'Shroom', 'Puff', 'Web', 'Rot']
  };

  const suffixes = {
    plant: ['whisper', 'glow', 'heart', 'reach', 'shade', 'burst', 'thorn', 'bud', 'leaf', 'petal'],
    herbivore: ['stride', 'dash', 'leap', 'bound', 'graze', 'fleet', 'fur', 'step', 'breeze', 'song'],
    carnivore: ['strike', 'rip', 'tear', 'kill', 'fang', 'pounce', 'shade', 'hunter', 'stalker', 'howl'],
    fungus: ['pulse', 'spread', 'bloom', 'rot', 'puff', 'creep', 'glow', 'web', 'drift', 'spore']
  };

  const p = prefixes[type];
  const s = suffixes[type];
  
  const prefix = p[Math.floor(Math.random() * p.length)];
  const suffix = s[Math.floor(Math.random() * s.length)];
  
  return `${prefix}-${suffix}`;
}

// Configuration
const DATABASE_NAME = 'chaos-garden-db'; // Unified with wrangler.toml
const SCHEMA_FILE = 'schema.sql';
const path = require('path');
const WORKERS_DIR = path.resolve(__dirname, '..');

console.log('🌿 Chaos Garden Local Database Initialization');
console.log('===========================================\n');

// ==========================================
// Positioning Utilities
// ==========================================

// Three plant cluster centers — creates natural foraging grounds
const PLANT_CLUSTERS = [
  { x: 200, y: 300 },  // left-center
  { x: 400, y: 300 },  // center
  { x: 600, y: 300 },  // right-center
];
const CLUSTER_SPREAD = 120; // max distance from cluster center
const MIN_PLANT_DISTANCE = 40; // minimum distance between plants (matches simulation)

function generatePositionNearCluster(clusterCenter, spread) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * spread;
  const x = Math.max(0, Math.min(800, clusterCenter.x + Math.cos(angle) * distance));
  const y = Math.max(0, Math.min(600, clusterCenter.y + Math.sin(angle) * distance));
  return { x, y };
}

function isPositionFarEnoughFromExisting(position, existingEntities, minDistance) {
  for (const entity of existingEntities) {
    const dx = position.x - entity.position_x;
    const dy = position.y - entity.position_y;
    if (Math.sqrt(dx * dx + dy * dy) < minDistance) return false;
  }
  return true;
}

function generatePlantPositionInCluster(clusterCenter, existingPlants) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const position = generatePositionNearCluster(clusterCenter, CLUSTER_SPREAD);
    if (isPositionFarEnoughFromExisting(position, existingPlants, MIN_PLANT_DISTANCE)) {
      return position;
    }
  }
  // Fallback: accept any position in the cluster
  return generatePositionNearCluster(clusterCenter, CLUSTER_SPREAD);
}

// ==========================================
// Seed Entity Generation
// ==========================================

// Plant trait archetypes for natural selection
const PLANT_ARCHETYPES = [
  { name: 'standard',    count: 7, photosynthesisRate: 1.0, reproductionRate: 0.05, metabolismEfficiency: 1.0 },
  { name: 'fast-growing', count: 7, photosynthesisRate: 1.3, reproductionRate: 0.04, metabolismEfficiency: 1.0 },
  { name: 'prolific',    count: 6, photosynthesisRate: 0.8, reproductionRate: 0.07, metabolismEfficiency: 1.0 },
];

// Herbivore trait archetypes
const HERBIVORE_ARCHETYPES = [
  { name: 'fast',      count: 2, movementSpeed: 3.0, metabolismEfficiency: 0.9, reproductionRate: 0.03, perceptionRadius: 100 },
  { name: 'efficient', count: 2, movementSpeed: 1.5, metabolismEfficiency: 1.2, reproductionRate: 0.03, perceptionRadius: 100 },
  { name: 'balanced',  count: 1, movementSpeed: 2.0, metabolismEfficiency: 1.0, reproductionRate: 0.03, perceptionRadius: 100 },
];

// Fungus trait archetypes
const FUNGUS_ARCHETYPES = [
  { name: 'standard',   count: 2, decompositionRate: 1.0, reproductionRate: 0.04, metabolismEfficiency: 1.2, perceptionRadius: 50 },
  { name: 'efficient',  count: 2, decompositionRate: 1.4, reproductionRate: 0.03, metabolismEfficiency: 1.2, perceptionRadius: 50 },
];

function generateSeedEntities(gardenStateId) {
  const entities = [];
  const now = new Date().toISOString();

  // --- Plants (20 total) ---
  // Distributed across three clusters with trait variety
  let plantIndex = 0;
  for (const archetype of PLANT_ARCHETYPES) {
    for (let i = 0; i < archetype.count; i++) {
      const cluster = PLANT_CLUSTERS[plantIndex % PLANT_CLUSTERS.length];
      const position = generatePlantPositionInCluster(cluster, entities.filter(e => e.type === 'plant'));

      entities.push({
        id: generateEntityId(),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'plant',
        name: generateRandomName('plant'),
        species: 'Flora',
        position_x: position.x,
        position_y: position.y,
        energy: 50,   // simulation default
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          metabolismEfficiency: archetype.metabolismEfficiency,
          photosynthesisRate: archetype.photosynthesisRate
        },
        lineage: 'origin',
        created_at: now,
        updated_at: now
      });
      plantIndex++;
    }
  }

  // --- Herbivores (5 total) ---
  // Spawned near plant clusters so they find food immediately
  let herbivoreIndex = 0;
  for (const archetype of HERBIVORE_ARCHETYPES) {
    for (let i = 0; i < archetype.count; i++) {
      const cluster = PLANT_CLUSTERS[herbivoreIndex % PLANT_CLUSTERS.length];
      const position = generatePositionNearCluster(cluster, 80);

      entities.push({
        id: generateEntityId(),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'herbivore',
        name: generateRandomName('herbivore'),
        species: 'Grazers',
        position_x: position.x,
        position_y: position.y,
        energy: 60,   // simulation default
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          movementSpeed: archetype.movementSpeed,
          metabolismEfficiency: archetype.metabolismEfficiency,
          perceptionRadius: archetype.perceptionRadius
        },
        lineage: 'origin',
        created_at: now,
        updated_at: now
      });
      herbivoreIndex++;
    }
  }

  // --- Carnivore (1 total) ---
  // Placed at garden edge, must hunt inward — gives herbivores time to eat and reproduce
  entities.push({
    id: generateEntityId(),
    garden_state_id: gardenStateId,
    born_at_tick: 0,
    is_alive: 1,
    type: 'carnivore',
    name: generateRandomName('carnivore'),
    species: 'Stalkers',
    position_x: 750,
    position_y: 300,
    energy: 50,   // simulation default
    health: 100,
    age: 0,
    traits: {
      reproductionRate: 0.02,
      movementSpeed: 3.5,
      metabolismEfficiency: 1.1,
      perceptionRadius: 150
    },
    lineage: 'origin',
    created_at: now,
    updated_at: now
  });

  // --- Fungi (4 total) ---
  // Placed near plant clusters where herbivore-plant deaths are most likely
  let fungusIndex = 0;
  for (const archetype of FUNGUS_ARCHETYPES) {
    for (let i = 0; i < archetype.count; i++) {
      const cluster = PLANT_CLUSTERS[fungusIndex % PLANT_CLUSTERS.length];
      // Place fungi very close to cluster centers (within 30px)
      const position = generatePositionNearCluster(cluster, 30);

      entities.push({
        id: generateEntityId(),
        garden_state_id: gardenStateId,
        born_at_tick: 0,
        is_alive: 1,
        type: 'fungus',
        name: generateRandomName('fungus'),
        species: 'Mycelium',
        position_x: position.x,
        position_y: position.y,
        energy: 40,   // simulation default
        health: 100,
        age: 0,
        traits: {
          reproductionRate: archetype.reproductionRate,
          metabolismEfficiency: archetype.metabolismEfficiency,
          decompositionRate: archetype.decompositionRate,
          perceptionRadius: archetype.perceptionRadius
        },
        lineage: 'origin',
        created_at: now,
        updated_at: now
      });
      fungusIndex++;
    }
  }

  return entities;
}

// Generate SQL insert statements for entities
function generateEntityInsertSQL(entities) {
  if (entities.length === 0) return '';
  
  const inserts = entities.map(entity => `
    INSERT INTO entities (
      id, garden_state_id, born_at_tick, is_alive, type, name, species, position_x, position_y,
      energy, health, age, traits, lineage, created_at, updated_at
    ) VALUES (
      '${entity.id}', ${entity.garden_state_id}, ${entity.born_at_tick}, ${entity.is_alive}, '${entity.type}', '${entity.name}', '${entity.species}',
      ${entity.position_x}, ${entity.position_y},
      ${entity.energy}, ${entity.health}, ${entity.age},
      '${JSON.stringify(entity.traits)}', '${entity.lineage}',
      '${entity.created_at}', '${entity.updated_at}'
    );
  `).join('\n');
  
  return inserts;
}

// Generate seed data SQL
function generateSeedDataSQL(gardenStateId) {
  const entities = generateSeedEntities(gardenStateId);
  const now = new Date().toISOString();
  
  // Update garden state with population counts
  const plantCount = entities.filter(e => e.type === 'plant').length;
  const herbivoreCount = entities.filter(e => e.type === 'herbivore').length;
  const carnivoreCount = entities.filter(e => e.type === 'carnivore').length;
  const fungusCount = entities.filter(e => e.type === 'fungus').length;
  const totalCount = entities.length;

  const updateGardenStateSQL = `
    UPDATE garden_state
    SET
      plants = ${plantCount},
      herbivores = ${herbivoreCount},
      carnivores = ${carnivoreCount},
      fungi = ${fungusCount},
      total = ${totalCount},
      timestamp = '${now}'
    WHERE id = ${gardenStateId};
  `;
  
  // Create simulation events
  const createEventsSQL = `
    INSERT INTO simulation_events (
      garden_state_id, tick, timestamp, event_type, description,
      entities_affected, tags, severity, metadata
    ) VALUES
      (${gardenStateId}, 0, '${now}', 'BIRTH', 'The Chaos Garden was created', '[]', '["genesis", "birth"]', 'LOW', '{"source": "initialization"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '${plantCount} plants sprouted from the fertile soil', '[]', '["biology", "plant", "birth"]', 'LOW', '{"count": ${plantCount}, "type": "plants"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '${herbivoreCount} herbivores wandered into the garden', '[]', '["biology", "herbivore", "birth"]', 'LOW', '{"count": ${herbivoreCount}, "type": "herbivores"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '${fungusCount} fungi established their networks', '[]', '["biology", "fungus", "birth"]', 'LOW', '{"count": ${fungusCount}, "type": "fungi"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '${carnivoreCount} carnivore claimed its territory', '[]', '["biology", "carnivore", "birth"]', 'LOW', '{"count": ${carnivoreCount}, "type": "carnivores"}');
  `;
  
  // Create application logs
  const createLogsSQL = `
    INSERT INTO application_logs (
      timestamp, level, component, operation, message,
      metadata, tick
    ) VALUES
      ('${now}', 'INFO', 'INITIALIZATION', 'database_setup', 'Local database initialized with schema', '{"schema_version": "1.0.0"}', 0),
      ('${now}', 'INFO', 'INITIALIZATION', 'seed_data', 'Seed data created: ${plantCount} plants, ${herbivoreCount} herbivores, ${carnivoreCount} carnivores, ${fungusCount} fungi', '{"plants": ${plantCount}, "herbivores": ${herbivoreCount}, "carnivores": ${carnivoreCount}, "fungi": ${fungusCount}}', 0);
  `;
  
  return `
    -- ==========================================
    -- Seed Data for Chaos Garden
    -- Generated: ${now}
    -- ==========================================
    
    ${generateEntityInsertSQL(entities)}
    
    ${updateGardenStateSQL}
    
    ${createEventsSQL}
    
    ${createLogsSQL}
  `;
}

// Execute a SQL command using wrangler
function executeSQLCommand(command, description) {
  console.log(`📝 ${description}...`);
  
  try {
    // Write command to temporary file
    const fs = require('fs');
    const path = require('path');
    // Use a local temp file instead of /tmp to avoid permission/pathing issues
    const tempFile = path.resolve(WORKERS_DIR, '.tmp-init.sql');
    fs.writeFileSync(tempFile, command);
    
    // Execute using wrangler
    // We use --local to target the local D1 storage
    // We must specify the config file if it's not wrangler.jsonc/toml
    const configFlag = require('fs').existsSync(path.resolve(WORKERS_DIR, 'wrangler.local.jsonc')) 
      ? '--config wrangler.local.jsonc' 
      : '';
    
    const result = execSync(
      `npx wrangler d1 execute ${DATABASE_NAME} --local --file="${tempFile}" ${configFlag} --persist-to .wrangler/local-state`,
      { 
        cwd: WORKERS_DIR,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'] 
      }
    );
    
    console.log(`✅ ${description} completed`);
    
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    if (error.stdout) console.error('STDOUT:', error.stdout.toString());
    if (error.stderr) console.error('STDERR:', error.stderr.toString());
    throw error;
  }
}

// Main initialization function
async function initializeDatabase() {
  try {
    console.log('🚀 Starting local database initialization...\n');
    
    // Step 1: Check if wrangler is available
    console.log('🔍 Checking wrangler availability...');
    try {
      execSync(`cd "${WORKERS_DIR}" && npx wrangler --version`, { stdio: 'pipe' });
      console.log('✅ Wrangler is available\n');
    } catch {
      console.log('⚠️ Wrangler may not be properly installed. Trying to continue...\n');
    }
    
    // Step 2: Create the database if it doesn't exist
    console.log('🗄️  Setting up local D1 database...');
    const localConfigPath = path.resolve(WORKERS_DIR, 'wrangler.local.jsonc');
    const configFlag = require('fs').existsSync(localConfigPath) 
      ? '--config wrangler.local.jsonc' 
      : '';
      
    try {
      // Step 2: Create the database if it doesn't exist
      // In local mode, this mainly ensures the wrangler state is ready
      execSync(`npx wrangler d1 create ${DATABASE_NAME} ${configFlag}`, { 
        cwd: WORKERS_DIR,
        stdio: 'pipe' 
      });
      console.log('✅ Local database created\n');
    } catch (error) {
      // Database might already exist
      if (!error.message.includes('already exists')) {
        console.log('⚠️ Database may already exist or encountered error:', error.message);
      }
      console.log('✅ Database is ready\n');
    }
    
    // Step 2.5: Clean start - remove existing data if any
    console.log('🧹 Preparing a clean garden...');
    try {
      executeSQLCommand(
        'PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS garden_state; DROP TABLE IF EXISTS entities; DROP TABLE IF EXISTS simulation_events; DROP TABLE IF EXISTS application_logs; DROP TABLE IF EXISTS system_metadata; PRAGMA foreign_keys = ON;',
        'Clearing existing tables'
      );
    } catch (error) {
      console.log('⚠️ Could not clear existing tables, continuing anyway...');
    }
    
    // Step 3: Apply schema
    const schemaPath = `${WORKERS_DIR}/${SCHEMA_FILE}`;
    const schemaResult = executeSQLCommand(
      require('fs').readFileSync(schemaPath, 'utf-8'),
      'Applying database schema'
    );
    
    // Step 4: Get the garden state ID (should be 1 after schema creation)
    const gardenStateId = 1;
    
    // Step 5: Generate and apply seed data
    const seedDataSQL = generateSeedDataSQL(gardenStateId);
    const seedResult = executeSQLCommand(seedDataSQL, 'Creating seed data');
    
    // Step 6: Verify the database
    console.log('🔍 Verifying database setup...');
    const verifySQL = `
      SELECT 
        (SELECT COUNT(*) FROM garden_state) as garden_state_count,
        (SELECT COUNT(*) FROM entities) as entity_count,
        (SELECT COUNT(*) FROM simulation_events) as event_count,
        (SELECT COUNT(*) FROM application_logs) as log_count;
    `;
    
    const verifyResult = execSync(
      `npx wrangler d1 execute ${DATABASE_NAME} --local --command="${verifySQL.replace(/\n/g, ' ')}" ${configFlag} --persist-to .wrangler/local-state`,
      { 
        cwd: WORKERS_DIR,
        encoding: 'utf-8' 
      }
    );
    
    console.log('\n📊 Database Verification Results:');
    console.log(verifyResult);
    
    console.log('\n🎉 Chaos Garden Local Database Initialization Complete!');
    console.log('===================================================');
    console.log('✅ Schema applied');
    console.log('✅ Seed data created: 20 plants, 5 herbivores, 1 carnivore, 4 fungi');
    console.log('✅ Garden state initialized at tick 0');
    console.log('✅ Events and logs created');
    console.log('\n🌱 Your local garden is ready to grow!');
    console.log('\nNext steps:');
    console.log('1. Start the backend: cd workers && npm run dev');
    console.log('2. Start the frontend: cd frontend && npm run dev');
    console.log('3. Visit http://localhost:4321 to see your garden');
    console.log('4. Use POST /api/tick to simulate time passing');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, generateSeedEntities, generateSeedDataSQL };