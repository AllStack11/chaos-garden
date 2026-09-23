import type { D1Database } from '../types/worker';
import { executeRaw } from './connection';

export const CURRENT_SCHEMA_VERSION = '3.0.0';

/**
 * One-way Phase 4 cutover. Legacy persistence was intentionally retired; a
 * canonical checkpoint is now the only durable simulation source of truth.
 *
 * This SQL must remain in exact parity with `workers/canonical-cutover.sql`.
 */
export const CANONICAL_CUTOVER_SQL = `
CREATE TABLE IF NOT EXISTS system_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engine_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tick INTEGER NOT NULL UNIQUE,
  engine_version INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  payload BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_engine_checkpoints_tick ON engine_checkpoints(tick DESC);

CREATE TABLE IF NOT EXISTS canonical_anchor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checkpoint_id INTEGER,
  canonical_tick INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  updated_at_ms INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (checkpoint_id) REFERENCES engine_checkpoints(id)
);
INSERT OR IGNORE INTO canonical_anchor (id, checkpoint_id, canonical_tick, checksum, updated_at_ms)
VALUES (1, NULL, 0, NULL, 0);

CREATE TABLE IF NOT EXISTS canonical_world_states (
  checkpoint_id INTEGER PRIMARY KEY,
  canonical_tick INTEGER NOT NULL UNIQUE,
  state_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES engine_checkpoints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curator_leases (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lease_id TEXT NOT NULL,
  curator_id TEXT NOT NULL,
  granted_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  authorized_tick INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO curator_leases (id, lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick)
VALUES (1, 'initial', 'none', 0, 0, 0);

CREATE TABLE IF NOT EXISTS chronicle_events (
  id TEXT PRIMARY KEY,
  canonical_tick INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  description TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  checksum TEXT NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_tick ON chronicle_events(canonical_tick DESC);

CREATE TABLE IF NOT EXISTS canonical_commit_guards (
  id INTEGER PRIMARY KEY CHECK (id = 1)
);

UPDATE canonical_anchor
SET checkpoint_id = NULL,
    canonical_tick = 0,
    checksum = NULL,
    updated_at_ms = 0
WHERE id = 1 AND NOT EXISTS (
  SELECT 1 FROM system_metadata WHERE key = 'schema_version' AND value = '3.0.0'
);

UPDATE curator_leases
SET lease_id = 'initial',
    curator_id = 'none',
    granted_at_ms = 0,
    expires_at_ms = 0,
    authorized_tick = 0,
    updated_at = datetime('now')
WHERE id = 1 AND NOT EXISTS (
  SELECT 1 FROM system_metadata WHERE key = 'schema_version' AND value = '3.0.0'
);

DELETE FROM canonical_world_states
WHERE NOT EXISTS (
  SELECT 1 FROM system_metadata WHERE key = 'schema_version' AND value = '3.0.0'
);

DELETE FROM chronicle_events
WHERE NOT EXISTS (
  SELECT 1 FROM system_metadata WHERE key = 'schema_version' AND value = '3.0.0'
);

DELETE FROM engine_checkpoints
WHERE NOT EXISTS (
  SELECT 1 FROM system_metadata WHERE key = 'schema_version' AND value = '3.0.0'
);

DROP TABLE IF EXISTS simulation_events;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS dead_matter;
DROP TABLE IF EXISTS garden_state;
DROP TABLE IF EXISTS simulation_control;
DROP TABLE IF EXISTS api_metric_buckets;

INSERT OR REPLACE INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '3.0.0', datetime('now'));
`;

export async function migrateToCanonicalSchema(db: D1Database): Promise<void> {
  const result = await executeRaw(db, CANONICAL_CUTOVER_SQL);
  if (!result.success) throw new Error(result.error ?? 'Canonical migration failed');
}
