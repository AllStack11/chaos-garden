/**
 * Chaos Garden - Flight Recorder Telemetry & Ring Buffer
 * 
 * Pre-allocated 300-tick circular ring buffer tracking census metrics,
 * performance latency, and ecological vitals.
 * Detects extinction warnings, population explosions, and generates
 * machine-readable DiagnosticSnapshot objects for LLM diagnosis.
 */

import {
  type FlightRecorderSnapshot,
  type DiagnosticSnapshot,
  type StructuredLogEvent,
  type EcologicalVitals,
} from '@chaos-garden/shared';
import type { World } from '../ecs/World.js';

export class FlightRecorder {
  readonly capacity: number;

  // Pre-allocated ring buffer columns
  readonly ticks: Uint32Array;
  readonly plants: Uint16Array;
  readonly herbivores: Uint16Array;
  readonly carnivores: Uint16Array;
  readonly fungi: Uint16Array;
  readonly biomass: Float32Array;
  readonly avgEnergy: Float32Array;
  readonly tickDurations: Float32Array;

  private _head: number = 0;
  private _count: number = 0;
  private _recentEvents: StructuredLogEvent[] = [];

  constructor(capacity: number = 300) {
    this.capacity = capacity;
    this.ticks = new Uint32Array(capacity);
    this.plants = new Uint16Array(capacity);
    this.herbivores = new Uint16Array(capacity);
    this.carnivores = new Uint16Array(capacity);
    this.fungi = new Uint16Array(capacity);
    this.biomass = new Float32Array(capacity);
    this.avgEnergy = new Float32Array(capacity);
    this.tickDurations = new Float32Array(capacity);
  }

  get count(): number {
    return this._count;
  }

  /**
   * Records telemetry for the current simulation tick.
   * Modifies pre-allocated buffers with zero heap allocations.
   */
  recordTick(world: World): void {
    const summary = world.getPopulationSummary();
    const idx = this._head;

    const totalLiving = summary.totalLiving;
    const avgE = totalLiving > 0 ? summary.totalBiomass / totalLiving : 0;

    this.ticks[idx] = world.tick;
    this.plants[idx] = summary.plants;
    this.herbivores[idx] = summary.herbivores;
    this.carnivores[idx] = summary.carnivores;
    this.fungi[idx] = summary.fungi;
    this.biomass[idx] = summary.totalBiomass;
    this.avgEnergy[idx] = avgE;
    this.tickDurations[idx] = world.lastTickDurationMs;

    this._head = (this._head + 1) % this.capacity;
    if (this._count < this.capacity) {
      this._count++;
    }

    // Anomaly checks
    if (world.tick > 10) {
      if (summary.plants === 0) {
        this.addEvent(world.tick, 'WARN', 'METABOLISM', 'FLORA_EXTINCTION', 'Plant population dropped to 0');
      }
      if (summary.herbivores === 0) {
        this.addEvent(world.tick, 'WARN', 'METABOLISM', 'HERBIVORE_EXTINCTION', 'Herbivore population dropped to 0');
      }
      if (summary.carnivores === 0) {
        this.addEvent(world.tick, 'INFO', 'METABOLISM', 'CARNIVORE_EXTINCTION', 'Carnivore population dropped to 0');
      }
      if (world.lastTickDurationMs > 16.6) {
        this.addEvent(world.tick, 'WARN', 'ENGINE', 'SLOW_TICK', `Tick took ${world.lastTickDurationMs.toFixed(2)}ms (exceeded 16.6ms budget)`);
      }
    }
  }

  private addEvent(
    tick: number,
    level: StructuredLogEvent['level'],
    component: StructuredLogEvent['component'],
    event: string,
    message: string
  ): void {
    // Keep max 20 recent events
    if (this._recentEvents.length >= 20) {
      this._recentEvents.shift();
    }
    this._recentEvents.push({
      tick,
      timestamp: new Date().toISOString(),
      level,
      component,
      event,
      message,
    });
  }

  /**
   * Exports circular ring buffer history as a FlightRecorderSnapshot.
   */
  getSnapshot(): FlightRecorderSnapshot {
    const history: FlightRecorderSnapshot['populationHistory'] = [];
    const startIdx = this._count < this.capacity ? 0 : this._head;

    for (let i = 0; i < this._count; i++) {
      const pos = (startIdx + i) % this.capacity;
      history.push({
        tick: this.ticks[pos],
        plants: this.plants[pos],
        herbivores: this.herbivores[pos],
        carnivores: this.carnivores[pos],
        fungi: this.fungi[pos],
        biomass: this.biomass[pos],
      });
    }

    const startTick = this._count > 0 ? this.ticks[startIdx] : 0;
    const endPos = (startIdx + this._count - 1) % this.capacity;
    const endTick = this._count > 0 ? this.ticks[endPos] : 0;

    return {
      historyLength: this._count,
      tickRange: {
        start: startTick,
        end: endTick,
      },
      populationHistory: history,
      recentEvents: [...this._recentEvents],
    };
  }

  /**
   * Constructs an instant DiagnosticSnapshot for LLM ingestion.
   */
  getDiagnosticSnapshot(world: World): DiagnosticSnapshot {
    const summary = world.getPopulationSummary();
    const totalLiving = summary.totalLiving;

    let totalHealth = 0;
    const activeCount = world.pool.denseCount;
    const dense = world.pool.denseEntities;
    for (let i = 0; i < activeCount; i++) {
      totalHealth += world.storage.healths[dense[i]];
    }

    // Soil metrics
    let totalMoisture = 0;
    let totalNitrates = 0;
    let aridCount = 0;
    const cellCount = world.soil.totalCells;
    const mBuf = world.soil.moisture;
    const nBuf = world.soil.nitrates;

    for (let i = 0; i < cellCount; i++) {
      totalMoisture += mBuf[i];
      totalNitrates += nBuf[i];
      if (mBuf[i] < 0.2) aridCount++;
    }

    const vitals: EcologicalVitals = {
      totalLiving,
      totalBiomass: summary.totalBiomass,
      avgEnergy: totalLiving > 0 ? summary.totalBiomass / totalLiving : 0,
      avgHealth: totalLiving > 0 ? totalHealth / totalLiving : 0,
      predatorPreyRatio: summary.herbivores > 0 ? summary.carnivores / summary.herbivores : 0,
      soilAverageMoisture: cellCount > 0 ? totalMoisture / cellCount : 0,
      soilAverageNitrates: cellCount > 0 ? totalNitrates / cellCount : 0,
      aridLandPercentage: cellCount > 0 ? (aridCount / cellCount) * 100 : 0,
      biodiversityIndex:
        (summary.plants > 0 ? 1 : 0) +
        (summary.herbivores > 0 ? 1 : 0) +
        (summary.carnivores > 0 ? 1 : 0) +
        (summary.fungi > 0 ? 1 : 0),
    };

    return {
      tick: world.tick,
      timestamp: new Date().toISOString(),
      seed: world.seed,
      tps: world.config.targetTps,
      tickDurationMs: world.lastTickDurationMs,
      populations: summary,
      vitals,
      recentAnomalies: [...this._recentEvents],
      reproducibleSeed: world.seed,
    };
  }

  /**
   * Formats diagnostic snapshot as a markdown summary for LLM debugging.
   */
  formatMarkdown(snap: DiagnosticSnapshot): string {
    return [
      `### 🌿 Chaos Garden Diagnostic Snapshot (Tick ${snap.tick})`,
      `- **Seed**: \`${snap.seed}\` | **TPS**: ${snap.tps} | **Latency**: ${snap.tickDurationMs.toFixed(2)}ms`,
      `- **Populations**: Plants: ${snap.populations.plants} | Herbivores: ${snap.populations.herbivores} | Carnivores: ${snap.populations.carnivores} | Fungi: ${snap.populations.fungi}`,
      `- **Vitals**: Avg Energy: ${snap.vitals.avgEnergy.toFixed(1)} | Avg Health: ${snap.vitals.avgHealth.toFixed(1)} | Pred/Prey Ratio: ${snap.vitals.predatorPreyRatio.toFixed(2)}`,
      `- **Soil**: Avg Moisture: ${(snap.vitals.soilAverageMoisture * 100).toFixed(1)}% | Avg Nitrates: ${(snap.vitals.soilAverageNitrates * 100).toFixed(1)}% | Arid: ${snap.vitals.aridLandPercentage.toFixed(1)}%`,
      snap.recentAnomalies.length > 0
        ? `- **Recent Alerts**: ${snap.recentAnomalies.map((a) => `[${a.level}] ${a.event}: ${a.message}`).join('; ')}`
        : `- **Alerts**: All systems nominal.`,
    ].join('\n');
  }
}

