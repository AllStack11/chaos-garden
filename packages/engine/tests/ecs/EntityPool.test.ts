import { describe, it, expect } from 'vitest';
import { EntityPool } from '../../src/ecs/EntityPool.js';

describe('EntityPool (Generational Free-List & Dense Compaction)', () => {
  it('initializes with correct capacities and free count', () => {
    const pool = new EntityPool(10);
    expect(pool.capacity).toBe(10);
    expect(pool.freeCount).toBe(10);
    expect(pool.denseCount).toBe(0);
  });

  it('allocates entities sequentially from free list', () => {
    const pool = new EntityPool(5);
    const id0 = pool.allocate();
    const id1 = pool.allocate();
    const id2 = pool.allocate();

    expect(id0).toBe(0);
    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(pool.denseCount).toBe(3);
    expect(pool.freeCount).toBe(2);

    expect(pool.isActive(0)).toBe(true);
    expect(pool.isActive(1)).toBe(true);
    expect(pool.isActive(2)).toBe(true);
    expect(pool.isActive(3)).toBe(false);
  });

  it('returns -1 when pool capacity is exhausted', () => {
    const pool = new EntityPool(3);
    expect(pool.allocate()).toBe(0);
    expect(pool.allocate()).toBe(1);
    expect(pool.allocate()).toBe(2);
    expect(pool.allocate()).toBe(-1);
    expect(pool.denseCount).toBe(3);
    expect(pool.freeCount).toBe(0);
  });

  it('performs O(1) dense compaction on free', () => {
    const pool = new EntityPool(5);
    const e0 = pool.allocate(); // 0 -> densePos 0
    const e1 = pool.allocate(); // 1 -> densePos 1
    const e2 = pool.allocate(); // 2 -> densePos 2

    // Free entity 1 in the middle
    const freed = pool.free(e1);
    expect(freed).toBe(true);
    expect(pool.denseCount).toBe(2);
    expect(pool.isActive(e1)).toBe(false);

    // Entity 2 should have been swapped into position 1
    expect(pool.denseEntities[0]).toBe(e0);
    expect(pool.denseEntities[1]).toBe(e2);
    expect(pool.sparseIndices[e2]).toBe(1);
    expect(pool.sparseIndices[e1]).toBe(-1);
  });

  it('increments generation counter on slot reuse', () => {
    const pool = new EntityPool(3);
    const e0 = pool.allocate(); // slot 0, gen 0
    expect(pool.generations[e0]).toBe(0);
    expect(pool.isValid(e0, 0)).toBe(true);

    pool.free(e0); // generation bumps to 1
    expect(pool.generations[e0]).toBe(1);
    expect(pool.isValid(e0, 0)).toBe(false);

    // Next allocate reuses slot 0
    const reused = pool.allocate();
    expect(reused).toBe(e0);
    expect(pool.isValid(reused, 1)).toBe(true);
    expect(pool.isValid(reused, 0)).toBe(false);
  });

  it('handles invalid free calls safely', () => {
    const pool = new EntityPool(5);
    expect(pool.free(-1)).toBe(false);
    expect(pool.free(10)).toBe(false);
    expect(pool.free(2)).toBe(false); // not allocated
  });

  it('resets correctly', () => {
    const pool = new EntityPool(4);
    pool.allocate();
    pool.allocate();
    expect(pool.denseCount).toBe(2);

    pool.reset();
    expect(pool.denseCount).toBe(0);
    expect(pool.freeCount).toBe(4);
    expect(pool.isActive(0)).toBe(false);
  });
});

