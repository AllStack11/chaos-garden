import { describe, it, expect } from 'vitest';
import { RenderPackingSystem } from '../../src/systems/RenderPackingSystem.js';
import { EntityPool } from '../../src/ecs/EntityPool.js';
import { ComponentStorage } from '../../src/ecs/ComponentStorage.js';
import { EntityTypeCode, STRIDE_FLOAT_COUNT, unpackStrideToEntity } from '@chaos-garden/shared';

describe('RenderPackingSystem (Zero-Allocation Stride Packing)', () => {
  it('serializes active entities into flat Float32Array stride buffer', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const packing = new RenderPackingSystem(10);

    const e0 = pool.allocate();
    storage.initEntity(e0, {
      idHash: 777,
      typeCode: EntityTypeCode.HERBIVORE,
      x: 150.5,
      y: 250.25,
      rotation: 1.2,
      size: 9.0,
      pigment: 180,
      energy: 80,
      health: 90,
    });

    const packedCount = packing.pack(pool, storage);
    expect(packedCount).toBe(1);

    const unpacked = unpackStrideToEntity(packing.currentBuffer, 0);
    expect(unpacked.idHash).toBe(777);
    expect(unpacked.x).toBeCloseTo(150.5);
    expect(unpacked.y).toBeCloseTo(250.25);
    expect(unpacked.rotation).toBeCloseTo(1.2);
    expect(unpacked.size).toBeCloseTo(9.0);
    expect(unpacked.type).toBe(EntityTypeCode.HERBIVORE);
    expect(unpacked.healthRatio).toBeCloseTo(0.9);
    expect(unpacked.energyRatio).toBeCloseTo(0.8);
  });

  it('swaps buffers across the fixed 3-buffer pool', () => {
    const packing = new RenderPackingSystem(10);
    const buf1 = packing.currentBuffer;
    packing.swapBuffers();
    const buf2 = packing.currentBuffer;
    expect(buf1).not.toBe(buf2);

    packing.swapBuffers();
    const buf3 = packing.currentBuffer;
    expect(buf3).not.toBe(buf1);
    expect(buf3).not.toBe(buf2);
  });

  it('exhausts 3-buffer pool and returns null without allocation', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const packing = new RenderPackingSystem(10);

    packing.pack(pool, storage, 1);
    const f1 = packing.getTransferableRenderFrame();

    packing.pack(pool, storage, 2);
    const f2 = packing.getTransferableRenderFrame();

    packing.pack(pool, storage, 3);
    const f3 = packing.getTransferableRenderFrame();

    expect(f1).not.toBeNull();
    expect(f2).not.toBeNull();
    expect(f3).not.toBeNull();

    // 4th call should return null under backpressure (pack returns 0, getTransferable returns null)
    const packedCount = packing.pack(pool, storage, 4);
    expect(packedCount).toBe(0);
    const f4 = packing.getTransferableRenderFrame();
    expect(f4).toBeNull();
    expect(packing.pool.inFlightCount).toBe(3);
    expect(packing.pool.availableCount).toBe(0);

    // Return one buffer and verify it becomes available again
    const returned = packing.returnRenderBuffer(f1!.buffer);
    expect(returned).toBe(true);
    expect(packing.pool.availableCount).toBe(1);

    packing.pack(pool, storage, 5);
    const f5 = packing.getTransferableRenderFrame();
    expect(f5).not.toBeNull();
    expect(f5?.tick).toBe(5);
  });

  it('re-attaches and reuses detached returned buffers', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const packing = new RenderPackingSystem(10);

    packing.pack(pool, storage, 1);
    const frame = packing.getTransferableRenderFrame();
    expect(frame).not.toBeNull();

    // In a Web Worker transfer, the buffer is transferred and detached
    const { port1 } = new MessageChannel();
    port1.postMessage(frame!.buffer.buffer, [frame!.buffer.buffer]);
    expect(frame!.buffer.byteLength).toBe(0);

    // When the renderer finishes with a frame, it returns a buffer of matching length
    const returnedBuffer = new Float32Array(10 * STRIDE_FLOAT_COUNT);
    const success = packing.returnRenderBuffer(returnedBuffer);
    expect(success).toBe(true);
    expect(packing.pool.availableCount).toBe(3);
  });

  it('simulates 1,000 frames with delayed UI returns with bounded buffer count', () => {
    const pool = new EntityPool(10);
    const storage = new ComponentStorage(10);
    const packing = new RenderPackingSystem(10);

    // Queue of in-flight frames simulating UI lag
    const uiQueue: Float32Array[] = [];
    let publishedFrames = 0;
    let droppedFrames = 0;

    for (let frame = 1; frame <= 1000; frame++) {
      packing.pack(pool, storage, frame);
      const renderFrame = packing.getTransferableRenderFrame();
      if (renderFrame) {
        publishedFrames++;
        uiQueue.push(renderFrame.buffer);
      } else {
        droppedFrames++;
      }

      // UI returns a buffer every 2-3 frames with delay
      if (uiQueue.length > 0 && (frame % 2 === 0 || uiQueue.length >= 3)) {
        const returnedBuf = uiQueue.shift()!;
        const success = packing.returnRenderBuffer(returnedBuf);
        expect(success).toBe(true);
      }

      // Total buffers in system (pool + UI queue) must always equal 3
      expect(packing.pool.availableCount + packing.pool.inFlightCount).toBe(3);
    }

    // Drain remaining
    while (uiQueue.length > 0) {
      packing.returnRenderBuffer(uiQueue.shift()!);
    }
    expect(packing.pool.availableCount).toBe(3);
    expect(publishedFrames).toBeGreaterThan(0);
  });
});

