/**
 * Chaos Garden - Dedicated Simulation Web Worker
 *
 * Runs the @chaos-garden/engine World at a fixed timestep on an isolated thread.
 * Streams zero-copy binary render frames to the main thread via Transferable ArrayBuffers.
 */

import {
  World,
  type WorldOptions,
} from '@chaos-garden/engine';
import {
  DEFAULT_SIMULATION_CONFIG,
  EntityTypeCode,
  type Vector2D,
} from '@chaos-garden/shared';
import type {
  ClientWorkerInboundMessage,
  ClientWorkerOutboundMessage,
  SelectedEntityVitals,
} from './types.js';

let world: World | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

let targetTps = 60;
let speedMultiplier = 1.0;
let selectedEntityIdHash: number | null = null;

// Telemetry & soil rate counters
let lastTelemetryTime = 0;
let lastSoilUpdateTime = 0;
let lastTickTime = performance.now();
let tickCounter = 0;
let measuredTps = 60;
let tpsMeasurementStartTime = performance.now();

function spawnCreature(
  type: EntityTypeCode,
  position: Vector2D,
  worldInstance: World,
): void {
  const idx = worldInstance.pool.allocate();
  if (idx === -1) return;

  const prng = worldInstance.prng;
  const angle = prng() * Math.PI * 2;
  const idHash = (Math.floor(prng() * 1000000) + 1) & 0x00ffffff;

  let baseSize = 8;
  let pigment = 120;
  let speed = 0;
  let force = 0;
  let threshold = 60;

  switch (type) {
    case EntityTypeCode.PLANT:
      baseSize = 6;
      pigment = 120;
      speed = 0;
      force = 0;
      threshold = worldInstance.config.plantReproductionThreshold;
      break;
    case EntityTypeCode.HERBIVORE:
      baseSize = 8;
      pigment = 200;
      speed = 22;
      force = 4;
      threshold = worldInstance.config.herbivoreReproductionThreshold;
      break;
    case EntityTypeCode.CARNIVORE:
      baseSize = 12;
      pigment = 0;
      speed = 30;
      force = 6;
      threshold = worldInstance.config.carnivoreReproductionThreshold;
      break;
    case EntityTypeCode.FUNGUS:
      baseSize = 5;
      pigment = 280;
      speed = 0;
      force = 0;
      threshold = worldInstance.config.fungusReproductionThreshold;
      break;
  }

  worldInstance.storage.initEntity(idx, {
    idHash: idHash === 0 ? 1 : idHash,
    typeCode: type,
    x: position.x,
    y: position.y,
    vx: Math.cos(angle) * (speed * 0.5),
    vy: Math.sin(angle) * (speed * 0.5),
    rotation: angle,
    size: baseSize + (prng() * 2 - 1),
    pigment,
    energy: 80,
    health: 100,
    generation: 1,
    parentIndex: -1,
    bornAtTick: worldInstance.tick,
    lifespan: 1500 + Math.floor(prng() * 500),
    metabolismRate: worldInstance.config.baseEnergyCostPerTick,
    reproductionThreshold: threshold,
    mutationRate: worldInstance.config.mutationMagnitude,
    photosynthesisRate: type === EntityTypeCode.PLANT ? 1.2 : 0,
    seedDispersionRadius: type === EntityTypeCode.PLANT ? 50 : 0,
    moistureAffinity: 0.5,
    maxSpeed: speed,
    maxForce: force,
    perceptionRadius: type === EntityTypeCode.PLANT ? 0 : 60,
    fleeRadius: type === EntityTypeCode.HERBIVORE ? 90 : 0,
    flockingWeight: type === EntityTypeCode.HERBIVORE ? 0.8 : 0.4,
    packWeight: type === EntityTypeCode.CARNIVORE ? 1.2 : 0,
    decompositionRate: type === EntityTypeCode.FUNGUS ? 1.0 : 0,
  });
}

function applyCuratorBrush(
  action: 'WATER_SOIL' | 'DROP_NUTRIENT',
  center: Vector2D,
  amount: number = 0.4,
  radius: number = 32,
): void {
  if (!world) return;
  const soil = world.soil;
  const step = soil.cellSize;
  const halfSteps = Math.ceil(radius / step);

  for (let dy = -halfSteps; dy <= halfSteps; dy++) {
    for (let dx = -halfSteps; dx <= halfSteps; dx++) {
      const px = center.x + dx * step;
      const py = center.y + dy * step;
      const dist = Math.hypot(px - center.x, py - center.y);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        const deposit = amount * falloff;
        if (action === 'WATER_SOIL') {
          soil.addMoisture(px, py, deposit);
        } else {
          soil.depositNitrates(px, py, deposit);
        }
      }
    }
  }
}

function getSelectedVitals(): SelectedEntityVitals | null {
  if (!world || selectedEntityIdHash === null) return null;

  const count = world.pool.denseCount;
  const dense = world.pool.denseEntities;
  const storage = world.storage;

  for (let i = 0; i < count; i++) {
    const idx = dense[i];
    if (storage.idHashes[idx] === selectedEntityIdHash) {
      const typeCode = storage.typeCodes[idx] as EntityTypeCode;
      let kingdomName = 'Organism';
      let speciesName = 'Primordial';

      switch (typeCode) {
        case EntityTypeCode.PLANT:
          kingdomName = 'Flora';
          speciesName = 'Photosynthetic Alga';
          break;
        case EntityTypeCode.HERBIVORE:
          kingdomName = 'Herbivore';
          speciesName = 'Amoebic Boid';
          break;
        case EntityTypeCode.CARNIVORE:
          kingdomName = 'Carnivore';
          speciesName = 'Predatory Dart';
          break;
        case EntityTypeCode.FUNGUS:
          kingdomName = 'Fungus';
          speciesName = 'Hyphal Mycelium';
          break;
      }

      const vx = storage.velocitiesX[idx];
      const vy = storage.velocitiesY[idx];

      return {
        idHash: selectedEntityIdHash,
        name: `${speciesName} #${selectedEntityIdHash.toString(16).toUpperCase()}`,
        species: kingdomName,
        age: storage.ages[idx],
        maxLifespan: storage.maxLifespans[idx],
        energy: Math.round(storage.energies[idx] * 10) / 10,
        health: Math.round(storage.healths[idx] * 10) / 10,
        generation: storage.generations[idx],
        type: typeCode,
        pigment: storage.pigments[idx],
        speed: Math.round(Math.hypot(vx, vy) * 10) / 10,
        maxSpeed: storage.maxSpeeds[idx],
        perceptionRadius: storage.perceptionRadii[idx],
        reproductionThreshold: storage.reproductionThresholds[idx],
        metabolismRate: storage.metabolismRates[idx],
        parentIndex: storage.parentIndices[idx],
        x: Math.round(storage.positionsX[idx]),
        y: Math.round(storage.positionsY[idx]),
      };
    }
  }

  // If organism died, clear selection
  selectedEntityIdHash = null;
  return null;
}

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

  // 1. Send transferable render frame (60 FPS)
  const frame = world.getTransferableRenderFrame();
  const frameBuffer = frame.buffer.buffer as ArrayBuffer;
  const renderMessage: ClientWorkerOutboundMessage = {
    type: 'RENDER_FRAME',
    tick: frame.tick,
    entityCount: frame.entityCount,
    buffer: frameBuffer,
  };
  self.postMessage(renderMessage, [frameBuffer]);

  // 2. Throttled Soil Update (15 Hz)
  if (now - lastSoilUpdateTime >= 66) {
    lastSoilUpdateTime = now;
    const soil = world.soil;
    const moistureCopy = new Float32Array(soil.moisture);
    const nitrateCopy = new Float32Array(soil.nitrates);
    const moistureBuf = moistureCopy.buffer as ArrayBuffer;
    const nitrateBuf = nitrateCopy.buffer as ArrayBuffer;

    const soilMessage: ClientWorkerOutboundMessage = {
      type: 'SOIL_TEXTURE_UPDATE',
      tick: world.tick,
      cols: soil.cols,
      rows: soil.rows,
      moistureBuffer: moistureBuf,
      nitrateBuffer: nitrateBuf,
    };
    self.postMessage(soilMessage, [moistureBuf, nitrateBuf]);
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
    const vitals = getSelectedVitals();

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
  lastTickTime = performance.now();
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

self.onmessage = (event: MessageEvent<ClientWorkerInboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT': {
      stopLoop();
      world = new World({
        seed: msg.seed,
        config: {
          ...DEFAULT_SIMULATION_CONFIG,
          gardenWidth: msg.width,
          gardenHeight: msg.height,
        },
      });
      world.seedPrimordialEcosystem();
      startLoop();
      break;
    }

    case 'RETURN_RENDER_BUFFER': {
      if (world) {
        world.returnRenderBuffer(new Float32Array(msg.buffer));
      }
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

    case 'SELECT_ENTITY': {
      selectedEntityIdHash = msg.idHash;
      break;
    }

    case 'CURATOR_ACTION': {
      if (!world) break;
      const { action, position, amount } = msg;
      if (action === 'WATER_SOIL' || action === 'DROP_NUTRIENT') {
        applyCuratorBrush(action, position, amount ?? 0.4);
      } else if (action === 'SPAWN_PLANT') {
        spawnCreature(EntityTypeCode.PLANT, position, world);
      } else if (action === 'SPAWN_HERBIVORE') {
        spawnCreature(EntityTypeCode.HERBIVORE, position, world);
      } else if (action === 'SPAWN_CARNIVORE') {
        spawnCreature(EntityTypeCode.CARNIVORE, position, world);
      } else if (action === 'SPAWN_FUNGUS') {
        spawnCreature(EntityTypeCode.FUNGUS, position, world);
      }
      break;
    }

    case 'REQUEST_SNAPSHOT': {
      if (!world) break;
      const summary = world.getPopulationSummary();
      const snapshot = {
        tick: world.tick,
        seed: world.seed,
        populations: summary,
        config: world.config,
      };
      self.postMessage({
        type: 'SNAPSHOT_PAYLOAD',
        stateJson: JSON.stringify(snapshot),
      });
      break;
    }

    case 'REQUEST_DIAGNOSTICS': {
      if (!world) break;
      const census = world.getPopulationSummary();
      const diagnostics = {
        tick: world.tick,
        tps: measuredTps,
        census,
      };
      self.postMessage({
        type: 'DIAGNOSTICS_PAYLOAD',
        diagnosticsJson: JSON.stringify(diagnostics),
      });
      break;
    }
  }
};

