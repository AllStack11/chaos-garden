/**
 * Chaos Garden - Main-Thread Worker Bridge
 *
 * Manages the lifecycle of SimulationWorker, provides typed correlated RPC dispatch
 * with monotonic request IDs, timeout handling, cancellation on reinitialization,
 * single-flight snapshot coalescing, and zero-allocation transferable buffer exchange.
 */

import type {
  Vector2D,
  EncodedEngineCheckpoint,
  CanonicalWorldState,
  DiagnosticSnapshot,
} from '@chaos-garden/shared';
import type {
  ClientWorkerInboundMessage,
  ClientWorkerOutboundMessage,
  BootstrapCandidate,
  BootstrapStatusMessage,
  CuratorActionType,
  TelemetryPulse,
} from './types.js';

export type RenderFrameCallback = (
  tick: number,
  entityCount: number,
  buffer: Float32Array,
) => void;

export type SoilUpdateCallback = (
  tick: number,
  cols: number,
  rows: number,
  moistureBuffer: Float32Array,
  nitrateBuffer: Float32Array,
) => void;

export type TelemetryCallback = (pulse: TelemetryPulse) => void;

export interface WorkerBridgeOptions {
  worker?: Worker;
  onRenderFrame?: RenderFrameCallback;
  onSoilUpdate?: SoilUpdateCallback;
  onTelemetry?: TelemetryCallback;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WorkerBridge {
  private worker: Worker;
  private isTerminated = false;
  private nextRequestId = 1;

  // Correlated RPC pending requests map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingRequests = new Map<number, PendingRequest<any>>();

  // Single-flight coalescing for snapshot requests
  private inFlightSnapshotPromise: Promise<{
    checkpoint: EncodedEngineCheckpoint;
    canonicalState?: CanonicalWorldState;
  }> | null = null;

  private onRenderFrame?: RenderFrameCallback;
  private onSoilUpdate?: SoilUpdateCallback;
  private onTelemetry?: TelemetryCallback;

  constructor(options: WorkerBridgeOptions = {}) {
    this.onRenderFrame = options.onRenderFrame;
    this.onSoilUpdate = options.onSoilUpdate;
    this.onTelemetry = options.onTelemetry;

    if (options.worker) {
      this.worker = options.worker;
    } else {
      this.worker = new Worker(
        new URL('./SimulationWorker.ts', import.meta.url),
        { type: 'module' },
      );
    }

    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    this.worker.onmessage = (
      event: MessageEvent<ClientWorkerOutboundMessage>,
    ) => {
      if (this.isTerminated) return;
      const msg = event.data;

      switch (msg.type) {
        case 'RENDER_FRAME':
          this.onRenderFrame?.(msg.tick, msg.entityCount, msg.buffer);
          break;

        case 'SOIL_TEXTURE_UPDATE':
          this.onSoilUpdate?.(
            msg.tick,
            msg.cols,
            msg.rows,
            msg.moistureBuffer,
            msg.nitrateBuffer,
          );
          break;

        case 'TELEMETRY_PULSE':
          this.onTelemetry?.(msg);
          break;

        case 'BOOTSTRAP_STATUS':
          this.resolvePending(msg.requestId, msg);
          break;

        case 'PICK_RESULT':
          this.resolvePending(msg.requestId, msg.entityId);
          break;

        case 'SNAPSHOT_PAYLOAD':
          this.resolvePending(msg.requestId, {
            checkpoint: msg.checkpoint,
            canonicalState: msg.canonicalState,
          });
          break;

        case 'DIAGNOSTICS_PAYLOAD':
          this.resolvePending(msg.requestId, msg.diagnostics);
          break;
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('[WorkerBridge] Simulation Worker error event:', error);
      this.rejectAllPending(new Error('Simulation worker error: ' + (error.message || 'unknown error')));
    };
  }

  private createCorrelatedRequest<T>(timeoutMs: number): {
    requestId: number;
    promise: Promise<T>;
  } {
    const requestId = this.nextRequestId++;
    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Worker RPC request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
    });

    return { requestId, promise };
  }

  private resolvePending(requestId: number, value: unknown): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.resolve(value);
    }
  }

  private rejectAllPending(reason: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pendingRequests.clear();
    this.inFlightSnapshotPromise = null;
  }

  setRenderFrameCallback(cb: RenderFrameCallback): void {
    this.onRenderFrame = cb;
  }

  setSoilUpdateCallback(cb: SoilUpdateCallback): void {
    this.onSoilUpdate = cb;
  }

  setTelemetryCallback(cb: TelemetryCallback): void {
    this.onTelemetry = cb;
  }

  /**
   * Initializes the worker simulation. Cancels any in-flight requests from earlier sessions.
   */
  init(
    seed: number,
    width: number,
    height: number,
    candidate?: BootstrapCandidate,
    timeoutMs = 8000,
  ): Promise<BootstrapStatusMessage> {
    // Cancel earlier pending requests safely
    this.rejectAllPending(new Error('Worker reinitialized: pending request cancelled'));

    const { requestId, promise } = this.createCorrelatedRequest<BootstrapStatusMessage>(timeoutMs);
    this.postMessage({
      type: 'INIT',
      requestId,
      seed,
      width,
      height,
      candidate,
    });
    return promise;
  }

  setSpeed(speedMultiplier: number): void {
    this.postMessage({
      type: 'SET_SPEED',
      speedMultiplier,
    });
  }

  setThrottle(targetTps: number): void {
    this.postMessage({
      type: 'SET_THROTTLE',
      targetTps,
    });
  }

  /**
   * Deterministically queries the nearest entity at world coordinates.
   */
  pickEntityAt(
    position: Vector2D,
    maxRadius = 32,
    timeoutMs = 3000,
  ): Promise<number | null> {
    const { requestId, promise } = this.createCorrelatedRequest<number | null>(timeoutMs);
    this.postMessage({
      type: 'PICK_ENTITY_AT_WORLD_POSITION',
      requestId,
      x: position.x,
      y: position.y,
      maxRadius,
    });
    return promise;
  }

  /**
   * Selects an entity by its durable entityId (or null to deselect).
   */
  selectEntity(entityId: number | null): void {
    this.postMessage({
      type: 'SELECT_ENTITY',
      entityId,
    });
  }

  dispatchCuratorAction(
    action: CuratorActionType,
    positionOrOptions?: Vector2D | { position?: Vector2D; amount?: number; entityId?: number },
    amount?: number,
  ): void {
    let position: Vector2D | undefined;
    let amt = amount;
    let entityId: number | undefined;

    if (positionOrOptions) {
      if ('x' in positionOrOptions && 'y' in positionOrOptions) {
        position = positionOrOptions as Vector2D;
      } else {
        const opts = positionOrOptions as { position?: Vector2D; amount?: number; entityId?: number };
        position = opts.position;
        if (opts.amount !== undefined) amt = opts.amount;
        entityId = opts.entityId;
      }
    }

    this.postMessage({
      type: 'CURATOR_ACTION',
      action,
      position,
      amount: amt,
      entityId,
    });
  }

  returnRenderBuffer(buffer: Float32Array): void {
    if (this.isTerminated || buffer.byteLength === 0) return;
    this.worker.postMessage(
      {
        type: 'RETURN_RENDER_BUFFER',
        buffer,
      },
      [buffer.buffer],
    );
  }

  returnSoilBuffer(
    moistureBuffer: Float32Array,
    nitrateBuffer: Float32Array,
  ): void {
    if (this.isTerminated) return;
    const transferables: Transferable[] = [];
    if (moistureBuffer.byteLength > 0)
      transferables.push(moistureBuffer.buffer);
    if (nitrateBuffer.byteLength > 0) transferables.push(nitrateBuffer.buffer);
    this.worker.postMessage(
      {
        type: 'RETURN_SOIL_BUFFER',
        moistureBuffer,
        nitrateBuffer,
      },
      transferables,
    );
  }

  /**
   * Requests a binary checkpoint from the worker. Coalesces concurrent calls into a single flight.
   */
  requestSnapshot(timeoutMs = 10000): Promise<{
    checkpoint: EncodedEngineCheckpoint;
    canonicalState?: CanonicalWorldState;
  }> {
    if (this.inFlightSnapshotPromise) {
      return this.inFlightSnapshotPromise;
    }

    const { requestId, promise } = this.createCorrelatedRequest<{
      checkpoint: EncodedEngineCheckpoint;
      canonicalState?: CanonicalWorldState;
    }>(timeoutMs);

    this.inFlightSnapshotPromise = promise.finally(() => {
      this.inFlightSnapshotPromise = null;
    });

    this.postMessage({
      type: 'REQUEST_SNAPSHOT',
      requestId,
    });

    return this.inFlightSnapshotPromise;
  }

  /**
   * Requests diagnostic metrics from the Flight Recorder.
   */
  requestDiagnostics(timeoutMs = 5000): Promise<DiagnosticSnapshot> {
    const { requestId, promise } = this.createCorrelatedRequest<DiagnosticSnapshot>(timeoutMs);
    this.postMessage({
      type: 'REQUEST_DIAGNOSTICS',
      requestId,
    });
    return promise;
  }

  private postMessage(msg: ClientWorkerInboundMessage): void {
    if (this.isTerminated) return;
    this.worker.postMessage(msg);
  }

  terminate(): void {
    if (this.isTerminated) return;
    this.isTerminated = true;
    this.rejectAllPending(new Error('Worker terminated'));
    this.worker.terminate();
  }
}
