import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

describe('Database Schema Initialization & Integrity (workers/schema.sql)', () => {
  const schemaPath = path.resolve(__dirname, '../../../../workers/schema.sql');

  it('executes schema.sql against a fresh database with zero errors', () => {
    const db = new DatabaseSync(':memory:');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    expect(() => {
      db.exec(sql);
    }).not.toThrow();
  });

  it('initializes system_metadata with schema_version 1.9.0', () => {
    const db = new DatabaseSync(':memory:');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(sql);

    const row = db
      .prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.value).toBe('1.9.0');
  });

  it('creates singleton curator_leases row (id = 1) and enforces CHECK constraint', () => {
    const db = new DatabaseSync(':memory:');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(sql);

    const row = db.prepare('SELECT * FROM curator_leases WHERE id = 1').get() as {
      id: number;
      lease_id: string;
      curator_id: string;
      granted_at_ms: number;
      expires_at_ms: number;
      authorized_tick: number;
    };

    expect(row).toBeDefined();
    expect(row.id).toBe(1);

    // Attempting to insert a row with id != 1 must fail due to CHECK (id = 1)
    expect(() => {
      db.prepare(
        `INSERT INTO curator_leases (id, lease_id, curator_id, granted_at_ms, expires_at_ms, authorized_tick)
         VALUES (2, 'lease-2', 'curator-attacker', 0, 1000, 10)`
      ).run();
    }).toThrow();
  });

  it('proves atomic Compare-And-Swap (CAS) lease claim, renewal, and mutual exclusion in SQLite', () => {
    const db = new DatabaseSync(':memory:');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(sql);

    const now = 1000000;
    const ttl = 120000;
    const expiresAt = now + ttl;

    const casStmt = db.prepare(`
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
    `);

    // 1. Initial claim by Alice (current lease is expired at 0 <= 1000000)
    const claimAlice = casStmt.run(
      'lease-alice',
      'curator-alice',
      now,
      expiresAt,
      100,
      now,
      'curator-alice',
      '',
      null
    );
    expect(claimAlice.changes).toBe(1);

    // 2. Competing claim by Bob while Alice's lease is active (now < expiresAt)
    const claimBob = casStmt.run(
      'lease-bob',
      'curator-bob',
      now + 1000,
      now + 1000 + ttl,
      105,
      now + 1000,
      'curator-bob',
      '',
      null
    );
    // Bob's CAS update MUST match 0 rows (rejected)
    expect(claimBob.changes).toBe(0);

    // Verify Alice is still the exclusive active leaseholder
    const currentActive = db.prepare('SELECT * FROM curator_leases WHERE id = 1').get() as {
      curator_id: string;
      lease_id: string;
    };
    expect(currentActive.curator_id).toBe('curator-alice');
    expect(currentActive.lease_id).toBe('lease-alice');

    // 3. Alice renews her own lease
    const renewAlice = casStmt.run(
      'lease-alice',
      'curator-alice',
      now + 5000,
      now + 5000 + ttl,
      110,
      now + 5000,
      'curator-alice',
      'lease-alice',
      'lease-alice'
    );
    expect(renewAlice.changes).toBe(1);

    // 4. Bob claims after Alice's lease expires
    const futureTime = expiresAt + 60000;
    const futureClaimBob = casStmt.run(
      'lease-bob',
      'curator-bob',
      futureTime,
      futureTime + ttl,
      200,
      futureTime,
      'curator-bob',
      '',
      null
    );
    expect(futureClaimBob.changes).toBe(1);

    const finalActive = db.prepare('SELECT * FROM curator_leases WHERE id = 1').get() as {
      curator_id: string;
      lease_id: string;
    };
    expect(finalActive.curator_id).toBe('curator-bob');
    expect(finalActive.lease_id).toBe('lease-bob');
  });
});

