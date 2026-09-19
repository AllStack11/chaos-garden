import { describe, it, expect } from 'vitest';
import { SoilBufferPool } from '../../src/worker/SoilBufferPool.js';

describe('SoilBufferPool (Zero-Allocation Double-Buffering & Backpressure)', () => {
  it('initializes fixed paired slots without in-loop allocation', () => {
    const pool = new SoilBufferPool();
    pool.init(10, 10);

    const slot0 = pool.acquireSlot();
    expect(slot0).toBeGreaterThanOrEqual(0);

    const m0 = pool.getMoisture(slot0);
    const n0 = pool.getNitrates(slot0);
    expect(m0).toBeInstanceOf(Float32Array);
    expect(n0).toBeInstanceOf(Float32Array);
    expect(m0.length).toBe(100);
    expect(n0.length).toBe(100);
  });

  it('applies natural backpressure when all slots are in flight', () => {
    const pool = new SoilBufferPool();
    pool.init(20, 20);

    // Acquire slot 1
    const slot1 = pool.acquireSlot();
    expect(slot1).toBeGreaterThanOrEqual(0);

    // Acquire slot 2
    const slot2 = pool.acquireSlot();
    expect(slot2).toBeGreaterThanOrEqual(0);
    expect(slot2).not.toBe(slot1);

    // Both 2 slots in flight -> 3rd acquisition must return -1 (backpressure applied, no fallback allocation)
    const slot3 = pool.acquireSlot();
    expect(slot3).toBe(-1);
  });

  it('reclaims returned buffers into available slots without reallocation', () => {
    const pool = new SoilBufferPool();
    pool.init(5, 5);

    const slot0 = pool.acquireSlot();
    const m0 = pool.getMoisture(slot0);
    const n0 = pool.getNitrates(slot0);

    // Detach slot simulating transfer to main thread
    pool.detachSlot(slot0);

    // Pool is now empty (assuming 1 slot remaining was also acquired)
    const slot1 = pool.acquireSlot();
    pool.detachSlot(slot1);
    expect(pool.acquireSlot()).toBe(-1);

    // Main thread returns m0 and n0
    pool.release(m0, n0);

    // Reacquired slot reuses returned buffers
    const reacquiredSlot = pool.acquireSlot();
    expect(reacquiredSlot).toBeGreaterThanOrEqual(0);
    expect(pool.getMoisture(reacquiredSlot)).toBe(m0);
    expect(pool.getNitrates(reacquiredSlot)).toBe(n0);
  });

  it('ignores empty or zero-length buffers on release', () => {
    const pool = new SoilBufferPool();
    pool.init(5, 5);

    const slot0 = pool.acquireSlot();
    const slot1 = pool.acquireSlot();
    pool.detachSlot(slot0);
    pool.detachSlot(slot1);
    expect(pool.acquireSlot()).toBe(-1);

    // Releasing detached (byteLength === 0) buffer must be safely ignored
    const emptyBuf = new Float32Array(0);
    pool.release(emptyBuf, emptyBuf);
    expect(pool.acquireSlot()).toBe(-1);
  });
});
