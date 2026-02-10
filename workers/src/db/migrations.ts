/**
 * Database Migrations
 * 
 * Schema versioning and migration utilities for future evolution.
 * Like the gradual adaptation of organisms over generations,
 * our database schema may need to evolve as the system grows.
 * 
 * Current version: 1.4.0
 */

import type { D1Database } from '../types/worker';
import { queryFirst, executeRaw } from './connection';

/**
 * Current schema version.
 * Increment this when making schema changes.
 */
export const CURRENT_SCHEMA_VERSION = '1.4.0';

/**
 * Check if the database schema is up to date.
 * Like checking the health of the ecosystem's foundation.
 * 
 * @param db - The D1 database instance
 * @returns True if schema is current, false if migration needed
 */
export async function isSchemaUpToDate(db: D1Database): Promise<boolean> {
  try {
    const metadata = await queryFirst<{ value: string }>(
      db,
      "SELECT value FROM system_metadata WHERE key = 'schema_version'"
    );
    
    return metadata?.value === CURRENT_SCHEMA_VERSION;
  } catch {
    // If we can't check, assume we need to initialize
    return false;
  }
}

/**
 * Get the current schema version from the database.
 * 
 * @param db - The D1 database instance
 * @returns The current version string or null if not set
 */
export async function getCurrentSchemaVersion(db: D1Database): Promise<string | null> {
  try {
    const metadata = await queryFirst<{ value: string }>(
      db,
      "SELECT value FROM system_metadata WHERE key = 'schema_version'"
    );
    
    return metadata?.value || null;
  } catch {
    return null;
  }
}

/**
 * Run pending migrations to bring schema up to current version.
 * This function will grow as we add schema versions.
 * 
 * @param db - The D1 database instance
 * @returns True if migrations succeeded
 */
export async function runMigrations(db: D1Database): Promise<boolean> {
  const currentVersion = await getCurrentSchemaVersion(db);
  
  if (currentVersion === CURRENT_SCHEMA_VERSION) {
    // Already up to date
    return true;
  }
  
  // Start a migration log
  console.log(`Starting migration from ${currentVersion || 'none'} to ${CURRENT_SCHEMA_VERSION}`);
  
  try {
    if (!currentVersion) {
      await migrateToV1_0_0(db);
      await migrateToV1_1_0(db);
      await migrateToV1_3_0(db);
      await migrateToV1_4_0(db);
    } else if (currentVersion === '1.0.0') {
      await migrateToV1_1_0(db);
      await migrateToV1_3_0(db);
      await migrateToV1_4_0(db);
    } else if (currentVersion === '1.1.0') {
      await migrateToV1_3_0(db);
      await migrateToV1_4_0(db);
    } else if (currentVersion === '1.3.0') {
      await migrateToV1_4_0(db);
    } else if (currentVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported schema version "${currentVersion}"`);
    }
    
    console.log('Migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

/**
 * Migration to version 1.0.0 - Initial schema.
 * Creates all base tables and indexes.
 * 
 * @param db - The D1 database instance
 */
async function migrateToV1_0_0(db: D1Database): Promise<void> {
  console.log('Running migration to v1.0.0...');
  
  // The schema.sql file should already have been executed,
  // but we ensure the version is set correctly here
  const result = await executeRaw(
    db,
    `INSERT OR REPLACE INTO system_metadata (key, value, updated_at) 
     VALUES ('schema_version', '1.0.0', datetime('now'))`
  );
  
  if (!result.success) {
    throw new Error(`Failed to set schema version: ${result.error}`);
  }
  
  console.log('Migration to v1.0.0 complete');
}

/**
 * Migration to version 1.1.0.
 * Removes application log persistence schema artifacts.
 * 
 * @param db - The D1 database instance
 */
async function migrateToV1_1_0(db: D1Database): Promise<void> {
  console.log('Running migration to v1.1.0...');

  const dropStatements = [
    'DROP INDEX IF EXISTS idx_application_logs_timestamp',
    'DROP INDEX IF EXISTS idx_application_logs_level',
    'DROP INDEX IF EXISTS idx_application_logs_component',
    'DROP INDEX IF EXISTS idx_application_logs_tick',
    'DROP INDEX IF EXISTS idx_application_logs_entity',
    'DROP TABLE IF EXISTS application_logs'
  ];

  for (const statement of dropStatements) {
    const result = await executeRaw(db, statement);
    if (!result.success) {
      throw new Error(`Failed to execute migration step "${statement}": ${result.error}`);
    }
  }

  const versionResult = await executeRaw(
    db,
    `INSERT OR REPLACE INTO system_metadata (key, value, updated_at) 
     VALUES ('schema_version', '1.1.0', datetime('now'))`
  );

  if (!versionResult.success) {
    throw new Error(`Failed to set schema version: ${versionResult.error}`);
  }

  console.log('Migration to v1.1.0 complete');
}

/**
 * Migration to version 1.3.0.
 * Adds simulation execution control table used for lock-based tick orchestration.
 */
async function migrateToV1_3_0(db: D1Database): Promise<void> {
  console.log('Running migration to v1.3.0...');

  const createTableResult = await executeRaw(
    db,
    `CREATE TABLE IF NOT EXISTS simulation_control (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lock_owner TEXT,
      lock_acquired_at TEXT,
      lock_expires_at INTEGER,
      last_completed_tick INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );
  if (!createTableResult.success) {
    throw new Error(`Failed to create simulation_control: ${createTableResult.error}`);
  }

  const seedResult = await executeRaw(
    db,
    `INSERT OR REPLACE INTO simulation_control (id, last_completed_tick, updated_at)
     VALUES (1, 0, datetime('now'))`
  );
  if (!seedResult.success) {
    throw new Error(`Failed to seed simulation_control: ${seedResult.error}`);
  }

  const versionResult = await executeRaw(
    db,
    `INSERT OR REPLACE INTO system_metadata (key, value, updated_at) 
     VALUES ('schema_version', '1.3.0', datetime('now'))`
  );
  if (!versionResult.success) {
    throw new Error(`Failed to set schema version: ${versionResult.error}`);
  }

  console.log('Migration to v1.3.0 complete');
}

/**
 * Migration to version 1.4.0.
 * Adds persisted population summary columns for living/dead breakdowns.
 */
async function migrateToV1_4_0(db: D1Database): Promise<void> {
  console.log('Running migration to v1.4.0...');

  const addColumnStatements = [
    'ALTER TABLE garden_state ADD COLUMN dead_plants INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE garden_state ADD COLUMN dead_herbivores INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE garden_state ADD COLUMN dead_carnivores INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE garden_state ADD COLUMN dead_fungi INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE garden_state ADD COLUMN total_living INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE garden_state ADD COLUMN total_dead INTEGER NOT NULL DEFAULT 0'
  ];

  for (const statement of addColumnStatements) {
    const result = await executeRaw(db, statement);
    if (!result.success && !result.error?.includes('duplicate column name')) {
      throw new Error(`Failed to execute migration step "${statement}": ${result.error}`);
    }
  }

  const backfillResult = await executeRaw(
    db,
    `UPDATE garden_state
     SET dead_plants = COALESCE(dead_plants, 0),
         dead_herbivores = COALESCE(dead_herbivores, 0),
         dead_carnivores = COALESCE(dead_carnivores, 0),
         dead_fungi = COALESCE(dead_fungi, 0),
         total_living = CASE
           WHEN total_living = 0 THEN plants + herbivores + carnivores + fungi
           ELSE total_living
         END,
         total_dead = CASE
           WHEN total_dead = 0 THEN MAX(COALESCE(total, 0) - (plants + herbivores + carnivores + fungi), 0)
           ELSE total_dead
         END,
         total = CASE
           WHEN total < (plants + herbivores + carnivores + fungi) THEN plants + herbivores + carnivores + fungi
           ELSE total
         END`
  );
  if (!backfillResult.success) {
    throw new Error(`Failed to backfill population columns: ${backfillResult.error}`);
  }

  const versionResult = await executeRaw(
    db,
    `INSERT OR REPLACE INTO system_metadata (key, value, updated_at)
     VALUES ('schema_version', '1.4.0', datetime('now'))`
  );
  if (!versionResult.success) {
    throw new Error(`Failed to set schema version: ${versionResult.error}`);
  }

  console.log('Migration to v1.4.0 complete');
}

/**
 * Initialize the database on first run.
 * Creates schema and seeds initial data.
 * 
 * @param db - The D1 database instance
 * @returns True if initialization succeeded
 */
export async function initializeDatabase(db: D1Database): Promise<boolean> {
  try {
    // Check if already initialized
    const isInitialized = await queryFirst<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM system_metadata'
    );
    
    if (isInitialized && isInitialized.count > 0) {
      console.log('Database already initialized');
      return true;
    }
    
    console.log('Initializing database...');
    
    // Schema should be applied via wrangler d1 execute
    // This function handles post-schema setup
    
    await migrateToV1_1_0(db);
    await migrateToV1_3_0(db);
    await migrateToV1_4_0(db);
    
    console.log('Database initialization complete');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
}
