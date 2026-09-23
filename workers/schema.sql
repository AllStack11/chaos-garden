-- Phase 4 canonical persistence.

CREATE TABLE IF NOT EXISTS engine_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tick INTEGER NOT NULL UNIQUE,
  engine_version INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  payload BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

-- The complete bootstrap summary travels with the checkpoint commit. A client
-- can therefore hydrate without reconstructing state from retired tables.
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

-- A failed assertion raises inside the D1 batch, rolling its earlier writes
-- back. This prevents an anchor-CAS conflict leaving an orphan checkpoint.
CREATE TABLE IF NOT EXISTS canonical_commit_guards (
  id INTEGER PRIMARY KEY CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS system_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR REPLACE INTO system_metadata (key, value, updated_at)
VALUES ('schema_version', '3.0.0', datetime('now'));
