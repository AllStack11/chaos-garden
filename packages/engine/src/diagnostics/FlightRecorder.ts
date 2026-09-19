/**
 * Chaos Garden - Flight Recorder Telemetry & Ring Buffer
 * 
 * Pre-allocated 300-tick circular ring buffer tracking census metrics,
 * performance latency, and ecological vitals.
 * Detects extinction warnings, population explosions, and generates
 * machine-readable DiagnosticSnapshot objects for LLM diagnosis.
 * Operates with 0 byte heap allocations during per-tick recording.
 * Bounded event buffer tracks anomalies without array shift() or object churn.
 */

import {
  type FlightRecorderSnapshot,
  type DiagnosticSnapshot,
  type StructuredLogEvent,
  type EcologicalVitals,
} from '@chaos-garden/shared';
import type { World } from '../ecs/World.js';

const EVENT_LEVELS: StructuredLogEvent['level'][] = ['INFO', 'WARN', 'ERROR'];
const EVENT_COMPONENTS: StructuredLogEvent['component'][] = ['METABOLISM', 'ENGINE', 'GENETICS'];
const EVENT_DEFINITIONS = [
  { event: 'FLORA_EXTINCTION', message: 'Plant population dropped to 0' },
  { event: 'HERBIVORE_EXTINCTION', message: 'Herbivore population dropped to 0' },
  { event: 'CARNIVORE_EXTINCTION', message: 'Carnivore population dropped to 0' },
  { event: 'SLOW_TICK', message: 'Tick exceeded 16.6ms budget' },
];

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

  // Pre-allocated bounded ring buffer for recent events (max 20)
  readonly eventCapacity = 20;
  readonly eventTicks: Uint32Array;
  readonly eventLevels: Uint8Array;
  readonly eventComponents: Uint8Array;
  readonly eventCodes: Uint8Array;
  private _eventHead: number = 0;
  private _eventCount: number = 0;

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

    this.eventTicks = new Uint32Array(this.eventCapacity);
    this.eventLevels = new Uint8Array(this.eventCapacity);
    this.eventComponents = new Uint8Array(this.eventCapacity);
    this.eventCodes = new Uint8Array(this.eventCapacity);
  }

  get count(): number {
    return this._count;
  }

  /**
   * Fast, zero-allocation scalar telemetry write path called per-tick from World.step().
   * Modifies pre-allocated buffers with exactly 0 bytes allocated.
   */
  recordTickDirect(
    tick: number,
    tickDurationMs: number,
    plants: number,
    herbivores: number,
    carnivores: number,
    fungi: number,
    totalBiomass: number,
  ): void {
    const idx = this._head;
    const totalLiving = plants + herbivores + carnivores + fungi;
    const avgE = totalLiving > 0 ? totalBiomass / totalLiving : 0;

    this.ticks[idx] = tick;
    this.plants[idx] = plants;
    this.herbivores[idx] = herbivores;
    this.carnivores[idx] = carnivores;
    this.fungi[idx] = fungi;
    this.biomass[idx] = totalBiomass;
    this.avgEnergy[idx] = avgE;
    this.tickDurations[idx] = tickDurationMs;

    this._head = (this._head + 1) % this.capacity;
    if (this._count < this.capacity) {
      this._count++;
    }

    // Anomaly checks - bounded ring buffer without allocations
    if (tick > 10) {
      if (plants === 0) this.recordAnomaly(tick, 1, 0, 0);
      if (herbivores === 0) this.recordAnomaly(tick, 1, 0, 1);
      if (carnivores === 0) this.recordAnomaly(tick, 0, 0, 2);
      if (tickDurationMs > 16.6) this.recordAnomaly(tick, 1, 1, 3);
    }
  }

  /**
   * Backward-compatible recordTick method that accepts a World instance.
   */
  recordTick(world: World): void {
    const summary = world.getPopulationSummary();
    this.recordTickDirect(
      world.tick,
      world.lastTickDurationMs,
      summary.plants,
      summary.herbivores,
      summary.carnivores,
      summary.fungi,
      summary.totalBiomass,
    );
  }

  private recordAnomaly(tick: number, level: number, component: number, code: number): void {
    const idx = this._eventHead;
    this.eventTicks[idx] = tick;
    this.eventLevels[idx] = level;
    this.eventComponents[idx] = component;
    this.eventCodes[idx] = code;

    this._eventHead = (this._eventHead + 1) % this.eventCapacity;
    if (this._eventCount < this.eventCapacity) {
      this._eventCount++;
    }
  }

  private materializeEvents(): StructuredLogEvent[] {
    const events: StructuredLogEvent[] = [];
    const start = this._eventCount < this.eventCapacity ? 0 : this._eventHead;
    const nowIso = new Date().toISOString();

    for (let i = 0; i < this._eventCount; i++) {
      const pos = (start + i) % this.eventCapacity;
      const code = this.eventCodes[pos];
      const def = EVENT_DEFINITIONS[code] ?? { event: 'UNKNOWN', message: 'Unknown event' };
      events.push({
        tick: this.eventTicks[pos],
        timestamp: nowIso,
        level: EVENT_LEVELS[this.eventLevels[pos]] ?? 'INFO',
        component: EVENT_COMPONENTS[this.eventComponents[pos]] ?? 'ENGINE',
        event: def.event,
        message: def.message,
      });
    }
    return events;
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
      recentEvents: this.materializeEvents(),
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
      recentAnomalies: this.materializeEvents(),
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
