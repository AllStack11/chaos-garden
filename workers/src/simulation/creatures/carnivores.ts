/**
 * Carnivore Behavior
 * 
 * The third kingdom of mobile life—predators that hunt herbivores.
 * Carnivores are the apex predators of the garden, maintaining
 * ecological balance by preventing herbivore overpopulation.
 */

import type { Entity, Environment, Traits, CarnivoreTraits } from '@chaos-garden/shared';
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
  findCompetingCarnivores,
  generateExplorationTarget
} from '../environment/helpers';
import {
  AMBUSH_RADIUS,
  PACK_COORDINATION_RADIUS,
  STALKING_SPEED_MULTIPLIER,
  STALKING_ENERGY_COST_MULTIPLIER,
  HUNT_ABANDONMENT_TICKS,
  RESTING_ENERGY_THRESHOLD,
  RESTING_SPEED_MULTIPLIER,
  RESTING_METABOLISM_MULTIPLIER
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
const BASE_METABOLISM_COST = (DEFAULT_SIMULATION_CONFIG.baseEnergyCostPerTick); 
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.carnivoreReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 40;
const HUNTING_DISTANCE = 10; // pixels (slightly larger than herbivore eating)
const MAX_AGE = 320; // ticks (longer lifespan helps preserve apex lineages in long-horizon simulations)
const MAX_REPRODUCTIVE_AGE = 130; // older carnivores can no longer reproduce
const ENERGY_FROM_PREY = 50; // energy gained per herbivore eaten
const HEALTH_RECOVERY_FROM_FEED = 5;
const MIN_MOVEMENT_SPEED = 0.4; // ensure movement never stalls from bad mutations
const PREY_HEALTH_TO_ENERGY_RATIO = 0.2;
const MAX_CARCASS_ENERGY = 100;
const SEARCH_MOVEMENT_SPEED_MULTIPLIER = 0.85;
const HUNT_MOVEMENT_COST_MULTIPLIER = 0.65;
const SEARCH_MOVEMENT_COST_MULTIPLIER = 0.65;
const STARVATION_HEALTH_DECAY_PER_TICK = 1;

// State tracking for hunting behavior (ephemeral, not persisted)
const carnivoreHuntingState = new Map<string, {
  currentTargetId: string | null;
  ticksSpentHunting: number;
}>();

/**
 * Create a new carnivore entity.
 */
export function createNewCarnivoreEntity(
  position: { x: number; y: number },
  gardenStateId: number,
  traits?: Partial<CarnivoreTraits>,
  parentId: string = 'origin',
  bornAtTick: number = 0,
  parentName?: string
): Entity {
  const now = createTimestamp();
  const name = generateRandomName('carnivore', parentName);
  const species = extractCategoryFromName(name);
  
  return {
    id: generateEntityId(),
    gardenStateId,
    bornAtTick,
    deathTick: undefined,
    isAlive: true,
    type: 'carnivore',
    name,
    species,
    position: { ...position },
    energy: 50,
    health: 100,
    age: 0,
    reproductionRate: traits?.reproductionRate ?? 0.015, // Lower reproduction than herbivores
    movementSpeed: traits?.movementSpeed ?? 4.6, // Carnivores should move the most
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.1, // Higher metabolism cost
    perceptionRadius: traits?.perceptionRadius ?? 160, // Better vision for hunting
    lineage: parentId,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Process a carnivore's behavior for one tick.
 * Returns offspring and IDs of prey consumed.
 */
export async function processCarnivoreBehaviorDuringTick(
  carnivore: Entity,
  environment: Environment,
  allEntities: Entity[],
  eventLogger: EventLogger
): Promise<{ offspring: Entity[]; consumed: string[] }> {
  if (carnivore.type !== 'carnivore') return { offspring: [], consumed: [] };
  const offspring: Entity[] = [];
  const consumed: string[] = [];
  const weatherModifiers = getEffectiveWeatherModifiersFromEnvironment(environment);
  const effectiveMovementSpeed = calculateEffectiveCarnivoreSpeed(carnivore, weatherModifiers.movementModifier);

  // Initialize or get hunting state for this carnivore
  if (!carnivoreHuntingState.has(carnivore.id)) {
    carnivoreHuntingState.set(carnivore.id, {
      currentTargetId: null,
      ticksSpentHunting: 0
    });
  }
  const huntState = carnivoreHuntingState.get(carnivore.id)!;

  // 1. Check if high energy and should rest (conserve energy)
  if (carnivore.energy >= RESTING_ENERGY_THRESHOLD) {
    // Check for immediate prey within ambush range
    const immediatePreyInAmbushRange = findNearestHuntableHerbivore(
      carnivore,
      allEntities,
      AMBUSH_RADIUS
    );

    if (!immediatePreyInAmbushRange) {
      // Rest and explore slowly
      const restingTarget = generateExplorationTarget(
        carnivore,
        DEFAULT_SIMULATION_CONFIG.gardenWidth,
        DEFAULT_SIMULATION_CONFIG.gardenHeight
      );
      moveEntityTowardTarget(carnivore, restingTarget, effectiveMovementSpeed * RESTING_SPEED_MULTIPLIER);
      carnivore.energy -= BASE_METABOLISM_COST * RESTING_METABOLISM_MULTIPLIER;

      // Skip hunting behavior and continue to reproduction/death checks
      huntState.currentTargetId = null;
      huntState.ticksSpentHunting = 0;
    } else {
      // Immediate prey - engage hunt
      performHuntingBehavior(
        carnivore,
        allEntities,
        effectiveMovementSpeed,
        huntState,
        consumed
      );
    }
  } else {
    // 2. Normal hunting behavior
    performHuntingBehavior(
      carnivore,
      allEntities,
      effectiveMovementSpeed,
      huntState,
      consumed
    );
  }

  // 3. Base metabolism
  const tempMultiplier = calculateTemperatureMetabolismMultiplier(environment.temperature);
  carnivore.energy -= BASE_METABOLISM_COST * tempMultiplier;

  // 4. Reproduction
  if (carnivore.age <= MAX_REPRODUCTIVE_AGE && carnivore.energy >= REPRODUCTION_THRESHOLD) {
    if (willRandomEventOccur(carnivore.reproductionRate * weatherModifiers.reproductionModifier)) {
      const child = await attemptCarnivoreReproduction(carnivore, carnivore.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }

  // 5. Death checks
  if (carnivore.age >= MAX_AGE) {
    carnivore.isAlive = false;
    carnivore.health = 0;
    carnivore.energy = 0;
  } else {
    applyStarvationHealthDecay(carnivore, STARVATION_HEALTH_DECAY_PER_TICK);
  }

  carnivore.updatedAt = createTimestamp();
  return { offspring, consumed };
}

/**
 * Guarantee a minimum movement speed so carnivores do not stall when mutations or weather reduce speed.
 */
function calculateEffectiveCarnivoreSpeed(
  carnivore: Entity,
  movementModifier: number
): number {
  if (carnivore.type !== 'carnivore') return MIN_MOVEMENT_SPEED;
  const modified = carnivore.movementSpeed * movementModifier;
  return Math.max(MIN_MOVEMENT_SPEED, modified);
}

/**
 * Perform hunting behavior with ambush tactics and pack coordination.
 * Extracted to separate function for clarity.
 */
function performHuntingBehavior(
  carnivore: Entity,
  allEntities: Entity[],
  effectiveMovementSpeed: number,
  huntState: { currentTargetId: string | null; ticksSpentHunting: number },
  consumed: string[]
): void {
  if (carnivore.type !== 'carnivore') return;

  // Find prey in perception range
  const targetPreyInPerception = findNearestHuntableHerbivore(
    carnivore,
    allEntities,
    carnivore.perceptionRadius
  );

  if (targetPreyInPerception) {
    const distance = calculateDistanceBetweenEntities(carnivore, targetPreyInPerception);

    // Check for pack coordination (avoid competing carnivores)
    const allCarnivores = allEntities.filter(e => e.type === 'carnivore');
    const competingCarnivores = findCompetingCarnivores(
      carnivore,
      allCarnivores,
      targetPreyInPerception,
      PACK_COORDINATION_RADIUS
    );

    // If too much competition, look for alternative prey
    if (competingCarnivores.length >= 2) {
      // Find second-best target
      const allPreyInRange = allEntities.filter(e =>
        e.type === 'herbivore' &&
        e.id !== targetPreyInPerception.id &&
        e.isAlive &&
        e.health > 0 &&
        calculateDistanceBetweenEntities(carnivore, e) <= carnivore.perceptionRadius
      );

      if (allPreyInRange.length > 0) {
        // Switch to alternative prey
        const alternativePrey = allPreyInRange[0];
        engageHunt(carnivore, alternativePrey, effectiveMovementSpeed, huntState, consumed);
        return;
      }
    }

    // Check for hunt abandonment
    if (huntState.currentTargetId === targetPreyInPerception.id) {
      huntState.ticksSpentHunting++;

      if (huntState.ticksSpentHunting >= HUNT_ABANDONMENT_TICKS) {
        // Abandon hunt - too many ticks chasing this prey
        huntState.currentTargetId = null;
        huntState.ticksSpentHunting = 0;

        // Enter exploration mode
        const explorationTarget = generateExplorationTarget(
          carnivore,
          DEFAULT_SIMULATION_CONFIG.gardenWidth,
          DEFAULT_SIMULATION_CONFIG.gardenHeight
        );
        moveEntityTowardTarget(carnivore, explorationTarget, effectiveMovementSpeed * RESTING_SPEED_MULTIPLIER);
        carnivore.energy -= BASE_METABOLISM_COST * RESTING_METABOLISM_MULTIPLIER;
        return;
      }
    } else {
      // New target
      huntState.currentTargetId = targetPreyInPerception.id;
      huntState.ticksSpentHunting = 1;
    }

    // Engage hunt
    engageHunt(carnivore, targetPreyInPerception, effectiveMovementSpeed, huntState, consumed);
  } else {
    // No prey in perception - explore instead of omniscient search
    huntState.currentTargetId = null;
    huntState.ticksSpentHunting = 0;

    const explorationTarget = generateExplorationTarget(
      carnivore,
      DEFAULT_SIMULATION_CONFIG.gardenWidth,
      DEFAULT_SIMULATION_CONFIG.gardenHeight
    );
    const searchSpeed = effectiveMovementSpeed * SEARCH_MOVEMENT_SPEED_MULTIPLIER;
    const distance = calculateDistanceBetweenEntities(
      carnivore,
      { ...carnivore, position: explorationTarget }
    );

    moveEntityTowardTarget(carnivore, explorationTarget, searchSpeed);
    const movedDistance = Math.min(distance, searchSpeed);
    const movementCost = calculateMovementEnergyCost(movedDistance, carnivore.metabolismEfficiency);
    carnivore.energy -= movementCost * SEARCH_MOVEMENT_COST_MULTIPLIER;
  }
}

/**
 * Locate the nearest herbivore that is still alive.
 * Carnivores should hunt starving prey too, so we ignore prey energy.
 */
function findNearestHuntableHerbivore(
  carnivore: Entity,
  allEntities: Entity[],
  maxDistance?: number
): Entity | null {
  const preyCandidates = allEntities.filter(entity =>
    entity.type === 'herbivore' &&
    entity.isAlive &&
    entity.health > 0
  );

  const preyInRange = typeof maxDistance === 'number'
    ? preyCandidates.filter(prey =>
      calculateDistanceBetweenEntities(carnivore, prey) <= maxDistance
    )
    : preyCandidates;

  if (preyInRange.length === 0) {
    return null;
  }

  let nearest = preyInRange[0];
  let minDistance = calculateDistanceBetweenEntities(carnivore, nearest);

  for (let i = 1; i < preyInRange.length; i++) {
    const distance = calculateDistanceBetweenEntities(carnivore, preyInRange[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = preyInRange[i];
    }
  }

  return nearest;
}

/**
 * Engage in hunting a specific prey with ambush tactics.
 */
function engageHunt(
  carnivore: Entity,
  prey: Entity,
  effectiveMovementSpeed: number,
  huntState: { currentTargetId: string | null; ticksSpentHunting: number },
  consumed: string[]
): void {
  if (carnivore.type !== 'carnivore') return;

  const distance = calculateDistanceBetweenEntities(carnivore, prey);

  if (distance <= HUNTING_DISTANCE) {
    // Kill prey
    huntHerbivore(carnivore, prey);
    consumed.push(prey.id);
    huntState.currentTargetId = null;
    huntState.ticksSpentHunting = 0;
  } else if (distance <= AMBUSH_RADIUS) {
    // Ambush range - stalk slowly for energy efficiency
    const stalkingSpeed = effectiveMovementSpeed * STALKING_SPEED_MULTIPLIER;
    moveEntityTowardTarget(carnivore, prey.position, stalkingSpeed);
    const movedDistance = Math.min(distance, stalkingSpeed);
    const movementCost = calculateMovementEnergyCost(movedDistance, carnivore.metabolismEfficiency);
    carnivore.energy -= movementCost * STALKING_ENERGY_COST_MULTIPLIER;
  } else {
    // Active chase
    moveEntityTowardTarget(carnivore, prey.position, effectiveMovementSpeed);
    const movedDistance = Math.min(distance, effectiveMovementSpeed);
    const movementCost = calculateMovementEnergyCost(movedDistance, carnivore.metabolismEfficiency);
    carnivore.energy -= movementCost * HUNT_MOVEMENT_COST_MULTIPLIER;
  }
}

/**
 * Hunt an herbivore and gain energy.
 */
function huntHerbivore(carnivore: Entity, prey: Entity): number {
  const availablePreyEnergy = prey.energy + (prey.health * PREY_HEALTH_TO_ENERGY_RATIO);
  const energyGained = Math.min(ENERGY_FROM_PREY, availablePreyEnergy);
  const remainingCarcassEnergy = clampValueToRange(availablePreyEnergy - energyGained, 0, MAX_CARCASS_ENERGY);

  carnivore.energy = clampValueToRange(carnivore.energy + energyGained, 0, MAX_ENERGY);
  if (energyGained > 0) {
    carnivore.health = clampValueToRange(carnivore.health + HEALTH_RECOVERY_FROM_FEED, 0, 100);
  }
  prey.energy = remainingCarcassEnergy;
  prey.isAlive = false;
  prey.health = 0;

  return energyGained;
}

/**
 * Attempt carnivore reproduction.
 */
async function attemptCarnivoreReproduction(
  parent: Entity,
  gardenStateId: number,
  eventLogger: EventLogger
): Promise<Entity | null> {
  if (parent.type !== 'carnivore') return null;
  parent.energy -= REPRODUCTION_COST;
  
  const childPosition = generatePositionNearParent(parent.position, 30);
  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewCarnivoreEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
  await eventLogger.logBirth(child, parent.id, parent.name);
  await logTraitMutationsForOffspring(
    parent,
    child,
    ['reproductionRate', 'movementSpeed', 'metabolismEfficiency', 'perceptionRadius'],
    eventLogger
  );
  
  return child;
}

/**
 * Check if a carnivore has died.
 */
export function isCarnivoreDead(carnivore: Entity): boolean {
  return isEntityDead(carnivore);
}

/**
 * Get the cause of death for a carnivore.
 */
export function getCarnivoreCauseOfDeath(carnivore: Entity): string {
  return getEntityCauseOfDeath(
    carnivore,
    MAX_AGE,
    'starved (prey escaped)',
    'wasted away'
  );
}
