-- ============================================================================
-- Chaos Garden Database Schema
-- 
-- This schema defines the memory of our ecosystem—the persistent storage
-- for garden states, entities, and simulation events.
-- 
-- Tables:
--   - garden_state: Snapshots of the world at each tick
--   - entities: All living organisms (plants, herbivores, etc.)
--   - simulation_events: Narrative events telling the story of life
-- ============================================================================

-- ==========================================
-- Garden State Table
-- ==========================================
-- Stores snapshots of the world at each simulation tick.
-- Like pages in the book of history, each row preserves a moment in time.

CREATE TABLE IF NOT EXISTS garden_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tick INTEGER NOT NULL UNIQUE,              -- Simulation tick number (time index)
  timestamp TEXT NOT NULL,                   -- ISO 8601 timestamp
  temperature REAL NOT NULL DEFAULT 20.0,    -- 0-40°C
  sunlight REAL NOT NULL DEFAULT 0.5,        -- 0-1 intensity
  moisture REAL NOT NULL DEFAULT 0.5,        -- 0-1 humidity
  plants INTEGER NOT NULL DEFAULT 0,         -- Plant population count
  herbivores INTEGER NOT NULL DEFAULT 0,     -- Herbivore population count
  carnivores INTEGER NOT NULL DEFAULT 0,     -- Carnivore population count
  fungi INTEGER NOT NULL DEFAULT 0,          -- Fungi population count
  dead_plants INTEGER NOT NULL DEFAULT 0,    -- Dead plant count
  dead_herbivores INTEGER NOT NULL DEFAULT 0,-- Dead herbivore count
  dead_carnivores INTEGER NOT NULL DEFAULT 0,-- Dead carnivore count
  dead_fungi INTEGER NOT NULL DEFAULT 0,     -- Dead fungus count
  all_time_dead_plants INTEGER NOT NULL DEFAULT 0,    -- Cumulative dead plants
  all_time_dead_herbivores INTEGER NOT NULL DEFAULT 0,-- Cumulative dead herbivores
  all_time_dead_carnivores INTEGER NOT NULL DEFAULT 0,-- Cumulative dead carnivores
  all_time_dead_fungi INTEGER NOT NULL DEFAULT 0,     -- Cumulative dead fungi
  total_living INTEGER NOT NULL DEFAULT 0,   -- Total living entities
  total_dead INTEGER NOT NULL DEFAULT 0,     -- Total dead entities
  all_time_dead INTEGER NOT NULL DEFAULT 0,  -- Cumulative dead entities
  total INTEGER NOT NULL DEFAULT 0,          -- Total entity count
  weather_state TEXT DEFAULT NULL,           -- Serialized weather pattern state
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient retrieval of latest state
CREATE INDEX IF NOT EXISTS idx_garden_state_tick ON garden_state(tick DESC);
CREATE INDEX IF NOT EXISTS idx_garden_state_timestamp ON garden_state(timestamp DESC);

-- ==========================================
-- Entities Table
-- ==========================================
-- Stores all living organisms in the garden.
-- Each entity carries its genetic code, position, and vital statistics.

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,                       -- UUID v4
  garden_state_id INTEGER,                   -- Optional FK to garden_state (born at)
  born_at_tick INTEGER NOT NULL DEFAULT 0,   -- The tick this entity was born
  death_tick INTEGER,                        -- The tick this entity died
  is_alive INTEGER NOT NULL DEFAULT 1,       -- Boolean (0 or 1)
  type TEXT NOT NULL CHECK (type IN ('plant', 'herbivore', 'carnivore', 'fungus')),
  name TEXT NOT NULL DEFAULT 'unnamed',      -- Individual name
  species TEXT NOT NULL DEFAULT 'unknown',   -- Display name, can evolve
  position_x REAL NOT NULL,                  -- X coordinate (0-800)
  position_y REAL NOT NULL,                  -- Y coordinate (0-600)
  energy REAL NOT NULL DEFAULT 50.0,         -- 0-100, dies at 0
  health REAL NOT NULL DEFAULT 100.0,        -- 0-100, dies at 0
  age INTEGER NOT NULL DEFAULT 0,            -- Ticks survived
  
  -- Genetic traits (stored as JSON to support polymorphic entity types)
  traits TEXT NOT NULL DEFAULT '{}',
  
  lineage TEXT NOT NULL DEFAULT 'origin',    -- Parent ID or 'origin'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- Foreign key constraint
  FOREIGN KEY (garden_state_id) REFERENCES garden_state(id) ON DELETE CASCADE
);

-- Indexes for efficient entity queries
CREATE INDEX IF NOT EXISTS idx_entities_garden_state ON entities(garden_state_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_position ON entities(position_x, position_y);

-- ==========================================
-- Simulation Events Table
-- ==========================================
-- Narrative events that tell the story of the ecosystem.
-- Births, deaths, reproductions, mutations, disasters—all recorded here.

CREATE TABLE IF NOT EXISTS simulation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  garden_state_id INTEGER NOT NULL,          -- FK to garden_state
  tick INTEGER NOT NULL,                     -- When this event occurred
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'BIRTH', 'DEATH', 'REPRODUCTION', 'MUTATION',
      'EXTINCTION', 'POPULATION_EXPLOSION', 'ECOSYSTEM_COLLAPSE',
      'DISASTER_FIRE', 'DISASTER_FLOOD', 'DISASTER_PLAGUE',
      'USER_INTERVENTION', 'ENVIRONMENT_CHANGE', 'POPULATION_DELTA',
      'AMBIENT'
    )
  ),
  description TEXT NOT NULL,                 -- Human-readable story
  entities_affected TEXT NOT NULL DEFAULT '[]', -- JSON array of entity UUIDs
  tags TEXT NOT NULL DEFAULT '[]',           -- JSON array of search/filter tags
  severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  metadata TEXT,                             -- JSON for additional context
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- Foreign key constraint
  FOREIGN KEY (garden_state_id) REFERENCES garden_state(id) ON DELETE CASCADE
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_simulation_events_garden_state ON simulation_events(garden_state_id);
CREATE INDEX IF NOT EXISTS idx_simulation_events_tick ON simulation_events(tick DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_events_type ON simulation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_simulation_events_severity ON simulation_events(severity);
CREATE INDEX IF NOT EXISTS idx_simulation_events_timestamp ON simulation_events(timestamp DESC);

-- ==========================================
-- Simulation Control Table
-- ==========================================
-- Coordinates tick execution to prevent concurrent runs and partial state.

CREATE TABLE IF NOT EXISTS simulation_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lock_owner TEXT,
  lock_acquired_at TEXT,
  lock_expires_at INTEGER,
  last_completed_tick INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO simulation_control (id, last_completed_tick, updated_at)
VALUES (1, 0, datetime('now'));

-- ==========================================
-- Metadata Table (for future migrations)
-- ==========================================
-- Tracks schema version and other system metadata.

CREATE TABLE IF NOT EXISTS system_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial schema version
INSERT OR REPLACE INTO system_metadata (key, value, updated_at) 
VALUES ('schema_version', '1.6.0', datetime('now'));

-- ==========================================
-- Initial Data Seeding
-- ==========================================
-- Create the first garden state (tick 0) to bootstrap the simulation.

INSERT INTO garden_state (
  tick, 
  timestamp, 
  temperature, 
  sunlight, 
  moisture, 
  plants, 
  herbivores, 
  carnivores, 
  fungi, 
  dead_plants,
  dead_herbivores,
  dead_carnivores,
  dead_fungi,
  all_time_dead_plants,
  all_time_dead_herbivores,
  all_time_dead_carnivores,
  all_time_dead_fungi,
  total_living,
  total_dead,
  all_time_dead,
  total
) VALUES (
  0,
  datetime('now'),
  20.0,
  0.0,
  0.5,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
);
