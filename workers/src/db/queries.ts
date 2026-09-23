import type {
  CanonicalAnchorRecord,
  CanonicalCheckpointSubmission,
  CanonicalWorldState,
  CheckpointCommitResult,
  ChronicleEvent,
  CuratorLease,
  EncodedEngineCheckpoint,
} from "@chaos-garden/shared";
import { base64ToUint8Array, computeChronicleEventChecksum, uint8ArrayToBase64, validateChronicleEvent } from "@chaos-garden/shared";
import type { D1Database } from "../types/worker";
import { executeBatch, executeQuery, queryAll, queryFirst } from "./connection";

/** 500 per-minute snapshots retain roughly 8 hours and 20 minutes of canonical history. */
export const MAX_RETAINED_CANONICAL_SNAPSHOTS = 500;

interface CheckpointRow {
  id: number;
  tick: number;
  engine_version: number;
  seed: number;
  checksum: string;
  payload: ArrayBuffer | Uint8Array | string;
}

function decodeBlob(payload: CheckpointRow["payload"]): Uint8Array {
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  return base64ToUint8Array(payload);
}

function mapCheckpoint(row: CheckpointRow): EncodedEngineCheckpoint {
  const payload = decodeBlob(row.payload);
  return {
    version: row.engine_version,
    tick: row.tick,
    seed: row.seed,
    byteLength: payload.byteLength,
    checksum: row.checksum,
    payload: uint8ArrayToBase64(payload),
  };
}

export async function getEngineCheckpointById(db: D1Database, id: number): Promise<EncodedEngineCheckpoint | null> {
  const row = await queryFirst<CheckpointRow>(db, `SELECT id, tick, engine_version, seed, checksum, payload FROM engine_checkpoints WHERE id = ?`, [id]);
  return row ? mapCheckpoint(row) : null;
}

export async function getLatestEngineCheckpoint(db: D1Database): Promise<EncodedEngineCheckpoint | null> {
  const row = await queryFirst<CheckpointRow>(db, `SELECT id, tick, engine_version, seed, checksum, payload FROM engine_checkpoints ORDER BY tick DESC LIMIT 1`);
  return row ? mapCheckpoint(row) : null;
}

export async function getCanonicalAnchor(db: D1Database): Promise<CanonicalAnchorRecord | null> {
  const row = await queryFirst<{ id: number; checkpoint_id: number | null; canonical_tick: number; checksum: string | null; updated_at_ms: number }>(db, `SELECT id, checkpoint_id, canonical_tick, checksum, updated_at_ms FROM canonical_anchor WHERE id = 1`);
  return row ? { id: row.id, checkpointId: row.checkpoint_id, canonicalTick: row.canonical_tick, checksum: row.checksum, updatedAtMs: row.updated_at_ms } : null;
}

export async function getCanonicalWorldState(db: D1Database, checkpointId: number): Promise<CanonicalWorldState | null> {
  const row = await queryFirst<{ state_json: string }>(db, `SELECT state_json FROM canonical_world_states WHERE checkpoint_id = ?`, [checkpointId]);
  if (!row) return null;
  try {
    return JSON.parse(row.state_json) as CanonicalWorldState;
  } catch {
    return null;
  }
}

export async function getChronicleEvents(db: D1Database, limit = 50): Promise<ChronicleEvent[]> {
  const rows = await queryAll<{ id: string; canonical_tick: number; occurred_at: string; type: string; severity: ChronicleEvent["severity"]; description: string; tags_json: string }>(db, `SELECT id, canonical_tick, occurred_at, type, severity, description, tags_json FROM chronicle_events ORDER BY canonical_tick DESC, created_at_ms DESC LIMIT ?`, [limit]);
  return rows.map((row) => ({
    id: row.id, tick: row.canonical_tick, timestamp: row.occurred_at, type: row.type,
    severity: row.severity, description: row.description,
    tags: JSON.parse(row.tags_json) as string[],
  }));
}

export async function acquireOrRenewCuratorLease(db: D1Database, curatorId: string, authorizedTick: number, requestedLeaseId: string, ttlMs = 120000): Promise<{ lease: CuratorLease } | { error: string }> {
  const now = Date.now();
  const expiresAtMs = now + ttlMs;
  const result = await executeQuery(db, `UPDATE curator_leases SET lease_id = ?, curator_id = ?, granted_at_ms = ?, expires_at_ms = ?, authorized_tick = ?, updated_at = datetime('now') WHERE id = 1 AND (expires_at_ms <= ? OR curator_id = ? OR lease_id = ?)`, [requestedLeaseId, curatorId, now, expiresAtMs, authorizedTick, now, curatorId, requestedLeaseId]);
  if ((result.meta?.changes ?? 0) !== 1) return { error: "Worker curator lease is held by an unexpected owner" };
  return { lease: { leaseId: requestedLeaseId, curatorId, grantedAtMs: now, expiresAtMs, authorizedTick } };
}

export async function hasActiveCuratorLease(db: D1Database): Promise<boolean> {
  const row = await queryFirst<{ count: number }>(db, `SELECT COUNT(*) AS count FROM curator_leases WHERE id = 1 AND expires_at_ms > ?`, [Date.now()]);
  return (row?.count ?? 0) === 1;
}

export interface CommitCanonicalResult {
  success: boolean;
  result?: CheckpointCommitResult;
  conflict?: boolean;
  error?: string;
}

/** Atomically persists a server-created checkpoint, its world state, and anchor. */
export async function commitCanonicalCheckpoint(db: D1Database, submission: CanonicalCheckpointSubmission, curatorId: string): Promise<CommitCanonicalResult> {
  if (!submission.canonicalState || submission.canonicalState.tick !== submission.checkpoint.tick) {
    return { success: false, error: "Canonical state must accompany its matching checkpoint" };
  }
  const anchor = await getCanonicalAnchor(db);
  if (!anchor || anchor.canonicalTick !== submission.baseCanonicalTick) return { success: false, conflict: true, error: "Canonical anchor changed before commit" };
  const bytes = base64ToUint8Array(submission.checkpoint.payload);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const now = Date.now();
  const statements: Array<{ query: string; params: unknown[] }> = [
    {
      query: `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
              SELECT ?, ?, ?, ?, ? WHERE EXISTS (
                SELECT 1 FROM curator_leases WHERE id = 1 AND lease_id = ? AND curator_id = ? AND expires_at_ms > ? AND authorized_tick < ?
              ) AND EXISTS (
                SELECT 1 FROM canonical_anchor WHERE id = 1 AND canonical_tick = ? AND checkpoint_id IS ?
              )`,
      params: [submission.checkpoint.tick, submission.checkpoint.version, submission.checkpoint.seed, submission.checkpoint.checksum, buffer, submission.leaseId, curatorId, now, submission.checkpoint.tick, anchor.canonicalTick, anchor.checkpointId],
    },
    {
      query: `UPDATE canonical_anchor SET checkpoint_id = (SELECT id FROM engine_checkpoints WHERE tick = ?), canonical_tick = ?, checksum = ?, updated_at_ms = ? WHERE id = 1 AND canonical_tick = ? AND checkpoint_id IS ?`,
      params: [submission.checkpoint.tick, submission.checkpoint.tick, submission.checkpoint.checksum, now, anchor.canonicalTick, anchor.checkpointId],
    },
    {
      query: `INSERT INTO canonical_world_states (checkpoint_id, canonical_tick, state_json, created_at_ms) SELECT id, ?, ?, ? FROM engine_checkpoints WHERE tick = ?`,
      params: [submission.checkpoint.tick, JSON.stringify(submission.canonicalState), now, submission.checkpoint.tick],
    },
  ];
  for (const event of submission.chronicleEvents ?? []) {
    const validation = validateChronicleEvent(event);
    if (!validation.valid) return { success: false, error: validation.error };
    const occurredAt = event.timestamp || new Date(now).toISOString();
    const tags = event.tags ?? [];
    const checksum = await computeChronicleEventChecksum({ canonicalTick: event.tick ?? submission.checkpoint.tick, occurredAt, type: event.type, severity: event.severity, description: event.description, tags });
    statements.push({ query: `INSERT OR IGNORE INTO chronicle_events (id, canonical_tick, occurred_at, type, severity, description, tags_json, checksum, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, params: [event.id || checksum, event.tick ?? submission.checkpoint.tick, occurredAt, event.type, event.severity, event.description, JSON.stringify(tags), checksum, now] });
  }
  statements.push({ query: `UPDATE curator_leases SET authorized_tick = ?, updated_at = datetime('now') WHERE id = 1 AND lease_id = ? AND curator_id = ? AND authorized_tick < ?`, params: [submission.checkpoint.tick, submission.leaseId, curatorId, submission.checkpoint.tick] });
  // The batch keeps retention atomic with a successful CAS commit. Deleting a
  // checkpoint cascades to its world-state row, so the two sets cannot drift.
  statements.push({ query: `DELETE FROM engine_checkpoints WHERE id != (SELECT checkpoint_id FROM canonical_anchor WHERE id = 1) AND id IN (SELECT id FROM engine_checkpoints ORDER BY tick DESC LIMIT -1 OFFSET ?)`, params: [MAX_RETAINED_CANONICAL_SNAPSHOTS] });
  const results = await executeBatch<{ meta?: { changes?: number } }>(db, statements);
  if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[1]?.meta?.changes ?? 0) !== 1) return { success: false, conflict: true, error: "Canonical checkpoint CAS failed" };
  return { success: true, result: { committed: true, tick: submission.checkpoint.tick, canonicalTick: submission.checkpoint.tick, checksum: submission.checkpoint.checksum, committedAt: new Date(now).toISOString(), chronicleEventIds: [] } };
}
