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
});
