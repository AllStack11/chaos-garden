import { describe, it, expect, vi } from 'vitest';
import { WorkerBridge } from '../../src/worker/WorkerBridge.js';
import type {
  ClientWorkerInboundMessage,
  ClientWorkerOutboundMessage,
  TelemetryPulse,
} from '../../src/worker/types.js';

class MockWorker {
  public postMessage = vi.fn();
  public terminate = vi.fn();
  public onmessage: ((ev: MessageEvent) => any) | null = null;
  public onerror: ((ev: ErrorEvent) => any) | null = null;

  simulateMessage(data: ClientWorkerOutboundMessage): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

describe('WorkerBridge Unit Tests', () => {
  it('initializes and posts INIT message to the worker', () => {
    const mockWorker = new MockWorker() as unknown as Worker;
    const bridge = new WorkerBridge({ worker: mockWorker });

    bridge.init(42, 1600, 1200);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'INIT',
      seed: 42,
      width: 1600,
      height: 1200,
      initialStateJson: undefined,
    });
  });

  it('initializes with optional initialStateJson snapshot', () => {
    const mockWorker = new MockWorker() as unknown as Worker;
    const bridge = new WorkerBridge({ worker: mockWorker });

    const snapshot = '{"tick":420,"entities":[]}';
    bridge.init(42, 1600, 1200, snapshot);

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'INIT',
      seed: 42,
      width: 1600,
      height: 1200,
      initialStateJson: snapshot,
    });
  });

  it('routes SET_SPEED, SET_THROTTLE and CURATOR_ACTION messages', () => {
    const mockWorker = new MockWorker() as unknown as Worker;
    const bridge = new WorkerBridge({ worker: mockWorker });

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

    bridge.dispatchCuratorAction('WATER_SOIL', { x: 100, y: 200 }, 0.5);
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'CURATOR_ACTION',
      action: 'WATER_SOIL',
      position: { x: 100, y: 200 },
      amount: 0.5,
    });
  });

  it('dispatches returnRenderBuffer with transfer list', () => {
    const mockWorker = new MockWorker() as unknown as Worker;
    const bridge = new WorkerBridge({ worker: mockWorker });

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
    const mockWorker = new MockWorker() as unknown as Worker;
    const bridge = new WorkerBridge({ worker: mockWorker });

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

    const bridge = new WorkerBridge({
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

    const bridge = new WorkerBridge({
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

    const bridge = new WorkerBridge({
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

  it('resolves requestSnapshot when SNAPSHOT_PAYLOAD arrives', async () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    const snapshotPromise = bridge.requestSnapshot();

    mockWorker.simulateMessage({
      type: 'SNAPSHOT_PAYLOAD',
      stateJson: '{"tick":500}',
    });

    const result = await snapshotPromise;
    expect(result).toBe('{"tick":500}');
  });

  it('terminates the worker cleanly', () => {
    const mockWorker = new MockWorker();
    const bridge = new WorkerBridge({ worker: mockWorker as unknown as Worker });

    bridge.terminate();
    expect(mockWorker.terminate).toHaveBeenCalled();

    // After termination, postMessage should not be called
    bridge.setSpeed(1.0);
    expect(mockWorker.postMessage).not.toHaveBeenCalled();
  });
});

