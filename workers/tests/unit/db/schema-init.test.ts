import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Miniflare } from 'miniflare';
import type { D1Database } from '../../../src/types/worker';

describe('Database Schema Initialization & Integrity (workers/schema.sql)', () => {
  const schemaPath = path.resolve(__dirname, '../../../../workers/schema.sql');
  let mf: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response(null); } }',
      d1Databases: ['DB'],
    });
    db = (await mf.getD1Database('DB')) as unknown as D1Database;
  });

  afterAll(async () => {
    if (mf) {
      await mf.dispose();
    }
  });

  it('executes schema.sql against a fresh database with zero errors', async () => {
    const rawSql = fs.readFileSync(schemaPath, 'utf8');
    const cleanSql = rawSql.replace(/--.*$/gm, '');
    const statements = cleanSql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      const result = await db.prepare(statement).run();
      expect(result.success).toBe(true);
    }
  });

  it('initializes system_metadata with schema_version 1.9.0', async () => {
    const row = await db
      .prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'")
      .first<{ value: string }>();

    expect(row).toBeDefined();
    expect(row?.value).toBe('1.9.0');
  });

  it('creates singleton curator_leases row (id = 1) and enforces CHECK constraint', async () => {
    const row = await db
      .prepare('SELECT * FROM curator_leases WHERE id = 1')
      .first<{
        id: number;
        lease_id: string;
        curator_id: string;
        granted_at_ms: number;
        expires_at_ms: number;
        authorized_tick: number;
      }>();

    expect(row).toBeDefined();
    expect(row?.id).toBe(1);

    // Attempting to insert a row with id != 1 must fail due to CHECK (id = 1)
    await expect(
      db
        .prepare(
          `INSERT INTO curator_leases (id, lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick)
           VALUES (2, 'lease-2', 'curator-attacker', 0, 1000, 10)`,
        )
        .run(),
    ).rejects.toThrow();
  });

  it('proves atomic Compare-And-Swap (CAS) lease claim, renewal, and mutual exclusion in D1', async () => {
    const now = 1000000;
    const ttl = 120000;
    const expiresAt = now + ttl;

    const casQuery = `
      UPDATE curator_leases
      SET lease_id = ?,
          curator_id = ?,
          granted_at_ms = ?,
          expires_at_ms = ?,
          authorized_tick = ?,
          updated_at = datetime('now')
      WHERE id = 1
        AND (
          expires_at_ms <= ?
          OR curator_id = ?
          OR (lease_id = ? AND ? IS NOT NULL)
        )
    `;

    // 1. Initial claim by Alice (current lease is expired at 0 <= 1000000)
    const claimAlice = await db
      .prepare(casQuery)
      .bind(
        'lease-alice',
        'curator-alice',
        now,
        expiresAt,
        100,
        now,
        'curator-alice',
        '',
        null,
      )
      .run();
    expect(claimAlice.meta.changes).toBe(1);

    // 2. Competing claim by Bob while Alice's lease is active (now < expiresAt)
    const claimBob = await db
      .prepare(casQuery)
      .bind(
        'lease-bob',
        'curator-bob',
        now + 1000,
        now + 1000 + ttl,
        105,
        now + 1000,
        'curator-bob',
        '',
        null,
      )
      .run();
    // Bob's CAS update MUST match 0 rows (rejected)
    expect(claimBob.meta.changes).toBe(0);

    // Verify Alice is still the exclusive active leaseholder
    const currentActive = await db
      .prepare('SELECT * FROM curator_leases WHERE id = 1')
      .first<{ curator_id: string; lease_id: string }>();
    expect(currentActive?.curator_id).toBe('curator-alice');
    expect(currentActive?.lease_id).toBe('lease-alice');

    // 3. Alice renews her own lease
    const renewAlice = await db
      .prepare(casQuery)
      .bind(
        'lease-alice',
        'curator-alice',
        now + 5000,
        now + 5000 + ttl,
        110,
        now + 5000,
        'curator-alice',
        'lease-alice',
        'lease-alice',
      )
      .run();
    expect(renewAlice.meta.changes).toBe(1);

    // 4. Bob claims after Alice's lease expires
    const futureTime = expiresAt + 60000;
    const futureClaimBob = await db
      .prepare(casQuery)
      .bind(
        'lease-bob',
        'curator-bob',
        futureTime,
        futureTime + ttl,
        200,
        futureTime,
        'curator-bob',
        '',
        null,
      )
      .run();
    expect(futureClaimBob.meta.changes).toBe(1);

    const finalActive = await db
      .prepare('SELECT * FROM curator_leases WHERE id = 1')
      .first<{ curator_id: string; lease_id: string }>();
    expect(finalActive?.curator_id).toBe('curator-bob');
    expect(finalActive?.lease_id).toBe('lease-bob');
  });

  it('proves atomic conditional checkpoint persistence conditioned on singleton lease in D1', async () => {
    // Current lease is held by Bob with expiresAt = futureTime + ttl, authorized_tick = 200
    // Test 1: Valid checkpoint insertion from Bob with tick 250
    const validInsert = await db
      .prepare(
        `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM curator_leases
           WHERE id = 1
             AND lease_id = ?
             AND curator_id = ?
             AND expires_at_ms > ?
             AND authorized_tick < ?
         )`,
      )
      .bind(
        250,
        2,
        42,
        'mock-checksum-1',
        new Uint8Array([1, 2, 3, 4]),
        'lease-bob',
        'curator-bob',
        1000000,
        250,
      )
      .run();
    expect(validInsert.meta.changes).toBe(1);

    // Test 2: Alice attempts to commit checkpoint using stale/expired lease
    const invalidInsertAlice = await db
      .prepare(
        `INSERT INTO engine_checkpoints (tick, engine_version, seed, checksum, payload)
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM curator_leases
           WHERE id = 1
             AND lease_id = ?
             AND curator_id = ?
             AND expires_at_ms > ?
             AND authorized_tick < ?
         )`,
      )
      .bind(
        260,
        2,
        42,
        'mock-checksum-2',
        new Uint8Array([5, 6, 7, 8]),
        'lease-alice', // stale lease
        'curator-alice', // wrong curator
        1000000,
        260,
      )
      .run();
    // Rejection: 0 rows inserted
    expect(invalidInsertAlice.meta.changes).toBe(0);

    // Check count in engine_checkpoints: exactly 1 (Bob's)
    const countRow = await db
      .prepare('SELECT COUNT(*) as count FROM engine_checkpoints')
      .first<{ count: number }>();
    expect(countRow?.count).toBe(1);
  });
});
