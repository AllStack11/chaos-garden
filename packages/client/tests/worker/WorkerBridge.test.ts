import { describe, it, expect, vi } from 'vitest';
import { WorkerBridge } from '../../src/worker/WorkerBridge.js';
import type {
  ClientWorkerOutboundMessage,
  TelemetryPulse,
  BootstrapCandidate,
} from '../../src/worker/types.js';
import type { EncodedEngineCheckpoint, DiagnosticSnapshot } from '@chaos-garden/shared';

class MockWorker {
  public postMessage = vi.fn();
  public terminate = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public onmessage: ((ev: MessageEvent) => any) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public onerror: ((ev: ErrorEvent) => any) | null = null;

  simulateMessage(data: ClientWorkerOutboundMessage): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }

  simulateError(message: string): void {
    if (this.onerror) {
      this.onerror({ message } as ErrorEvent);
    }
  }
}

describe('WorkerBridge Unit Tests (Phase 3 Correlated RPC)', () => {
  it('initializes with candidate and resolves on BOOTSTRAP_STATUS echoing requestId', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const candidate: BootstrapCandidate = {
      kind: 'canonical',
      checkpoint: {
        version: 1,
        tick: 200,
        seed: 42,
        byteLength: 100,
        checksum: 'sha-abc',
        payload: 'base64...',
      },
    };

    const initPromise = bridge.init(42, 1600, 1200, candidate);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'INIT',
      requestId: 1,
      seed: 42,
      width: 1600,
      height: 1200,
      candidate,
    });

    mockWorker.simulateMessage({
      type: 'BOOTSTRAP_STATUS',
      requestId: 1,
      mode: 'exact',
      success: true,
      tick: 200,
    });

    const result = await initPromise;
    expect(result.mode).toBe('exact');
    expect(result.success).toBe(true);
    expect(result.tick).toBe(200);
  });

  it('cancels in-flight requests when a new init is called', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const firstInit = bridge.init(42, 1600, 1200);
    const secondInit = bridge.init(99, 1600, 1200);

    await expect(firstInit).rejects.toThrow('Worker reinitialized');

    mockWorker.simulateMessage({
      type: 'BOOTSTRAP_STATUS',
      requestId: 2,
      mode: 'primordial',
      success: true,
      tick: 0,
    });

    const result = await secondInit;
    expect(result.mode).toBe('primordial');
  });

  it('routes SET_SPEED, SET_THROTTLE, SELECT_ENTITY and CURATOR_ACTION messages', () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    bridge.setSpeed(2.0);
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'SET_SPEED',
      speedMultiplier: 2.0,
    });

    bridge.setThrottle(5);
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'SET_THROTTLE',
      targetTps: 5,
    });

    bridge.selectEntity(1234);
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'SELECT_ENTITY',
      entityId: 1234,
    });

    bridge.dispatchCuratorAction('WATER_SOIL', {
      position: { x: 100, y: 200 },
      amount: 0.5,
    });
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'CURATOR_ACTION',
      action: 'WATER_SOIL',
      position: { x: 100, y: 200 },
      amount: 0.5,
      entityId: undefined,
    });

    bridge.dispatchCuratorAction('CULL_ENTITY', { entityId: 99 });
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'CURATOR_ACTION',
      action: 'CULL_ENTITY',
      position: undefined,
      amount: undefined,
      entityId: 99,
    });
  });

  it('picks entity at world position correlating requestId', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const pickPromise = bridge.pickEntityAt({ x: 50, y: 75 }, 24);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'PICK_ENTITY_AT_WORLD_POSITION',
      requestId: 1,
      x: 50,
      y: 75,
      maxRadius: 24,
    });

    mockWorker.simulateMessage({
      type: 'PICK_RESULT',
      requestId: 1,
      entityId: 42,
    });

    const result = await pickPromise;
    expect(result).toBe(42);
  });

  it('dispatches returnRenderBuffer with transfer list', () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const buffer = new Float32Array(16);
    bridge.returnRenderBuffer(buffer);

    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      {
        type: 'RETURN_RENDER_BUFFER',
        buffer,
      },
      [buffer.buffer],
    );
  });

  it('dispatches returnSoilBuffer with transfer list', () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const moisture = new Float32Array(100);
    const nitrates = new Float32Array(100);
    bridge.returnSoilBuffer(moisture, nitrates);

    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      {
        type: 'RETURN_SOIL_BUFFER',
        moistureBuffer: moisture,
        nitrateBuffer: nitrates,
      },
      [moisture.buffer, nitrates.buffer],
    );
  });

  it('receives RENDER_FRAME and invokes callback', () => {
    const mockWorker = new MockWorker();
    let frameTick = -1;
    let count = -1;

    new WorkerBridge({
      worker: mockWorker as unknown as Worker,
      onRenderFrame: (tick, entityCount) => {
        frameTick = tick;
        count = entityCount;
      },
    });

    const dummyBuffer = new Float32Array(16);
    mockWorker.simulateMessage({
      type: 'RENDER_FRAME',
      tick: 120,
      entityCount: 15,
      buffer: dummyBuffer,
    });

    expect(frameTick).toBe(120);
    expect(count).toBe(15);
  });

  it('receives SOIL_TEXTURE_UPDATE and invokes callback with Float32Array buffers', () => {
    const mockWorker = new MockWorker();
    let soilCols = 0;
    let soilRows = 0;
    let moistureLen = 0;
    let nitrateLen = 0;

    new WorkerBridge({
      worker: mockWorker as unknown as Worker,
      onSoilUpdate: (_tick, cols, rows, mBuf, nBuf) => {
        soilCols = cols;
        soilRows = rows;
        moistureLen = mBuf.length;
        nitrateLen = nBuf.length;
      },
    });

    const moisture = new Float32Array(50);
    const nitrates = new Float32Array(50);
    mockWorker.simulateMessage({
      type: 'SOIL_TEXTURE_UPDATE',
      tick: 240,
      cols: 10,
      rows: 5,
      moistureBuffer: moisture,
      nitrateBuffer: nitrates,
    });

    expect(soilCols).toBe(10);
    expect(soilRows).toBe(5);
    expect(moistureLen).toBe(50);
    expect(nitrateLen).toBe(50);
  });

  it('receives TELEMETRY_PULSE and invokes callback', () => {
    const mockWorker = new MockWorker();
    let receivedPulse: TelemetryPulse | null = null;

    new WorkerBridge({
      worker: mockWorker as unknown as Worker,
      onTelemetry: (pulse) => {
        receivedPulse = pulse;
      },
    });

    const pulse: TelemetryPulse = {
      type: 'TELEMETRY_PULSE',
      tick: 300,
      tps: 60,
      populations: {
        plants: 100,
        herbivores: 30,
        carnivores: 5,
        fungi: 20,
        totalLiving: 155,
        totalBiomass: 12000,
      },
    };

    mockWorker.simulateMessage(pulse);

    expect(receivedPulse).toEqual(pulse);
  });

  it('coalesces concurrent snapshot requests into a single in-flight promise', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const p1 = bridge.requestSnapshot();
    const p2 = bridge.requestSnapshot();

    expect(p1).toBe(p2);
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);

    const dummyCheckpoint: EncodedEngineCheckpoint = {
      version: 1,
      tick: 500,
      seed: 42,
      byteLength: 50,
      checksum: 'hash1',
      payload: 'data1',
    };

    mockWorker.simulateMessage({
      type: 'SNAPSHOT_PAYLOAD',
      stateJson: '{"tick":500}',
      requestId: 1,
      checkpoint: dummyCheckpoint,
    });

    const res1 = await p1;
    const res2 = await p2;
    expect(res1.checkpoint).toEqual(dummyCheckpoint);
    expect(res2.checkpoint).toEqual(dummyCheckpoint);
  });

  it('requests diagnostics and resolves with DiagnosticSnapshot', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const diagPromise = bridge.requestDiagnostics();

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'REQUEST_DIAGNOSTICS',
      requestId: 1,
    });

    const dummyDiag = {
      tick: 350,
      tps: 60,
      populations: { plants: 50, herbivores: 20, carnivores: 5, fungi: 10, totalLiving: 85, totalBiomass: 5000, deadMatterCount: 0, allTimeBirths: 0, allTimeDeaths: 0 },
      vitals: { totalLiving: 85, totalBiomass: 5000, avgEnergy: 60, avgHealth: 100, predatorPreyRatio: 0.1, soilAverageMoisture: 0.5, soilAverageNitrates: 0.5, aridLandPercentage: 0, biodiversityIndex: 1 },
      recentAnomalies: [],
      timestamp: '2026-09-22T00:00:00Z',
      seed: 42,
      tickDurationMs: 0.3,
      reproducibleSeed: 42,
    } as DiagnosticSnapshot;

    mockWorker.simulateMessage({
      type: 'DIAGNOSTICS_PAYLOAD',
      requestId: 1,
      diagnostics: dummyDiag,
    });

    const res = await diagPromise;
    expect(res.tick).toBe(350);
  });

  it('rejects pending requests on timeout', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const timeoutPromise = bridge.pickEntityAt({ x: 0, y: 0 }, 10, 50);

    await expect(timeoutPromise).rejects.toThrow('timed out after 50ms');
  });

  it('terminates the worker cleanly and rejects pending requests', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const pending = bridge.pickEntityAt({ x: 10, y: 20 });
    bridge.terminate();

    expect(mockWorker.terminate).toHaveBeenCalled();
    await expect(pending).rejects.toThrow('Worker terminated');

    bridge.setSpeed(1.0);
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
  });
});
