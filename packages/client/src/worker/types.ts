/**
 * Chaos Garden - Client Web Worker Message Protocol & Transfer Contracts
 */

import type {
  Vector2D,
  EntityTypeCode,
  PopulationSummary,
  WorkerInboundMessage as SharedWorkerInboundMessage,
  WorkerOutboundMessage as SharedWorkerOutboundMessage,
} from '@chaos-garden/shared';

export interface SelectedEntityVitals {
  idHash: number;
  name: string;
  species: string;
  age: number;
  maxLifespan: number;
  energy: number;
  health: number;
  generation: number;
  type: EntityTypeCode;
  pigment: number;
  speed: number;
  maxSpeed: number;
  perceptionRadius: number;
  reproductionThreshold: number;
  metabolismRate: number;
  parentIndex: number;
  x: number;
  y: number;
}

export interface TelemetryPulse {
  type: 'TELEMETRY_PULSE';
  tick: number;
  tps: number;
  populations: {
    plants: number;
    herbivores: number;
    carnivores: number;
    fungi: number;
    totalLiving: number;
    totalBiomass: number;
  };
  selectedEntityVitals?: SelectedEntityVitals | null;
}

export interface RenderFrameMessage {
  type: 'RENDER_FRAME';
  tick: number;
  entityCount: number;
  buffer: ArrayBuffer;
}

export interface SoilTextureUpdateMessage {
  type: 'SOIL_TEXTURE_UPDATE';
  tick: number;
  cols: number;
  rows: number;
  moistureBuffer: ArrayBuffer;
  nitrateBuffer: ArrayBuffer;
}

export interface SnapshotPayloadMessage {
  type: 'SNAPSHOT_PAYLOAD';
  stateJson: string;
}

export interface DiagnosticsPayloadMessage {
  type: 'DIAGNOSTICS_PAYLOAD';
  diagnosticsJson: string;
}

export type ClientWorkerOutboundMessage =
  | RenderFrameMessage
  | SoilTextureUpdateMessage
  | TelemetryPulse
  | SnapshotPayloadMessage
  | DiagnosticsPayloadMessage;

export type ReturnRenderBufferMessage = {
  type: 'RETURN_RENDER_BUFFER';
  buffer: ArrayBuffer;
};

export type ClientWorkerInboundMessage =
  | SharedWorkerInboundMessage
  | ReturnRenderBufferMessage;

