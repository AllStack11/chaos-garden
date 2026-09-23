import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Miniflare } from 'miniflare';
import worker, { resetDatabaseReadyForTesting } from '../../src/index';
import { acquireOrRenewCuratorLease, commitCanonicalCheckpoint, getCanonicalAnchor, getCanonicalWorldState } from '../../src/db/queries';
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
});
