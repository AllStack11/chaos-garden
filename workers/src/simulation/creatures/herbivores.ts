/**
 * Herbivore Behavior
 * 
 * The second kingdom of life—mobile organisms that consume plants.
 * Herbivores roam the garden, seeking out plants to eat,
 * converting plant energy into animal energy.
 */

import type { Entity, Environment, Traits, HerbivoreTraits } from '@chaos-garden/shared';
import { DEFAULT_SIMULATION_CONFIG } from '@chaos-garden/shared';
import type { EventLogger } from '../../logging/event-logger';
import {
  generateEntityId,
  generateRandomName,
  extractCategoryFromName,
  createTimestamp,
  willRandomEventOccur,
  copyTraitsWithPossibleMutations,
  generatePositionNearParent,
  clampValueToRange,
  findNearestEntity,
  moveEntityTowardTarget,
  calculateDistanceBetweenEntities,
  calculateMovementEnergyCost,
  findMostDangerousThreat,
  moveEntityAwayFromTarget,
  generateExplorationTarget
} from '../environment/helpers';
import {
  THREAT_DETECTION_RADIUS_DEFAULT,
  FLEE_SPEED_MULTIPLIER,
  FLEE_ENERGY_COST_MULTIPLIER,
  EXHAUSTION_THRESHOLD_TICKS,
  EXHAUSTION_SPEED_PENALTY,
  RECOVERY_TICKS_REQUIRED,
  PANIC_THRESHOLD_LOW_ENERGY,
  PANIC_THRESHOLD_HIGH_ENERGY,
  BOUNDARY_AVOIDANCE_THRESHOLD
} from '../environment/constants';
import { calculateTemperatureMetabolismMultiplier } from '../environment/creature-effects';
import { getEffectiveWeatherModifiersFromEnvironment } from '../environment/weather-state-machine';
import {
  logTraitMutationsForOffspring,
  applyStarvationHealthDecay,
  isEntityDead,
  getEntityCauseOfDeath
} from './creatureHelpers';

// Constants
const BASE_METABOLISM_COST = (DEFAULT_SIMULATION_CONFIG.baseEnergyCostPerTick) * 0.8 ; // Herbivores are slightly more efficient than carnivores
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 30; // cheaper so reproduction is less energy prohibitive
const EATING_DISTANCE = 5; // pixels
const MAX_AGE = 150; // ticks
const MIN_MOVEMENT_SPEED = 0.35; // ensure movement never fully stalls
const MAX_REPRODUCTIVE_AGE = 140; // extend reproductive window to soften cohort die-offs
const ENERGY_FROM_PLANT = 40; // energy gained per plant eaten
const HEALTH_RECOVERY_FROM_FEED = 5;
const MOVE_TO_PLANT_COST_MULTIPLIER = 0.68;
const SEARCH_MOVEMENT_SPEED_MULTIPLIER = 0.85;
const SEARCH_MOVEMENT_COST_MULTIPLIER = 0.5;
const STARVATION_HEALTH_DECAY_PER_TICK = 1;

// State tracking for fleeing behavior (ephemeral, not persisted)
const herbivoreFleeingState = new Map<string, {
  consecutiveFleeingTicks: number;
  isExhausted: boolean;
  recoveryTicksRemaining: number;
}>();

/**
 * Create a new herbivore entity.
 */
export function createNewHerbivoreEntity(
  position: { x: number; y: number },
  gardenStateId: number,
  traits?: Partial<HerbivoreTraits>,
  parentId: string = 'origin',
  bornAtTick: number = 0,
  parentName?: string
): Entity {
  const now = createTimestamp();
  const name = generateRandomName('herbivore', parentName);
  const species = extractCategoryFromName(name);
  
  return {
    id: generateEntityId(),
    gardenStateId,
    bornAtTick,
    deathTick: undefined,
    isAlive: true,
    type: 'herbivore',
    name,
    species,
    position: { ...position },
    energy: 60,
    health: 100,
    age: 0,
    reproductionRate: traits?.reproductionRate ?? 0.055, // slightly higher baseline reproduction chance
    movementSpeed: traits?.movementSpeed ?? 2.0,
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.0,
    perceptionRadius: traits?.perceptionRadius ?? 100,
    threatDetectionRadius: traits?.threatDetectionRadius ?? THREAT_DETECTION_RADIUS_DEFAULT,
    lineage: parentId,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Process a herbivore's behavior for one tick.
 * Returns offspring and IDs of plants consumed.
 */
export async function processHerbivoreBehaviorDuringTick(
  herbivore: Entity,
  environment: Environment,
  allEntities: Entity[],
  eventLogger: EventLogger
): Promise<{ offspring: Entity[]; consumed: string[] }> {
  if (herbivore.type !== 'herbivore') return { offspring: [], consumed: [] };
  const offspring: Entity[] = [];
  const consumed: string[] = [];
  const weatherModifiers = getEffectiveWeatherModifiersFromEnvironment(environment);
  const effectiveMovementSpeed = calculateEffectiveHerbivoreSpeed(herbivore, weatherModifiers.movementModifier);

  // Initialize or get fleeing state for this herbivore
  if (!herbivoreFleeingState.has(herbivore.id)) {
    herbivoreFleeingState.set(herbivore.id, {
      consecutiveFleeingTicks: 0,
      isExhausted: false,
      recoveryTicksRemaining: 0
    });
  }
  const fleeState = herbivoreFleeingState.get(herbivore.id)!;

  // 1. Check for threats (predators)
  const allCarnivores = allEntities.filter(e => e.type === 'carnivore');
  const nearestThreat = findMostDangerousThreat(herbivore, allCarnivores);

  // Determine panic threshold based on energy level
  const panicThreshold = herbivore.energy < 30
    ? PANIC_THRESHOLD_LOW_ENERGY
    : PANIC_THRESHOLD_HIGH_ENERGY;

  // 2. Handle threat response
  if (nearestThreat) {
    const threatDistance = calculateDistanceBetweenEntities(herbivore, nearestThreat);

    // Only flee if threat is within panic threshold
    if (threatDistance <= panicThreshold) {
      // Calculate flee speed (reduced if exhausted)
      const baseFleeSpeed = effectiveMovementSpeed * FLEE_SPEED_MULTIPLIER;
      const fleeSpeed = fleeState.isExhausted
        ? baseFleeSpeed * EXHAUSTION_SPEED_PENALTY
        : baseFleeSpeed;

      // Flee from threat with jitter for unpredictability
      moveEntityAwayFromTarget(
        herbivore,
        nearestThreat.position,
        fleeSpeed,
        DEFAULT_SIMULATION_CONFIG.gardenWidth,
        DEFAULT_SIMULATION_CONFIG.gardenHeight,
        true // add jitter
      );

      // Pay higher energy cost for fleeing
      const fleeDistance = Math.min(threatDistance, fleeSpeed);
      const fleeCost = calculateMovementEnergyCost(fleeDistance, herbivore.metabolismEfficiency);
      herbivore.energy -= fleeCost * FLEE_ENERGY_COST_MULTIPLIER;

      // Track consecutive fleeing ticks
      fleeState.consecutiveFleeingTicks++;

      // Check for exhaustion
      if (fleeState.consecutiveFleeingTicks >= EXHAUSTION_THRESHOLD_TICKS) {
        fleeState.isExhausted = true;
      }

      // Skip normal foraging when fleeing
      // (Survival takes priority over eating)
    } else {
      // Threat detected but far enough - continue normal behavior but stay alert
      fleeState.consecutiveFleeingTicks = 0;
      performForagingBehavior(herbivore, allEntities, effectiveMovementSpeed, consumed);
    }
  } else {
    // 3. No threat detected - normal foraging behavior
    fleeState.consecutiveFleeingTicks = 0;

    // Handle exhaustion recovery
    if (fleeState.isExhausted) {
      fleeState.recoveryTicksRemaining++;
      if (fleeState.recoveryTicksRemaining >= RECOVERY_TICKS_REQUIRED) {
        fleeState.isExhausted = false;
        fleeState.recoveryTicksRemaining = 0;
      }
    }

    performForagingBehavior(herbivore, allEntities, effectiveMovementSpeed, consumed);
  }

  // 4. Base metabolism
  const tempMultiplier = calculateTemperatureMetabolismMultiplier(environment.temperature);
  herbivore.energy -= BASE_METABOLISM_COST * tempMultiplier;

  // 5. Reproduction
  if (herbivore.age <= MAX_REPRODUCTIVE_AGE && herbivore.energy >= REPRODUCTION_THRESHOLD) {
    if (willRandomEventOccur(herbivore.reproductionRate * weatherModifiers.reproductionModifier)) {
      const child = await attemptHerbivoreReproduction(herbivore, herbivore.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }

  // 6. Death checks
  if (herbivore.age >= MAX_AGE) {
    herbivore.isAlive = false;
    herbivore.health = 0;
    herbivore.energy = 0;
  } else {
    applyStarvationHealthDecay(herbivore, STARVATION_HEALTH_DECAY_PER_TICK);
  }

  herbivore.updatedAt = createTimestamp();
  return { offspring, consumed };
}

/**
 * Guarantee a minimum movement speed so herbivores do not freeze from extreme mutations or weather penalties.
 */
function calculateEffectiveHerbivoreSpeed(
  herbivore: Entity,
  movementModifier: number
): number {
  if (herbivore.type !== 'herbivore') return MIN_MOVEMENT_SPEED;
  const modified = herbivore.movementSpeed * movementModifier;
  return Math.max(MIN_MOVEMENT_SPEED, modified);
}

/**
 * Perform normal foraging behavior (seek and eat plants).
 * Extracted to separate function for clarity.
 */
function performForagingBehavior(
  herbivore: Entity,
  allEntities: Entity[],
  effectiveMovementSpeed: number,
  consumed: string[]
): void {
  if (herbivore.type !== 'herbivore') return;

  // Find nearest plant in perception range
  const targetPlant = findNearestEntity(herbivore, allEntities, 'plant', herbivore.perceptionRadius);

  if (targetPlant) {
    const distance = calculateDistanceBetweenEntities(herbivore, targetPlant);

    if (distance <= EATING_DISTANCE) {
      // Eat the plant
      eatPlant(herbivore, targetPlant);
      consumed.push(targetPlant.id);
    } else {
      // Move toward plant
      moveEntityTowardTarget(herbivore, targetPlant.position, effectiveMovementSpeed);
      const movedDistance = Math.min(distance, effectiveMovementSpeed);

      // Pay movement cost
      const movementCost = calculateMovementEnergyCost(
        movedDistance,
        herbivore.metabolismEfficiency
      );
      herbivore.energy -= movementCost * MOVE_TO_PLANT_COST_MULTIPLIER;
    }
  } else {
    // No plant in perception range - explore instead of omniscient search
    const explorationTarget = generateExplorationTarget(
      herbivore,
      DEFAULT_SIMULATION_CONFIG.gardenWidth,
      DEFAULT_SIMULATION_CONFIG.gardenHeight
    );
    const searchSpeed = effectiveMovementSpeed * SEARCH_MOVEMENT_SPEED_MULTIPLIER;
    const distance = calculateDistanceBetweenEntities(
      herbivore,
      { ...herbivore, position: explorationTarget }
    );

    moveEntityTowardTarget(herbivore, explorationTarget, searchSpeed);
    const movedDistance = Math.min(distance, searchSpeed);
    const movementCost = calculateMovementEnergyCost(
      movedDistance,
      herbivore.metabolismEfficiency
    );
    herbivore.energy -= movementCost * SEARCH_MOVEMENT_COST_MULTIPLIER;
  }
}

/**
 * Eat a plant and gain energy.
 */
function eatPlant(herbivore: Entity, plant: Entity): number {
  const energyGained = Math.min(ENERGY_FROM_PLANT, plant.energy);
  herbivore.energy = clampValueToRange(herbivore.energy + energyGained, 0, MAX_ENERGY);
  if (energyGained > 0) {
    herbivore.health = clampValueToRange(herbivore.health + HEALTH_RECOVERY_FROM_FEED, 0, 100);
  }
  plant.energy = Math.max(0, plant.energy - energyGained);
  plant.isAlive = false;
  plant.health = 0;
  return energyGained;
}

/**
 * Attempt herbivore reproduction.
 */
async function attemptHerbivoreReproduction(
  parent: Entity,
  gardenStateId: number,
  eventLogger: EventLogger
): Promise<Entity | null> {
  if (parent.type !== 'herbivore') return null;
  parent.energy -= REPRODUCTION_COST;
  
  const childPosition = generatePositionNearParent(parent.position, 20);
  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewHerbivoreEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
  await eventLogger.logBirth(child, parent.id, parent.name);
  await logTraitMutationsForOffspring(
    parent,
    child,
    ['reproductionRate', 'movementSpeed', 'metabolismEfficiency', 'perceptionRadius', 'threatDetectionRadius'],
    eventLogger
  );
  
  return child;
}

/**
 * Check if a herbivore has died.
 */
export function isHerbivoreDead(herbivore: Entity): boolean {
  return isEntityDead(herbivore);
}

/**
 * Get the cause of death for a herbivore.
 */
export function getHerbivoreCauseOfDeath(herbivore: Entity): string {
  return getEntityCauseOfDeath(
    herbivore,
    MAX_AGE,
    'starved (no plants found)',
    'wasted away'
  );
}
