import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Miniflare } from 'miniflare';
import { CANONICAL_CUTOVER_SQL, CURRENT_SCHEMA_VERSION, migrateToCanonicalSchema } from '../../../src/db/migrations';
import type { D1Database } from '../../../src/types/worker';

function parseSqlStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

describe('Canonical Cutover Parity & Integrity', () => {
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

  it('guarantees statement parity between canonical-cutover.sql and migrations.ts', () => {
    const cutoverSqlPath = path.resolve(__dirname, '../../../../workers/canonical-cutover.sql');
    const fileSql = fs.readFileSync(cutoverSqlPath, 'utf8');

    const fileStatements = parseSqlStatements(fileSql);
    const codeStatements = parseSqlStatements(CANONICAL_CUTOVER_SQL);

    expect(fileStatements.length).toBeGreaterThan(0);
    expect(fileStatements).toEqual(codeStatements);
  });

  it('references CURRENT_SCHEMA_VERSION in cutover SQL', () => {
    expect(CANONICAL_CUTOVER_SQL).toContain(`'${CURRENT_SCHEMA_VERSION}'`);
  });

  it('executes cutover SQL cleanly against a fresh database', async () => {
    await migrateToCanonicalSchema(db);

    const versionRow = await db
      .prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'")
      .first<{ value: string }>();
    expect(versionRow?.value).toBe(CURRENT_SCHEMA_VERSION);

    const anchorRow = await db
      .prepare('SELECT * FROM canonical_anchor WHERE id = 1')
      .first<{ id: number; canonical_tick: number }>();
    expect(anchorRow?.id).toBe(1);
    expect(anchorRow?.canonical_tick).toBe(0);

    const leaseRow = await db
      .prepare('SELECT * FROM curator_leases WHERE id = 1')
      .first<{ id: number; curator_id: string }>();
    expect(leaseRow?.id).toBe(1);
    expect(leaseRow?.curator_id).toBe('none');
  });
});

