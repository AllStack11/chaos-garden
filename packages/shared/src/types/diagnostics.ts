/**
 * Chaos Garden - Observability, Telemetry & LLM Diagnostics Types
 * 
 * Provides machine-readable logging schemas, ecological health metrics,
 * and Flight Recorder telemetry structures designed for easy LLM parsing.
 */

import type { PopulationSummary } from './taxonomy.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type LogComponent =
  | 'ENGINE'
  | 'ECS'
  | 'PHYSICS'
  | 'METABOLISM'
  | 'SOIL'
  | 'GENETICS'
  | 'RENDERER'
  | 'AUDIO'
  | 'SERVER';

/**
 * Machine-readable JSONL structured log entry.
 */
export interface StructuredLogEvent {
  tick: number;
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  event: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Derived macro indicators assessing the stability of the ecosystem.
 */
export interface EcologicalVitals {
  totalLiving: number;
  totalBiomass: number;
  avgEnergy: number;
  avgHealth: number;
  predatorPreyRatio: number;
  soilAverageMoisture: number;
  soilAverageNitrates: number;
  aridLandPercentage: number;
  biodiversityIndex: number;
}

/**
 * High-signal diagnostic snapshot formatted specifically for LLM analysis,
 * unit test assertions, and 1-click clipboard export in the Curator HUD.
 */
export interface DiagnosticSnapshot {
  tick: number;
  timestamp: string;
  seed: number;
  tps: number;
  tickDurationMs: number;
  populations: PopulationSummary;
  vitals: EcologicalVitals;
  recentAnomalies: StructuredLogEvent[];
  reproducibleSeed: number;
}

/**
 * Time-series ring buffer dump from the Flight Recorder.
 */
export interface FlightRecorderSnapshot {
  historyLength: number;
  tickRange: {
    start: number;
    end: number;
  };
  populationHistory: Array<{
    tick: number;
    plants: number;
    herbivores: number;
    carnivores: number;
    fungi: number;
    biomass: number;
  }>;
  recentEvents: StructuredLogEvent[];
}

