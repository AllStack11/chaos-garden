import type { D1Database } from '../types/worker';
import { executeRaw } from './connection';

export const CURRENT_SCHEMA_VERSION = '3.0.0';

/**
 * One-way Phase 4 cutover. Legacy persistence was intentionally retired; a
 * canonical checkpoint is now the only durable simulation source of truth.
 */
export async function migrateToCanonicalSchema(db: D1Database): Promise<void> {
  const result = await executeRaw(db, `
    CREATE TABLE IF NOT EXISTS canonical_world_states (
      checkpoint_id INTEGER PRIMARY KEY,
      canonical_tick INTEGER NOT NULL UNIQUE,
      state_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      FOREIGN KEY (checkpoint_id) REFERENCES engine_checkpoints(id) ON DELETE CASCADE
    );
    DROP TABLE IF EXISTS simulation_events;
    DROP TABLE IF EXISTS entities;
    DROP TABLE IF EXISTS dead_matter;
    DROP TABLE IF EXISTS garden_state;
    DROP TABLE IF EXISTS simulation_control;
    DROP TABLE IF EXISTS api_metric_buckets;
    INSERT OR REPLACE INTO system_metadata (key, value, updated_at)
    VALUES ('schema_version', '3.0.0', datetime('now'));
  `);
  if (!result.success) throw new Error(result.error ?? 'Canonical migration failed');
}
