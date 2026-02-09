import type { D1Database } from '../types/worker';
import { executeQuery, queryFirst } from './connection';

interface LastCompletedTickRow {
  last_completed_tick: number;
}

export async function tryAcquireSimulationLock(
  db: D1Database,
  ownerId: string,
  nowMs: number,
  ttlMs: number
): Promise<boolean> {
  const expiresAt = nowMs + ttlMs;
  const result = await executeQuery(
    db,
    `UPDATE simulation_control
     SET lock_owner = ?, lock_acquired_at = ?, lock_expires_at = ?, updated_at = datetime('now')
     WHERE id = 1
       AND (
         lock_owner IS NULL
         OR lock_expires_at IS NULL
         OR lock_expires_at < ?
       )`,
    [ownerId, new Date(nowMs).toISOString(), expiresAt, nowMs]
  );

  return (result.meta?.changes ?? 0) === 1;
}

export async function releaseSimulationLock(
  db: D1Database,
  ownerId: string
): Promise<void> {
  await executeQuery(
    db,
    `UPDATE simulation_control
     SET lock_owner = NULL, lock_acquired_at = NULL, lock_expires_at = NULL, updated_at = datetime('now')
     WHERE id = 1 AND lock_owner = ?`,
    [ownerId]
  );
}

export async function getLastCompletedTick(db: D1Database): Promise<number> {
  const row = await queryFirst<LastCompletedTickRow>(
    db,
    'SELECT last_completed_tick FROM simulation_control WHERE id = 1'
  );
  return row?.last_completed_tick ?? 0;
}

export async function setLastCompletedTick(
  db: D1Database,
  tick: number
): Promise<void> {
  await executeQuery(
    db,
    `UPDATE simulation_control
     SET last_completed_tick = ?, updated_at = datetime('now')
     WHERE id = 1`,
    [tick]
  );
}
