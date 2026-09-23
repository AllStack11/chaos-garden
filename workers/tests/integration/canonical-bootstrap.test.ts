import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Miniflare } from 'miniflare';
import worker, { resetDatabaseReadyForTesting } from '../../src/index';
import { acquireOrRenewCuratorLease, commitCanonicalCheckpoint, getCanonicalAnchor, getCanonicalWorldState } from '../../src/db/queries';
import { migrateToCanonicalSchema } from '../../src/db/migrations';
import type { D1Database } from '../../src/types/worker';

describe('canonical bootstrap', () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeEach(async () => {
    resetDatabaseReadyForTesting();
    mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response(null); } }', d1Databases: ['DB'] });
    db = (await mf.getD1Database('DB')) as unknown as D1Database;
    const sql = fs.readFileSync(path.resolve(__dirname, '../../schema.sql'), 'utf8').replace(/--.*$/gm, '');
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
  });

  afterEach(async () => mf.dispose());

  it('commits an anchored snapshot and exposes only its exact continuation', async () => {
    const lease = await acquireOrRenewCuratorLease(db, 'worker-curator', 0, 'lease');
    if ('error' in lease) throw new Error(lease.error);
    const result = await commitCanonicalCheckpoint(db, {
      leaseId: 'lease', baseCanonicalTick: 0,
      checkpoint: { version: 1, tick: 100, seed: 42, byteLength: 1, checksum: 'checkpoint-100', payload: 'AQ==' },
      canonicalState: { id: 1, tick: 100, epoch: 1, timestamp: '2026-01-01T00:00:00.000Z', seed: 42, checksum: 'checkpoint-100', atmospheric: {}, populationSummary: {}, entities: [], deadMatter: [], soil: {} } as never,
      chronicleEvents: [],
    }, 'worker-curator');
    expect(result.success).toBe(true);
    expect((await getCanonicalAnchor(db))?.canonicalTick).toBe(100);
    expect((await getCanonicalWorldState(db, 1))?.checkpoint).toBeUndefined();

    const response = await worker.fetch(new Request('https://garden.test/api/garden'), { DB: db });
    const body = await response.json() as { data: { exactContinuation: boolean; checkpoint?: { tick: number } } };
    expect(body.data.exactContinuation).toBe(true);
    expect(body.data.checkpoint?.tick).toBe(100);
  });

  it('recovers from a transient database-readiness failure', async () => {
    const unavailableDb: D1Database = {
      prepare: () => { throw new Error('transient D1 failure'); },
      batch: async () => [],
      exec: async () => undefined,
    };
    expect((await worker.fetch(new Request('https://garden.test/api/health'), { DB: unavailableDb })).status).toBe(503);
    expect((await worker.fetch(new Request('https://garden.test/api/health'), { DB: db })).status).toBe(200);
  });

  it('serves public routes, CORS preflight, and an empty canonical garden safely', async () => {
    const env = { DB: db, CORS_ORIGIN: 'https://observer.example' };
    const options = await worker.fetch(new Request('https://garden.test/api/garden', { method: 'OPTIONS', headers: { Origin: 'https://observer.example' } }), env);
    expect(options.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect((await worker.fetch(new Request('https://garden.test/'), env)).status).toBe(200);
    expect((await worker.fetch(new Request('https://garden.test/api/garden'), env)).status).toBe(404);
    expect((await worker.fetch(new Request('https://garden.test/missing'), env)).status).toBe(404);
  });

  it('advances the initial canonical world from the scheduled Worker path', async () => {
    await worker.scheduled({ cron: '*/15 * * * *' }, { DB: db });
    const response = await worker.fetch(new Request('https://garden.test/api/garden'), { DB: db });
    expect(response.status).toBe(200);
    expect((await response.json() as { data: { exactContinuation: boolean } }).data.exactContinuation).toBe(true);
  });

  it('performs an idempotent canonical cutover and removes retired persistence', async () => {
    const legacyTables = ['garden_state', 'entities', 'dead_matter', 'simulation_events', 'simulation_control', 'api_metric_buckets'];
    for (const table of legacyTables) await db.prepare(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`).run();
    await migrateToCanonicalSchema(db);
    await migrateToCanonicalSchema(db);
    expect((await db.prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'").first<{ value: string }>())?.value).toBe('3.0.0');
    expect((await db.prepare('SELECT id FROM canonical_anchor WHERE id = 1').first<{ id: number }>())?.id).toBe(1);
    for (const table of legacyTables) {
      expect(await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first<{ name: string }>()).toBeNull();
    }
  });

  it('cleanses legacy checkpoints at tick 900 during cutover and commits a current-rate canonical snapshot', async () => {
    await db.prepare("CREATE TABLE IF NOT EXISTS system_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))") .run();
    await db.prepare("INSERT OR REPLACE INTO system_metadata (key, value) VALUES ('schema_version', '1.9.0')").run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS engine_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tick INTEGER NOT NULL UNIQUE,
      engine_version INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      payload BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();

    await db.prepare(`INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
      VALUES (900, 1, 42, 'legacy-checkpoint-900', X'01020304')`).run();

    await db.prepare(`CREATE TABLE IF NOT EXISTS curator_leases (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lease_id TEXT NOT NULL,
      curator_id TEXT NOT NULL,
      granted_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      authorized_tick INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run();
    await db.prepare(`INSERT OR REPLACE INTO curator_leases (id, lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick)
      VALUES (1, 'legacy-lease', 'browser-curator', 1000, 999999999999, 900)`).run();

    const legacyRow = await db.prepare('SELECT tick FROM engine_checkpoints WHERE tick = 900').first<{ tick: number }>();
    expect(legacyRow?.tick).toBe(900);

    await migrateToCanonicalSchema(db);

    const remainingCheckpoints = await db.prepare('SELECT COUNT(*) as count FROM engine_checkpoints').first<{ count: number }>();
    expect(remainingCheckpoints?.count).toBe(0);

    const anchor = await getCanonicalAnchor(db);
    expect(anchor?.canonicalTick).toBe(0);
    expect(anchor?.checkpointId).toBeNull();

    const leaseRow = await db.prepare('SELECT * FROM curator_leases WHERE id = 1').first<{ curator_id: string; authorized_tick: number }>();
    expect(leaseRow?.curator_id).toBe('none');
    expect(leaseRow?.authorized_tick).toBe(0);

    await worker.scheduled({ cron: '*/15 * * * *' }, { DB: db });

    const newAnchor = await getCanonicalAnchor(db);
    expect(newAnchor?.canonicalTick).toBe(300);
    expect(newAnchor?.checkpointId).not.toBeNull();

    const response = await worker.fetch(new Request('https://garden.test/api/garden'), { DB: db });
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { exactContinuation: boolean; checkpoint?: { tick: number } } };
    expect(body.data.exactContinuation).toBe(true);
    expect(body.data.checkpoint?.tick).toBe(300);

    await migrateToCanonicalSchema(db);
    const preservedAnchor = await getCanonicalAnchor(db);
    expect(preservedAnchor?.canonicalTick).toBe(300);
    expect(preservedAnchor?.checkpointId).toBe(newAnchor?.checkpointId);
    const preservedCheckpoints = await db.prepare('SELECT COUNT(*) as count FROM engine_checkpoints').first<{ count: number }>();
    expect(preservedCheckpoints?.count).toBe(1);
  });
});

