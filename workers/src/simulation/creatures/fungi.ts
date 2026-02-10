/**
 * Fungi Behavior
 * 
 * The fourth kingdom of life—decomposers that recycle dead matter.
 * Fungi spread through the soil like a network, breaking down
 * dead plants and herbivores into nutrients that sustain the ecosystem.
 * 
 * They are the silent recyclers, the foundation of nutrient cycling.
 */

import type { Entity, Environment, Traits, FungusTraits } from '@chaos-garden/shared';
import { DEFAULT_SIMULATION_CONFIG } from '@chaos-garden/shared';
import type { EventLogger } from '../../logging/event-logger';
import {
  generateEntityId,
  generateRandomName,
  createTimestamp,
  willRandomEventOccur,
  copyTraitsWithPossibleMutations,
  generatePositionNearParent,
  clampValueToRange,
  findNearestEntity,
  calculateDistanceBetweenEntities,
  moveEntityTowardTarget,
  calculateMovementEnergyCost
} from '../environment/helpers';
import { calculateTemperatureMetabolismMultiplier } from '../environment/creature-effects';

// Constants
const BASE_METABOLISM_COST = 0.2; // Fungi have lower metabolism than plants/herbivores
const REPRODUCTION_THRESHOLD = 70; // Fungi reproduce at lower energy than plants
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 25;
const DECOMPOSITION_DISTANCE = 10; // pixels - fungi can decompose nearby dead matter
const MAX_AGE = 300; // Fungi live longer than plants/herbivores
const ENERGY_FROM_DECOMPOSITION = 20; // energy gained per decomposition
const SPORE_SPREAD_RADIUS = 40; // how far spores can travel
const FUNGUS_MOVEMENT_SPEED = 0.4; // slow creeping movement toward dead matter
const FUNGUS_MOVEMENT_COST_MULTIPLIER = 0.25; // moving is cheap but not free

/**
 * Create a new fungus entity.
 */
export function createNewFungusEntity(
  position: { x: number; y: number },
  gardenStateId: number,
  traits?: Partial<FungusTraits>,
  parentId: string = 'origin',
  bornAtTick: number = 0,
  parentName?: string
): Entity {
  const now = createTimestamp();
  
  return {
    id: generateEntityId(),
    gardenStateId,
    bornAtTick,
    deathTick: undefined,
    isAlive: true,
    type: 'fungus',
    name: generateRandomName('fungus', parentName),
    species: 'Mycelium',
    position: { ...position },
    energy: 40, // Start with moderate energy
    health: 100,
    age: 0,
    reproductionRate: traits?.reproductionRate ?? 0.04,
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.2,
    decompositionRate: traits?.decompositionRate ?? 1.0,
    perceptionRadius: traits?.perceptionRadius ?? 50,
    lineage: parentId,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Create initial fungi for a new garden.
 */
export function createInitialFungusPopulation(
  count: number,
  gardenStateId: number
): Entity[] {
  const fungi: Entity[] = [];
  
  for (let i = 0; i < count; i++) {
    const position = {
      x: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenWidth,
      y: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenHeight
    };
    fungi.push(createNewFungusEntity(position, gardenStateId));
  }
  
  return fungi;
}

/**
 * Process a fungus's behavior for one tick.
 * Returns offspring and IDs of entities decomposed.
 */
export async function processFungusBehaviorDuringTick(
  fungus: Entity,
  environment: Environment,
  allEntities: Entity[],
  eventLogger: EventLogger
): Promise<{ offspring: Entity[]; decomposed: string[] }> {
  if (fungus.type !== 'fungus') return { offspring: [], decomposed: [] };
  const offspring: Entity[] = [];
  const decomposed: string[] = [];
  
  // 1. Find nearest dead entity to decompose
  const targetDead = findNearestDeadEntity(fungus, allEntities, fungus.perceptionRadius);
  
  // 2. Decompose if found and within range
  if (targetDead) {
    const distance = calculateDistanceBetweenEntities(fungus, targetDead);
    
    if (distance <= DECOMPOSITION_DISTANCE) {
      // Decompose the dead matter
      const energyGained = decomposeMatter(fungus, targetDead, environment);
      if (energyGained > 0) {
        decomposed.push(targetDead.id);
      }
    } else {
      // Fungi slowly creep toward nearby dead matter.
      moveEntityTowardTarget(fungus, targetDead.position, FUNGUS_MOVEMENT_SPEED);
      const movedDistance = Math.min(distance, FUNGUS_MOVEMENT_SPEED);
      const movementCost = calculateMovementEnergyCost(
        movedDistance,
        fungus.metabolismEfficiency
      ) * FUNGUS_MOVEMENT_COST_MULTIPLIER;
      fungus.energy -= movementCost;
    }
  }
  
  // 3. Base metabolism
  const tempMultiplier = calculateTemperatureMetabolismMultiplier(environment.temperature);
  fungus.energy -= BASE_METABOLISM_COST * tempMultiplier * 0.5; // Fungi have lower metabolism
  
  // 4. Reproduction
  if (fungus.energy >= REPRODUCTION_THRESHOLD) {
    if (willRandomEventOccur(fungus.reproductionRate)) {
      const child = await attemptFungusReproduction(fungus, fungus.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }
  
  // 5. Death checks
  if (fungus.age >= MAX_AGE) {
    fungus.isAlive = false;
    fungus.health = 0;
    fungus.energy = 0;
  }
  
  if (fungus.energy <= 0) {
    fungus.isAlive = false;
    fungus.health = 0;
    fungus.energy = 0;
  }
  
  fungus.updatedAt = createTimestamp();
  return { offspring, decomposed };
}

/**
 * Decompose dead matter and gain energy.
 */
function decomposeMatter(
  fungus: Entity,
  deadEntity: Entity,
  environment: Environment
): number {
  if (fungus.type !== 'fungus') return 0;
  // Fungi are more efficient in moist conditions
  const moistureMultiplier = Math.max(0.5, environment.moisture * 2);
  const efficiency = fungus.decompositionRate * moistureMultiplier;
  
  const energyGained = Math.min(ENERGY_FROM_DECOMPOSITION * efficiency, deadEntity.energy);
  fungus.energy = clampValueToRange(fungus.energy + energyGained, 0, MAX_ENERGY);
  
  // Reduce the dead entity's energy (partial decomposition)
  deadEntity.energy = Math.max(0, deadEntity.energy - energyGained);
  
  return energyGained;
}

/**
 * Attempt fungus reproduction via spores.
 */
async function attemptFungusReproduction(
  parent: Entity,
  gardenStateId: number,
  eventLogger: EventLogger
): Promise<Entity | null> {
  if (parent.type !== 'fungus') return null;
  parent.energy -= REPRODUCTION_COST;
  
  // Spores can travel further than plant seeds
  const childPosition = generatePositionNearParent(parent.position, SPORE_SPREAD_RADIUS);
  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewFungusEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
  await eventLogger.logBirth(child, parent.id, parent.name);
  await checkAndLogMutations(parent, child, eventLogger);
  
  return child;
}

/**
 * Check for and log trait mutations.
 */
async function checkAndLogMutations(
  parent: Entity,
  child: Entity,
  eventLogger: EventLogger
): Promise<void> {
  if (parent.type !== 'fungus' || child.type !== 'fungus') return;

  const traits = [
    'reproductionRate',
    'metabolismEfficiency',
    'decompositionRate',
    'perceptionRadius'
  ] as const;
  
  for (const trait of traits) {
    const oldValue = parent[trait];
    const newValue = child[trait];
    
    if (Math.abs(newValue - oldValue) / oldValue > 0.01) {
      await eventLogger.logMutation(child, trait, oldValue, newValue);
    }
  }
}

/**
 * Find the nearest dead entity (plant or herbivore).
 */
function findNearestDeadEntity(
  fungus: Entity,
  allEntities: Entity[],
  maxDistance?: number
): Entity | null {
  const deadEntities = allEntities.filter(e => 
    e.type !== 'fungus' &&
    !e.isAlive &&
    e.energy > 0
  );

  const deadEntitiesInRange = typeof maxDistance === 'number'
    ? deadEntities.filter(entity =>
      calculateDistanceBetweenEntities(fungus, entity) <= maxDistance
    )
    : deadEntities;
  
  if (deadEntitiesInRange.length === 0) {
    return null;
  }
  
  let nearest = deadEntitiesInRange[0];
  let minDistance = calculateDistanceBetweenEntities(fungus, nearest);
  
  for (let i = 1; i < deadEntitiesInRange.length; i++) {
    const distance = calculateDistanceBetweenEntities(fungus, deadEntitiesInRange[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = deadEntitiesInRange[i];
    }
  }
  
  return nearest;
}

/**
 * Check if a fungus has died.
 */
export function isFungusDead(fungus: Entity): boolean {
  return !fungus.isAlive || fungus.health <= 0 || fungus.energy <= 0;
}

/**
 * Get the cause of death for a fungus.
 */
export function getFungusCauseOfDeath(fungus: Entity): string {
  if (fungus.age >= MAX_AGE) return 'died of old age';
  if (fungus.energy <= 0) return 'starved (no dead matter found)';
  if (fungus.health <= 0) return 'withered away';
  return 'unknown cause';
}

/**
 * Calculate energy gained from decomposing a specific entity type.
 */
export function calculateDecompositionEnergy(
  fungus: Entity,
  targetEntity: Entity,
  environment: Environment
): number {
  if (fungus.type !== 'fungus') return 0;
  const baseEnergy = ENERGY_FROM_DECOMPOSITION;
  const efficiency = fungus.decompositionRate;
  const moistureMultiplier = Math.max(0.5, environment.moisture * 2);
  
  return baseEnergy * efficiency * moistureMultiplier;
}
