import { describe, expect, it } from 'vitest';
import { executeQuery, isDatabaseConnected, queryAll, queryFirst } from '../../../src/db/connection';
import { FakeD1Database } from '../../helpers/fake-d1';

describe('integration/db/connection', () => {
  it('binds parameters and executes run query', async () => {
    const db = new FakeD1Database({ runResult: { success: true, meta: { duration: 1, last_row_id: 3, changes: 1 } } });

    const result = await executeQuery<{ id: number }>(db, 'SELECT ? as value', [42]);

    expect(result.success).toBe(true);
    expect(db.lastQuery).toBe('SELECT ? as value');
    expect(db.lastPreparedStatement?.boundParams).toEqual([42]);
  });

  it('returns rows from queryAll', async () => {
    const db = new FakeD1Database({ allResult: [{ id: 1 }, { id: 2 }] });

    const rows = await queryAll<{ id: number }>(db, 'SELECT id FROM entities');

    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns null for missing queryFirst result', async () => {
    const db = new FakeD1Database({ firstResult: null });

    const row = await queryFirst<{ id: number }>(db, 'SELECT id FROM entities LIMIT 1');

    expect(row).toBeNull();
  });

  it('reports database connectivity with SELECT 1', async () => {
    const db = new FakeD1Database({ firstResult: { value: 1 } });

    const connected = await isDatabaseConnected(db);

    expect(connected).toBe(true);
  });
});
