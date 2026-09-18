/**
 * Chaos Garden - Main-Thread Worker Bridge
 *
 * Manages the lifecycle of SimulationWorker, provides typed RPC dispatch,
 * and maintains the zero-allocation transferable render buffer ping-pong exchange.
 */

import type { Vector2D } from '@chaos-garden/shared';
import type {
  ClientWorkerInboundMessage,
  ClientWorkerOutboundMessage,
  TelemetryPulse,
} from './types.js';

export type RenderFrameCallback = (
  tick: number,
  entityCount: number,
  buffer: ArrayBuffer,
) => void;

export type SoilUpdateCallback = (
  tick: number,
  cols: number,
  rows: number,
  moistureBuffer: ArrayBuffer,
  nitrateBuffer: ArrayBuffer,
) => void;

export type TelemetryCallback = (pulse: TelemetryPulse) => void;

export interface WorkerBridgeOptions {
  worker?: Worker;
  onRenderFrame?: RenderFrameCallback;
  onSoilUpdate?: SoilUpdateCallback;
  onTelemetry?: TelemetryCallback;
}

export class WorkerBridge {
  private worker: Worker;
  private isTerminated = false;

  private onRenderFrame?: RenderFrameCallback;
  private onSoilUpdate?: SoilUpdateCallback;
  private onTelemetry?: TelemetryCallback;

  private pendingSnapshotResolve: ((value: string) => void) | null = null;
  private pendingDiagnosticsResolve: ((value: string) => void) | null = null;

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

        case 'SNAPSHOT_PAYLOAD':
          if (this.pendingSnapshotResolve) {
            this.pendingSnapshotResolve(msg.stateJson);
            this.pendingSnapshotResolve = null;
          }
          break;

        case 'DIAGNOSTICS_PAYLOAD':
          if (this.pendingDiagnosticsResolve) {
            this.pendingDiagnosticsResolve(msg.diagnosticsJson);
            this.pendingDiagnosticsResolve = null;
          }
          break;
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('[WorkerBridge] Simulation Worker uncaught error:', error);
    };
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

  init(
    seed: number,
    width: number,
    height: number,
    initialStateJson?: string,
  ): void {
    this.postMessage({
      type: 'INIT',
      seed,
      width,
      height,
      initialStateJson,
    });
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

  selectEntity(idHash: number | null): void {
    this.postMessage({
      type: 'SELECT_ENTITY',
      idHash,
    });
  }

  dispatchCuratorAction(
    action:
      | 'DROP_NUTRIENT'
      | 'WATER_SOIL'
      | 'SPAWN_PLANT'
      | 'SPAWN_HERBIVORE'
      | 'SPAWN_CARNIVORE'
      | 'SPAWN_FUNGUS',
    position: Vector2D,
    amount?: number,
  ): void {
    this.postMessage({
      type: 'CURATOR_ACTION',
      action,
      position,
      amount,
    });
  }

  returnRenderBuffer(buffer: ArrayBuffer): void {
    if (this.isTerminated || buffer.byteLength === 0) return;
    this.worker.postMessage(
      {
        type: 'RETURN_RENDER_BUFFER',
        buffer,
      },
      [buffer],
    );
  }

  requestSnapshot(): Promise<string> {
    return new Promise((resolve) => {
      this.pendingSnapshotResolve = resolve;
      this.postMessage({ type: 'REQUEST_SNAPSHOT' });
    });
  }

  requestDiagnostics(): Promise<string> {
    return new Promise((resolve) => {
      this.pendingDiagnosticsResolve = resolve;
      this.postMessage({ type: 'REQUEST_DIAGNOSTICS' });
    });
  }

  private postMessage(msg: ClientWorkerInboundMessage): void {
    if (this.isTerminated) return;
    this.worker.postMessage(msg);
  }

  terminate(): void {
    if (this.isTerminated) return;
    this.isTerminated = true;
    this.worker.terminate();
  }
}

