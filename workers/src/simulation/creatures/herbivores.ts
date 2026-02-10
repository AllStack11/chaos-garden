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
  calculateMovementEnergyCost
} from '../environment/helpers';
import { calculateTemperatureMetabolismMultiplier } from '../environment/creature-effects';
import { getEffectiveWeatherModifiersFromEnvironment } from '../environment/weather-state-machine';
import {
  logTraitMutationsForOffspring,
  isEntityDead,
  getEntityCauseOfDeath
} from './creatureHelpers';

// Constants
const BASE_METABOLISM_COST = (DEFAULT_SIMULATION_CONFIG.baseEnergyCostPerTick) * 0.9 ; // Herbivores are slightly more efficient than carnivores
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 40;
const EATING_DISTANCE = 5; // pixels
const MAX_AGE = 150; // ticks
const MAX_REPRODUCTIVE_AGE = 110; // older herbivores can no longer reproduce
const ENERGY_FROM_PLANT = 30; // energy gained per plant eaten
const SEARCH_MOVEMENT_SPEED_MULTIPLIER = 0.85;
const SEARCH_MOVEMENT_COST_MULTIPLIER = 0.85;

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
    reproductionRate: traits?.reproductionRate ?? 0.03,
    movementSpeed: traits?.movementSpeed ?? 2.0,
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.0,
    perceptionRadius: traits?.perceptionRadius ?? 100,
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
  const effectiveMovementSpeed = herbivore.movementSpeed * weatherModifiers.movementModifier;

  // 1. Find nearest plant in perception range.
  const targetPlant = findNearestEntity(herbivore, allEntities, 'plant', herbivore.perceptionRadius);

  // 2. If a plant is in range, move/eat normally.
  if (targetPlant) {
    const distance = calculateDistanceBetweenEntities(herbivore, targetPlant);

    if (distance <= EATING_DISTANCE) {
      // Eat the plant
      const energyGained = eatPlant(herbivore, targetPlant);
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
      herbivore.energy -= movementCost;
    }
  } else {
    // 3. Otherwise, move toward the nearest plant anywhere to prevent edge starvation.
    const targetPlantAnywhere = findNearestEntity(herbivore, allEntities, 'plant');
    if (targetPlantAnywhere) {
      const searchSpeed = effectiveMovementSpeed * SEARCH_MOVEMENT_SPEED_MULTIPLIER;
      const distance = calculateDistanceBetweenEntities(herbivore, targetPlantAnywhere);

      moveEntityTowardTarget(herbivore, targetPlantAnywhere.position, searchSpeed);
      const movedDistance = Math.min(distance, searchSpeed);
      const movementCost = calculateMovementEnergyCost(
        movedDistance,
        herbivore.metabolismEfficiency
      );
      herbivore.energy -= movementCost * SEARCH_MOVEMENT_COST_MULTIPLIER;
    } else {
      // No plants exist at all.
      herbivore.energy -= BASE_METABOLISM_COST * 0.25;
    }
  }
  
  // 3. Base metabolism
  const tempMultiplier = calculateTemperatureMetabolismMultiplier(environment.temperature);
  herbivore.energy -= BASE_METABOLISM_COST * tempMultiplier;
  
  // 4. Reproduction
  if (herbivore.age <= MAX_REPRODUCTIVE_AGE && herbivore.energy >= REPRODUCTION_THRESHOLD) {
    if (willRandomEventOccur(herbivore.reproductionRate * weatherModifiers.reproductionModifier)) {
      const child = await attemptHerbivoreReproduction(herbivore, herbivore.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }
  
  // 5. Death checks
  if (herbivore.age >= MAX_AGE) {
    herbivore.isAlive = false;
    herbivore.health = 0;
  }
  
  if (herbivore.energy <= 0) {
    herbivore.isAlive = false;
    herbivore.health = 0;
    herbivore.energy = 0;
  }
  
  herbivore.updatedAt = createTimestamp();
  return { offspring, consumed };
}

/**
 * Eat a plant and gain energy.
 */
function eatPlant(herbivore: Entity, plant: Entity): number {
  const energyGained = Math.min(ENERGY_FROM_PLANT, plant.energy);
  herbivore.energy = clampValueToRange(herbivore.energy + energyGained, 0, MAX_ENERGY);
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
    ['reproductionRate', 'movementSpeed', 'metabolismEfficiency', 'perceptionRadius'],
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
