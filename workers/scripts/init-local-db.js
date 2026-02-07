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
const { v4: uuidv4 } = require('uuid');

// Naming Utility for initialization
function generateRandomName(type) {
  const prefixes = {
    plant: ['Leaf', 'Flora', 'Green', 'Root', 'Stem', 'Bloom', 'Thorn', 'Sprout', 'Vine', 'Moss'],
    herbivore: ['Swift', 'Soft', 'Light', 'Sky', 'Cloud', 'Meadow', 'Graz', 'Hoof', 'Ear', 'Tail'],
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

// Generate seed entities
function generateSeedEntities(gardenStateId) {
  const entities = [];
  const now = new Date().toISOString();
  
  // Generate 10 plants
  for (let i = 0; i < 10; i++) {
    entities.push({
      id: uuidv4(),
      garden_state_id: gardenStateId,
      born_at_tick: 0,
      is_alive: 1,
      type: 'plant',
      name: generateRandomName('plant'),
      species: `Green Sprout ${i + 1}`,
      position_x: Math.random() * 800,
      position_y: Math.random() * 600,
      energy: 80 + Math.random() * 20,
      health: 90 + Math.random() * 10,
      age: 0,
      traits: {
        reproductionRate: 0.05 + (Math.random() * 0.03),
        metabolismEfficiency: 1.0,
        photosynthesisRate: 0.8 + (Math.random() * 0.4)
      },
      lineage: 'origin',
      created_at: now,
      updated_at: now
    });
  }
  
  // Generate 5 herbivores
  for (let i = 0; i < 5; i++) {
    entities.push({
      id: uuidv4(),
      garden_state_id: gardenStateId,
      born_at_tick: 0,
      is_alive: 1,
      type: 'herbivore',
      name: generateRandomName('herbivore'),
      species: `Forest Grazer ${i + 1}`,
      position_x: Math.random() * 800,
      position_y: Math.random() * 600,
      energy: 70 + Math.random() * 20,
      health: 85 + Math.random() * 10,
      age: 0,
      traits: {
        reproductionRate: 0.03 + (Math.random() * 0.02),
        movementSpeed: 2 + Math.random() * 3,
        metabolismEfficiency: 0.9 + (Math.random() * 0.2),
        perceptionRadius: 40 + (Math.random() * 40)
      },
      lineage: 'origin',
      created_at: now,
      updated_at: now
    });
  }

  // Generate 3 fungi
  for (let i = 0; i < 3; i++) {
    entities.push({
      id: uuidv4(),
      garden_state_id: gardenStateId,
      born_at_tick: 0,
      is_alive: 1,
      type: 'fungus',
      name: generateRandomName('fungus'),
      species: `Silent Recycler ${i + 1}`,
      position_x: Math.random() * 800,
      position_y: Math.random() * 600,
      energy: 40 + Math.random() * 20,
      health: 100,
      age: 0,
      traits: {
        reproductionRate: 0.04 + (Math.random() * 0.02),
        metabolismEfficiency: 1.2,
        decompositionRate: 1.0 + (Math.random() * 0.4),
        perceptionRadius: 50 + (Math.random() * 20)
      },
      lineage: 'origin',
      created_at: now,
      updated_at: now
    });
  }

  // Generate 2 carnivores
  for (let i = 0; i < 2; i++) {
    entities.push({
      id: uuidv4(),
      garden_state_id: gardenStateId,
      born_at_tick: 0,
      is_alive: 1,
      type: 'carnivore',
      name: generateRandomName('carnivore'),
      species: `Apex Stalker ${i + 1}`,
      position_x: Math.random() * 800,
      position_y: Math.random() * 600,
      energy: 60 + Math.random() * 20,
      health: 100,
      age: 0,
      traits: {
        reproductionRate: 0.02 + (Math.random() * 0.01),
        movementSpeed: 3 + Math.random() * 2,
        metabolismEfficiency: 1.1 + (Math.random() * 0.1),
        perceptionRadius: 100 + (Math.random() * 50)
      },
      lineage: 'origin',
      created_at: now,
      updated_at: now
    });
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
  const updateGardenStateSQL = `
    UPDATE garden_state
    SET 
      plants = 10,
      herbivores = 5,
      carnivores = 2,
      fungi = 3,
      total = 20,
      timestamp = '${now}'
    WHERE id = ${gardenStateId};
  `;
  
  // Create simulation events
  const createEventsSQL = `
    INSERT INTO simulation_events (
      garden_state_id, tick, timestamp, event_type, description,
      entities_affected, severity, metadata
    ) VALUES
      (${gardenStateId}, 0, '${now}', 'BIRTH', 'The Chaos Garden was created', '[]', 'LOW', '{"source": "initialization"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '10 plants sprouted from the fertile soil', '[]', 'LOW', '{"count": 10, "type": "plants"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '5 herbivores wandered into the garden', '[]', 'LOW', '{"count": 5, "type": "herbivores"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '3 fungi established their networks', '[]', 'LOW', '{"count": 3, "type": "fungi"}'),
      (${gardenStateId}, 0, '${now}', 'BIRTH', '2 carnivores claimed their territory', '[]', 'LOW', '{"count": 2, "type": "carnivores"}');
  `;
  
  // Create application logs
  const createLogsSQL = `
    INSERT INTO application_logs (
      timestamp, level, component, operation, message,
      metadata, tick
    ) VALUES
      ('${now}', 'INFO', 'INITIALIZATION', 'database_setup', 'Local database initialized with schema', '{"schema_version": "1.0.0"}', 0),
      ('${now}', 'INFO', 'INITIALIZATION', 'seed_data', 'Seed data created: 10 plants, 5 herbivores, 2 carnivores, 3 fungi', '{"plants": 10, "herbivores": 5, "carnivores": 2, "fungi": 3}', 0);
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
    // We must specify the config file if it's not wrangler.toml
    const configFlag = require('fs').existsSync(path.resolve(WORKERS_DIR, 'wrangler.local.toml')) 
      ? '--config wrangler.local.toml' 
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
    const localConfigPath = path.resolve(WORKERS_DIR, 'wrangler.local.toml');
    const configFlag = require('fs').existsSync(localConfigPath) 
      ? '--config wrangler.local.toml' 
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
    console.log('✅ Seed data created: 10 plants, 5 herbivores, 2 carnivores');
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
  // Check for uuid dependency
  try {
    require('uuid');
  } catch {
    console.error('Missing dependency: uuid');
    console.log('Installing required dependencies...');
    execSync('npm install uuid', { cwd: WORKERS_DIR, stdio: 'inherit' });
  }
  
  initializeDatabase();
}

module.exports = { initializeDatabase, generateSeedEntities, generateSeedDataSQL };