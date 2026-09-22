/**
 * Chaos Garden - Dedicated Simulation Web Worker
 *
 * Runs the @chaos-garden/engine World at a fixed timestep on an isolated thread.
 * Streams zero-copy binary render frames to the main thread via Transferable ArrayBuffers.
 * Implements atomic candidate World verification, spatial picking, and World-owned curator mutations.
 */

import {
  World,
} from '@chaos-garden/engine';
import {
  DEFAULT_SIMULATION_CONFIG,
  EntityTypeCode,
} from '@chaos-garden/shared';
import type {
  ClientWorkerInboundMessage,
  ClientWorkerOutboundMessage,
  BootstrapContinuationMode,
  BootstrapStatusMessage,
} from './types.js';
import { SoilBufferPool } from './SoilBufferPool.js';

let world: World | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

let targetTps = 60;
let speedMultiplier = 1.0;
let selectedEntityId: number | null = null;
const soilPool = new SoilBufferPool();

// Telemetry & soil rate counters
let lastTelemetryTime = 0;
let lastSoilUpdateTime = 0;
let tickCounter = 0;
let measuredTps = 60;
let tpsMeasurementStartTime = performance.now();

function simulationLoop(): void {
  if (!isRunning || !world) return;

  const now = performance.now();
  const dt = 1 / targetTps;

  // Step simulation when unpaused
  if (speedMultiplier > 0) {
    const substeps = Math.max(1, Math.round(speedMultiplier));
    for (let s = 0; s < substeps; s++) {
      world.step(dt);
      tickCounter++;
    }
  }

  // 1. Send transferable render frame (60 FPS) with backpressure skip
  const frame = world.getTransferableRenderFrame();
  if (frame !== null) {
    const renderMessage: ClientWorkerOutboundMessage = {
      type: 'RENDER_FRAME',
      tick: frame.tick,
      entityCount: frame.entityCount,
      buffer: frame.buffer,
    };
    self.postMessage(renderMessage, [frame.buffer.buffer]);
  }

  // 2. Throttled Soil Update (15 Hz) with backpressure
  if (now - lastSoilUpdateTime >= 66) {
    const slot = soilPool.acquireSlot();
    if (slot !== -1) {
      lastSoilUpdateTime = now;
      const soil = world.soil;
      const moisture = soilPool.getMoisture(slot);
      const nitrates = soilPool.getNitrates(slot);
      moisture.set(soil.moisture);
      nitrates.set(soil.nitrates);
      soilPool.detachSlot(slot);

      const soilMessage: ClientWorkerOutboundMessage = {
        type: 'SOIL_TEXTURE_UPDATE',
        tick: world.tick,
        cols: soil.cols,
        rows: soil.rows,
        moistureBuffer: moisture,
        nitrateBuffer: nitrates,
      };
      self.postMessage(soilMessage, [moisture.buffer, nitrates.buffer]);
    }
  }

  // 3. Throttled Telemetry Pulse (10 Hz)
  if (now - lastTelemetryTime >= 100) {
    lastTelemetryTime = now;

    // Calculate TPS
    const elapsedSinceTps = (now - tpsMeasurementStartTime) / 1000;
    if (elapsedSinceTps >= 1.0) {
      measuredTps = Math.round(tickCounter / elapsedSinceTps);
      tickCounter = 0;
      tpsMeasurementStartTime = now;
    }

    const census = world.getPopulationSummary();
    const vitals = selectedEntityId !== null ? world.getEntityVitals(selectedEntityId) : null;
    if (selectedEntityId !== null && vitals === null) {
      // Entity died or deallocated
      selectedEntityId = null;
    }

    const telemetryMessage: ClientWorkerOutboundMessage = {
      type: 'TELEMETRY_PULSE',
      tick: world.tick,
      tps: measuredTps,
      populations: {
        plants: census.plants,
        herbivores: census.herbivores,
        carnivores: census.carnivores,
        fungi: census.fungi,
        totalLiving: census.totalLiving,
        totalBiomass: Math.round(census.totalBiomass),
      },
      selectedEntityVitals: vitals,
    };
    self.postMessage(telemetryMessage);
  }

  // Schedule next tick with dynamic compensation
  const elapsed = performance.now() - now;
  const interval = 1000 / targetTps;
  const delay = Math.max(1, interval - elapsed);
  timerId = setTimeout(simulationLoop, delay);
}

function startLoop(): void {
  if (isRunning) return;
  isRunning = true;
  tpsMeasurementStartTime = performance.now();
  tickCounter = 0;
  simulationLoop();
}

function stopLoop(): void {
  isRunning = false;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

self.onmessage = async (event: MessageEvent<ClientWorkerInboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT': {
      stopLoop();
      selectedEntityId = null;

      const candidateWorld = new World({
        seed: msg.seed,
        config: {
          ...DEFAULT_SIMULATION_CONFIG,
          gardenWidth: msg.width,
          gardenHeight: msg.height,
        },
      });

      let mode: BootstrapContinuationMode = 'primordial';
      let success = true;
      let failureCode: BootstrapStatusMessage['failureCode'] = undefined;
      let errorDetails: string | undefined = undefined;

      if (msg.candidate?.checkpoint) {
        try {
          const hydrated = await candidateWorld.hydrateEngineCheckpoint(msg.candidate.checkpoint);
          if (hydrated) {
            mode = 'exact';
            world = candidateWorld;
          } else {
            failureCode = 'CHECKSUM_MISMATCH';
            errorDetails = 'Checkpoint checksum verification or binary decoding failed';
          }
        } catch (err: unknown) {
          failureCode = 'DECODE_ERROR';
          errorDetails = err instanceof Error ? err.message : String(err);
        }
      } else if (msg.candidate?.canonicalState) {
        try {
          const hydrated = candidateWorld.hydrateCanonicalState(msg.candidate.canonicalState);
          if (hydrated) {
            mode = 'legacy';
            world = candidateWorld;
          } else {
            failureCode = 'HYDRATION_FAILED';
            errorDetails = 'Canonical state hydration failed';
          }
        } catch (err: unknown) {
          failureCode = 'DECODE_ERROR';
          errorDetails = err instanceof Error ? err.message : String(err);
        }
      }

      // If hydration failed or primordial requested, fall back cleanly
      if (mode === 'primordial' || failureCode !== undefined) {
        if (failureCode !== undefined) {
          world = new World({
            seed: msg.seed,
            config: {
              ...DEFAULT_SIMULATION_CONFIG,
              gardenWidth: msg.width,
              gardenHeight: msg.height,
            },
          });
          mode = 'primordial';
          success = false;
        } else {
          world = candidateWorld;
        }
        world.seedPrimordialEcosystem();
      }

      const activeWorld = world!;
      soilPool.init(activeWorld.soil.cols, activeWorld.soil.rows);

      const statusMsg: BootstrapStatusMessage = {
        type: 'BOOTSTRAP_STATUS',
        requestId: msg.requestId,
        mode,
        success,
        tick: activeWorld.tick,
        failureCode,
        errorDetails,
      };
      self.postMessage(statusMsg);

      startLoop();
      break;
    }

    case 'RETURN_RENDER_BUFFER': {
      if (world) {
        world.returnRenderBuffer(msg.buffer);
      }
      break;
    }

    case 'RETURN_SOIL_BUFFER': {
      soilPool.release(msg.moistureBuffer, msg.nitrateBuffer);
      break;
    }

    case 'SET_SPEED': {
      speedMultiplier = Math.max(0, msg.speedMultiplier);
      break;
    }

    case 'SET_THROTTLE': {
      targetTps = Math.max(1, msg.targetTps);
      break;
    }

    case 'PICK_ENTITY_AT_WORLD_POSITION': {
      const entityId = world
        ? world.pickEntityAt({ x: msg.x, y: msg.y }, msg.maxRadius ?? 32)
        : null;
      self.postMessage({
        type: 'PICK_RESULT',
        requestId: msg.requestId,
        entityId,
      });
      break;
    }

    case 'SELECT_ENTITY': {
      selectedEntityId = msg.entityId;
      break;
    }

    case 'CURATOR_ACTION': {
      if (!world) break;
      const { action, position, amount, entityId } = msg;
      if (action === 'WATER_SOIL' && position) {
        world.waterSoil(position, amount ?? 0.4);
      } else if (action === 'DROP_NUTRIENT' && position) {
        world.fertilizeSoil(position, amount ?? 0.4);
      } else if (action === 'SPAWN_PLANT' && position) {
        world.spawnOrganism(EntityTypeCode.PLANT, position);
      } else if (action === 'SPAWN_HERBIVORE' && position) {
        world.spawnOrganism(EntityTypeCode.HERBIVORE, position);
      } else if (action === 'SPAWN_CARNIVORE' && position) {
        world.spawnOrganism(EntityTypeCode.CARNIVORE, position);
      } else if (action === 'SPAWN_FUNGUS' && position) {
        world.spawnOrganism(EntityTypeCode.FUNGUS, position);
      } else if (action === 'CULL_ENTITY' && entityId !== undefined) {
        world.terminateOrganism(entityId);
        if (selectedEntityId === entityId) {
          selectedEntityId = null;
        }
      }
      break;
    }

    case 'REQUEST_SNAPSHOT': {
      if (!world) break;
      const checkpoint = await world.exportEngineCheckpoint();
      const canonicalState = world.exportCanonicalState();
      self.postMessage({
        type: 'SNAPSHOT_PAYLOAD',
        stateJson: JSON.stringify({
          canonicalState,
          checkpoint,
        }),
        requestId: msg.requestId,
        checkpoint,
        canonicalState,
      });
      break;
    }

    case 'REQUEST_DIAGNOSTICS': {
      if (!world) break;
      const diagnostics = world.flightRecorder.getDiagnosticSnapshot(world);
      self.postMessage({
        type: 'DIAGNOSTICS_PAYLOAD',
        diagnosticsJson: JSON.stringify(diagnostics),
        requestId: msg.requestId,
        diagnostics,
      });
      break;
    }
  }
};
