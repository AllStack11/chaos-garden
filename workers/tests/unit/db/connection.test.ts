import { describe, expect, it, vi } from 'vitest';
import { runInTransaction } from '../../../src/db/connection';
import type { D1Database } from '../../../src/types/worker';

function createMockDatabase(): D1Database & { exec: ReturnType<typeof vi.fn> } {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
      raw: vi.fn()
    })),
    dump: vi.fn(async () => new ArrayBuffer(0)),
    batch: vi.fn(async () => []),
    exec: vi.fn(async () => ({ count: 1, duration: 0 }))
  };
}

describe('db/connection runInTransaction', () => {
  it('commits when operation succeeds', async () => {
    const db = createMockDatabase();

    const result = await runInTransaction(db, async () => 'ok');

    expect(result).toBe('ok');
    expect(db.exec).toHaveBeenNthCalledWith(1, 'BEGIN IMMEDIATE');
    expect(db.exec).toHaveBeenNthCalledWith(2, 'COMMIT');
  });

  it('rolls back when operation throws', async () => {
    const db = createMockDatabase();

    await expect(
      runInTransaction(db, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(db.exec).toHaveBeenNthCalledWith(1, 'BEGIN IMMEDIATE');
    expect(db.exec).toHaveBeenNthCalledWith(2, 'ROLLBACK');
  });
});
