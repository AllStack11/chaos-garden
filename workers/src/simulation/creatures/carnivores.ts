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
  calculateMovementEnergyCost
} from '../environment/helpers';
import { calculateTemperatureMetabolismMultiplier } from '../environment/creature-effects';
import { getEffectiveWeatherModifiersFromEnvironment } from '../environment/weather-state-machine';
import {
  createInitialPopulationWithRandomPositions,
  logTraitMutationsForOffspring,
  isEntityDead,
  getEntityCauseOfDeath
} from './creatureHelpers';

// Constants
const BASE_METABOLISM_COST = (DEFAULT_SIMULATION_CONFIG.baseEnergyCostPerTick) * 1.1; // Carnivores have higher metabolism
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.carnivoreReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 50;
const HUNTING_DISTANCE = 8; // pixels (slightly larger than herbivore eating)
const MAX_AGE = 200; // ticks (carnivores live longer but are fewer)
const MAX_REPRODUCTIVE_AGE = 150; // older carnivores can no longer reproduce
const ENERGY_FROM_PREY = 50; // energy gained per herbivore eaten
const PREY_HEALTH_TO_ENERGY_RATIO = 0.2;
const MAX_CARCASS_ENERGY = 100;
const SEARCH_MOVEMENT_SPEED_MULTIPLIER = 0.85;
const SEARCH_MOVEMENT_COST_MULTIPLIER = 0.85;

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
    reproductionRate: traits?.reproductionRate ?? 0.02, // Lower reproduction than herbivores
    movementSpeed: traits?.movementSpeed ?? 4.6, // Carnivores should move the most
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.1, // Higher metabolism cost
    perceptionRadius: traits?.perceptionRadius ?? 175, // Better vision for hunting
    lineage: parentId,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Create initial carnivores for a new garden.
 */
export function createInitialCarnivorePopulation(
  count: number,
  gardenStateId: number
): Entity[] {
  return createInitialPopulationWithRandomPositions(count, gardenStateId, createNewCarnivoreEntity);
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
  const effectiveMovementSpeed = carnivore.movementSpeed * weatherModifiers.movementModifier;

  // 1. Find nearest prey in perception range.
  const targetPreyInPerception = findNearestEntity(
    carnivore,
    allEntities,
    'herbivore',
    carnivore.perceptionRadius
  );

  // 2. If prey is in range, engage hunt behavior.
  if (targetPreyInPerception) {
    const distance = calculateDistanceBetweenEntities(carnivore, targetPreyInPerception);

    if (distance <= HUNTING_DISTANCE) {
      const energyGained = huntHerbivore(carnivore, targetPreyInPerception);
      consumed.push(targetPreyInPerception.id);
    } else {
      moveEntityTowardTarget(carnivore, targetPreyInPerception.position, effectiveMovementSpeed);
      const movedDistance = Math.min(distance, effectiveMovementSpeed);
      const movementCost = calculateMovementEnergyCost(movedDistance, carnivore.metabolismEfficiency);
      carnivore.energy -= movementCost * 1.2; // Hunting is exhausting
    }
  } else {
    // 3. Otherwise, move toward globally nearest prey to prevent edge starvation.
    const targetPreyAnywhere = findNearestEntity(carnivore, allEntities, 'herbivore');
    if (targetPreyAnywhere) {
      const searchSpeed = effectiveMovementSpeed * SEARCH_MOVEMENT_SPEED_MULTIPLIER;
      const distance = calculateDistanceBetweenEntities(carnivore, targetPreyAnywhere);

      moveEntityTowardTarget(carnivore, targetPreyAnywhere.position, searchSpeed);
      const movedDistance = Math.min(distance, searchSpeed);
      const movementCost = calculateMovementEnergyCost(movedDistance, carnivore.metabolismEfficiency);
      carnivore.energy -= movementCost * SEARCH_MOVEMENT_COST_MULTIPLIER;
    } else {
      // No prey exists at all.
      carnivore.energy -= BASE_METABOLISM_COST * 0.25;
    }
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
  }
  
  if (carnivore.energy <= 0) {
    carnivore.isAlive = false;
    carnivore.health = 0;
    carnivore.energy = 0;
  }
  
  carnivore.updatedAt = createTimestamp();
  return { offspring, consumed };
}

/**
 * Hunt an herbivore and gain energy.
 */
function huntHerbivore(carnivore: Entity, prey: Entity): number {
  const availablePreyEnergy = prey.energy + (prey.health * PREY_HEALTH_TO_ENERGY_RATIO);
  const energyGained = Math.min(ENERGY_FROM_PREY, availablePreyEnergy);
  const remainingCarcassEnergy = clampValueToRange(availablePreyEnergy - energyGained, 0, MAX_CARCASS_ENERGY);

  carnivore.energy = clampValueToRange(carnivore.energy + energyGained, 0, MAX_ENERGY);
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
