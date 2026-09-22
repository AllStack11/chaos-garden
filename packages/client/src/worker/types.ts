/**
 * Chaos Garden - Client Web Worker Message Protocol & Transfer Contracts
 * 
 * Strict discriminated unions and typed RPC boundaries between the main thread
 * (PixiJS/Svelte) and the simulation Web Worker.
 */

import type {
  Vector2D,
  EntityTypeCode,
  PopulationSummary,
  WorkerInboundMessage as SharedWorkerInboundMessage,
  WorkerOutboundMessage as SharedWorkerOutboundMessage,
  EncodedEngineCheckpoint,
  CanonicalWorldState,
  DiagnosticSnapshot,
  SelectedEntityVitals,
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
export type { SelectedEntityVitals };

export type BootstrapContinuationMode = 'exact' | 'legacy' | 'primordial';

export interface BootstrapCandidate {
  kind: 'canonical' | 'localBranch';
  checkpoint?: EncodedEngineCheckpoint;
  canonicalState?: CanonicalWorldState;
  branchId?: string;
  label?: string;
}

export type CuratorActionType =
  | 'DROP_NUTRIENT'
  | 'WATER_SOIL'
  | 'SPAWN_PLANT'
  | 'SPAWN_HERBIVORE'
  | 'SPAWN_CARNIVORE'
  | 'SPAWN_FUNGUS'
  | 'CULL_ENTITY';

// ==========================================
// Inbound Messages (Main Thread -> Worker)
// ==========================================

export interface InitMessage {
  type: 'INIT';
  requestId: number;
  seed: number;
  width: number;
  height: number;
  candidate?: BootstrapCandidate;
}

export interface SetSpeedMessage {
  type: 'SET_SPEED';
  speedMultiplier: number;
}

export interface SetThrottleMessage {
  type: 'SET_THROTTLE';
  targetTps: number;
}

export interface ReturnRenderBufferMessage {
  type: 'RETURN_RENDER_BUFFER';
  buffer: Float32Array;
}

export interface ReturnSoilBufferMessage {
  type: 'RETURN_SOIL_BUFFER';
  moistureBuffer: Float32Array;
  nitrateBuffer: Float32Array;
}

export interface PickEntityMessage {
  type: 'PICK_ENTITY_AT_WORLD_POSITION';
  requestId: number;
  x: number;
  y: number;
  maxRadius?: number;
}

export interface TelemetryPulse {
  type: 'TELEMETRY_PULSE';
export interface SelectEntityMessage {
  type: 'SELECT_ENTITY';
  entityId: number | null;
}

export interface CuratorActionMessage {
  type: 'CURATOR_ACTION';
  action: CuratorActionType;
  position?: Vector2D;
  amount?: number;
  entityId?: number;
}

export interface RequestSnapshotMessage {
  type: 'REQUEST_SNAPSHOT';
  requestId: number;
}

export interface RequestDiagnosticsMessage {
  type: 'REQUEST_DIAGNOSTICS';
  requestId: number;
}

export type ClientWorkerInboundMessage =
  | InitMessage
  | SetSpeedMessage
  | SetThrottleMessage
  | ReturnRenderBufferMessage
  | ReturnSoilBufferMessage
  | PickEntityMessage
  | SelectEntityMessage
  | CuratorActionMessage
  | RequestSnapshotMessage
  | RequestDiagnosticsMessage;

// ==========================================
// Outbound Messages (Worker -> Main Thread)
// ==========================================

export interface BootstrapStatusMessage {
  type: 'BOOTSTRAP_STATUS';
  requestId: number;
  mode: BootstrapContinuationMode;
  success: boolean;
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
  failureCode?:
    | 'CHECKSUM_MISMATCH'
    | 'DECODE_ERROR'
    | 'CAPACITY_MISMATCH'
    | 'CORRUPT_BYTES'
    | 'UNSUPPORTED_VERSION'
    | 'HYDRATION_FAILED';
  errorDetails?: string;
}

export interface RenderFrameMessage {
  type: 'RENDER_FRAME';
  tick: number;
  entityCount: number;
  buffer: Float32Array;
}

export interface SoilTextureUpdateMessage {
  type: 'SOIL_TEXTURE_UPDATE';
  tick: number;
  cols: number;
  rows: number;
  moistureBuffer: Float32Array;
  nitrateBuffer: Float32Array;
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

export interface PickResultMessage {
  type: 'PICK_RESULT';
  requestId: number;
  entityId: number | null;
}

export interface SnapshotPayloadMessage {
  type: 'SNAPSHOT_PAYLOAD';
  stateJson: string;
  requestId: number;
  checkpoint: EncodedEngineCheckpoint;
  canonicalState?: CanonicalWorldState;
}

export interface DiagnosticsPayloadMessage {
  type: 'DIAGNOSTICS_PAYLOAD';
  diagnosticsJson: string;
  requestId: number;
  diagnostics: DiagnosticSnapshot;
}

export type ClientWorkerOutboundMessage =
  | BootstrapStatusMessage
  | RenderFrameMessage
  | SoilTextureUpdateMessage
  | TelemetryPulse
  | PickResultMessage
  | SnapshotPayloadMessage
  | DiagnosticsPayloadMessage;

export type ReturnRenderBufferMessage = {
  type: 'RETURN_RENDER_BUFFER';
  buffer: Float32Array;
};

export type ReturnSoilBufferMessage = {
  type: 'RETURN_SOIL_BUFFER';
  moistureBuffer: Float32Array;
  nitrateBuffer: Float32Array;
};

export type ClientWorkerInboundMessage =
  | SharedWorkerInboundMessage
  | ReturnRenderBufferMessage
  | ReturnSoilBufferMessage;
