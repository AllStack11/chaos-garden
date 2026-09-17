/**
 * Chaos Garden - High-Performance Binary Render Stride & Worker Protocol
 * 
 * Defines the flat TypedArray layout used to stream 2,000+ entities from
 * the simulation Web Worker to PixiJS with zero garbage collection allocations.
 */

import type { EntityTypeCode } from './taxonomy.js';
import type { Vector2D } from './spatial.js';

/**
 * Number of 32-bit floating point numbers allocated per entity in the render buffer.
 * Stride: [ID_HASH, POS_X, POS_Y, ROTATION, SIZE, TYPE_CODE, HEALTH_RATIO, ENERGY_RATIO]
 */
export const STRIDE_FLOAT_COUNT = 8;

/**
 * Byte size of a single entity stride (8 floats * 4 bytes/float = 32 bytes).
 */
export const STRIDE_BYTE_LENGTH = STRIDE_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT;

/**
 * Named indices into each 8-float entity slice.
 */
export const RENDER_STRIDE_OFFSET = {
  ID: 0,
  POS_X: 1,
  POS_Y: 2,
  ROTATION: 3,
  SIZE: 4,
  TYPE: 5,
  HEALTH: 6,
  ENERGY: 7,
} as const;

/**
 * Unpacked render snapshot for a single organism.
 */
export interface EntityRenderData {
  idHash: number;
  x: number;
  y: number;
  rotation: number;
  size: number;
  type: EntityTypeCode;
  healthRatio: number; // 0.0 to 1.0
  energyRatio: number; // 0.0 to 1.0
}

/**
 * Messages sent from Main Thread (Svelte / PixiJS) to Web Worker.
 */
export type WorkerInboundMessage =
  | {
      type: 'INIT';
      seed: number;
      width: number;
      height: number;
      initialStateJson?: string;
    }
  | {
      type: 'SET_SPEED';
      speedMultiplier: number; // 0.0 = paused, 1.0, 2.0, 5.0, 10.0
    }
  | {
      type: 'SET_THROTTLE';
      targetTps: number; // e.g. 5 TPS when tab is hidden, 60 when visible
    }
  | {
      type: 'CURATOR_ACTION';
      action: 'DROP_NUTRIENT' | 'WATER_SOIL' | 'SPAWN_PLANT' | 'SPAWN_HERBIVORE' | 'SPAWN_CARNIVORE' | 'SPAWN_FUNGUS';
      position: Vector2D;
      amount?: number;
    }
  | {
      type: 'SELECT_ENTITY';
      idHash: number | null;
    }
  | {
      type: 'REQUEST_SNAPSHOT';
    }
  | {
      type: 'REQUEST_DIAGNOSTICS';
    };

/**
 * Messages sent from Web Worker to Main Thread (Svelte / PixiJS).
 */
export type WorkerOutboundMessage =
  | {
      type: 'RENDER_FRAME';
      tick: number;
      entityCount: number;
      buffer: ArrayBuffer; // Transferred via postMessage(..., [buffer])
    }
  | {
      type: 'SOIL_TEXTURE_UPDATE';
      tick: number;
      cols: number;
      rows: number;
      moistureBuffer: ArrayBuffer;
      nitrateBuffer: ArrayBuffer;
    }
  | {
      type: 'TELEMETRY_PULSE';
      tick: number;
      tps: number;
      populations: {
        plants: number;
        herbivores: number;
        carnivores: number;
        fungi: number;
        totalLiving: number;
      };
      selectedEntityVitals?: {
        idHash: number;
        name: string;
        species: string;
        age: number;
        energy: number;
        health: number;
        generation: number;
        type: string;
        pigment: number;
      } | null;
    }
  | {
      type: 'SNAPSHOT_PAYLOAD';
      stateJson: string;
    }
  | {
      type: 'DIAGNOSTICS_PAYLOAD';
      diagnosticsJson: string;
    };

