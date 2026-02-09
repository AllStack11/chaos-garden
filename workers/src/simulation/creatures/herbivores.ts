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

// Constants
const BASE_METABOLISM_COST = DEFAULT_SIMULATION_CONFIG.baseEnergyCostPerTick;
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.herbivoreReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 40;
const EATING_DISTANCE = 5; // pixels
const MAX_AGE = 150; // ticks
const ENERGY_FROM_PLANT = 30; // energy gained per plant eaten

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
 * Create initial herbivores for a new garden.
 */
export function createInitialHerbivorePopulation(
  count: number,
  gardenStateId: number
): Entity[] {
  const herbivores: Entity[] = [];
  
  for (let i = 0; i < count; i++) {
    const position = {
      x: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenWidth,
      y: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenHeight
    };
    herbivores.push(createNewHerbivoreEntity(position, gardenStateId));
  }
  
  return herbivores;
}

/**
 * Process a herbivore's behavior for one tick.
 * Returns offspring and IDs of plants consumed.
 */
export function processHerbivoreBehaviorDuringTick(
  herbivore: Entity,
  environment: Environment,
  allEntities: Entity[],
  eventLogger: EventLogger
): { offspring: Entity[]; consumed: string[] } {
  if (herbivore.type !== 'herbivore') return { offspring: [], consumed: [] };
  const offspring: Entity[] = [];
  const consumed: string[] = [];
  
  // 1. Find nearest plant
  const targetPlant = findNearestEntity(herbivore, allEntities, 'plant');
  
  // 2. Move toward plant if found
  if (targetPlant) {
    const distance = calculateDistanceBetweenEntities(herbivore, targetPlant);
    
    if (distance <= EATING_DISTANCE) {
      // Eat the plant
      const energyGained = eatPlant(herbivore, targetPlant);
      consumed.push(targetPlant.id);
      eventLogger.logDeath(targetPlant, `eaten by ${herbivore.species}`);
    } else {
      // Move toward plant
      moveEntityTowardTarget(herbivore, targetPlant.position);
      
      // Pay movement cost
      const movementCost = calculateMovementEnergyCost(
        herbivore.movementSpeed,
        herbivore.metabolismEfficiency
      );
      herbivore.energy -= movementCost;
    }
  } else {
    // No plants found - wander randomly
    herbivore.energy -= BASE_METABOLISM_COST * 2; // Extra cost for aimless wandering
  }
  
  // 3. Base metabolism
  const tempMultiplier = calculateTemperatureMetabolismMultiplier(environment.temperature);
  herbivore.energy -= BASE_METABOLISM_COST * tempMultiplier;
  
  // 4. Reproduction
  if (herbivore.energy >= REPRODUCTION_THRESHOLD) {
    if (willRandomEventOccur(herbivore.reproductionRate)) {
      const child = attemptHerbivoreReproduction(herbivore, herbivore.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }
  
  // 5. Aging
  herbivore.age++;
  
  // 6. Death checks
  if (herbivore.age >= MAX_AGE) {
    herbivore.health = 0;
  }
  
  if (herbivore.energy <= 0) {
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
  plant.energy = 0; // Plant dies
  plant.health = 0;
  return energyGained;
}

/**
 * Attempt herbivore reproduction.
 */
function attemptHerbivoreReproduction(
  parent: Entity,
  gardenStateId: number,
  eventLogger: EventLogger
): Entity | null {
  if (parent.type !== 'herbivore') return null;
  parent.energy -= REPRODUCTION_COST;
  
  const childPosition = generatePositionNearParent(parent.position, 20);
  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewHerbivoreEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
  eventLogger.logBirth(child, parent.id, parent.name);
  checkAndLogMutations(parent, child, eventLogger);
  
  return child;
}

/**
 * Check for and log trait mutations.
 */
function checkAndLogMutations(
  parent: Entity,
  child: Entity,
  eventLogger: EventLogger
): void {
  if (parent.type !== 'herbivore' || child.type !== 'herbivore') return;

  const traits = [
    'reproductionRate',
    'movementSpeed',
    'metabolismEfficiency',
    'perceptionRadius'
  ] as const;
  
  for (const trait of traits) {
    const oldValue = parent[trait];
    const newValue = child[trait];
    
    if (Math.abs(newValue - oldValue) / oldValue > 0.01) {
      eventLogger.logMutation(child, trait, oldValue, newValue);
    }
  }
}

/**
 * Check if a herbivore has died.
 */
export function isHerbivoreDead(herbivore: Entity): boolean {
  return herbivore.health <= 0 || herbivore.energy <= 0;
}

/**
 * Get the cause of death for a herbivore.
 */
export function getHerbivoreCauseOfDeath(herbivore: Entity): string {
  if (herbivore.age >= MAX_AGE) return 'died of old age';
  if (herbivore.energy <= 0) return 'starved (no plants found)';
  if (herbivore.health <= 0) return 'wasted away';
  return 'unknown cause';
}