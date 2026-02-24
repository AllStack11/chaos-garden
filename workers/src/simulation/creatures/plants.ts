/**
 * Plant Behavior
 * 
 * The first kingdom of life in our ecosystem—immobile organisms
 * that convert sunlight into energy through photosynthesis.
 */

import type { Entity, Environment, Traits, PlantTraits } from '@chaos-garden/shared';
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
  findAllEntitiesOfTypeWithinRadius
} from '../environment/helpers';
import { calculateMoistureGrowthMultiplier } from '../environment/creature-effects';
import { getEffectiveWeatherModifiersFromEnvironment } from '../environment/weather-state-machine';
import {
  logTraitMutationsForOffspring,
  applyStarvationHealthDecay,
  isEntityDead,
  getEntityCauseOfDeath
} from './creatureHelpers';

// Constants
const BASE_PHOTOSYNTHESIS_RATE = DEFAULT_SIMULATION_CONFIG.basePhotosynthesisRate;
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.plantReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 30;
const BASE_METABOLISM_COST = 0.2;
const MAX_AGE = 200;
const SEED_SPREAD_RADIUS = 70;
const MIN_SEED_SPREAD_DISTANCE = 18;
const LOCAL_PLANT_DENSITY_RADIUS = 42;
const MAX_LOCAL_PLANTS_FOR_REPRODUCTION = 6;
const STARVATION_HEALTH_DECAY_PER_TICK = 1;

/**
 * Create a new plant entity.
 */
export function createNewPlantEntity(
  position: { x: number; y: number },
  gardenStateId: number,
  traits?: Partial<PlantTraits>,
  parentId: string = 'origin',
  bornAtTick: number = 0,
  parentName?: string
): Entity {
  const now = createTimestamp();
  const name = generateRandomName('plant', parentName);
  const species = extractCategoryFromName(name);
  
  return {
    id: generateEntityId(),
    gardenStateId,
    bornAtTick,
    deathTick: undefined,
    isAlive: true,
    type: 'plant',
    name,
    species,
    position: { ...position },
    energy: 50,
    health: 100,
    age: 0,
    reproductionRate: traits?.reproductionRate ?? 0.05,
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.0,
    photosynthesisRate: traits?.photosynthesisRate ?? 1.0,
    lineage: parentId,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Process a plant's behavior for one tick.
 */
export async function processPlantBehaviorDuringTick(
  plant: Entity,
  environment: Environment,
  allEntities: Entity[],
  eventLogger: EventLogger
): Promise<Entity[]> {
  if (plant.type !== 'plant') return [];
  const offspring: Entity[] = [];
  
  // Photosynthesis
  const energyGained = calculatePlantEnergyGainFromPhotosynthesis(plant, environment);
  plant.energy = clampValueToRange(plant.energy + energyGained, 0, MAX_ENERGY);
  
  // Metabolism cost
  plant.energy -= BASE_METABOLISM_COST;
  
  // Growth
  if (plant.energy > 70) {
    plant.health = clampValueToRange(plant.health + 0.5, 0, 100);
  }
  
  // Reproduction
  if (
    doesPlantHaveEnoughEnergyToReproduce(plant) &&
    canPlantReproduceInLocalDensity(plant, allEntities)
  ) {
    if (willRandomEventOccur(plant.reproductionRate)) {
      const child = await attemptPlantReproduction(
        plant,
        plant.gardenStateId ?? 0,
        allEntities,
        eventLogger
      );
      if (child) {
        offspring.push(child);
      }
    }
  }
  
  // Death checks
  if (plant.age >= MAX_AGE) {
    plant.isAlive = false;
    plant.health = 0;
    plant.energy = 0;
  } else {
    applyStarvationHealthDecay(plant, STARVATION_HEALTH_DECAY_PER_TICK);
  }
  
  plant.updatedAt = createTimestamp();
  return offspring;
}

/**
 * Calculate energy gained from photosynthesis.
 */
export function calculatePlantEnergyGainFromPhotosynthesis(
  plant: Entity,
  environment: Environment
): number {
  if (plant.type !== 'plant') return 0;
  const sunlight = environment.sunlight;
  const plantEfficiency = plant.photosynthesisRate;
  const moistureMultiplier = calculateMoistureGrowthMultiplier(environment.moisture);
  
  const weatherModifiers = getEffectiveWeatherModifiersFromEnvironment(environment);
  return BASE_PHOTOSYNTHESIS_RATE * sunlight * plantEfficiency * moistureMultiplier * weatherModifiers.photosynthesisModifier;
}

/**
 * Check if a plant has enough energy to reproduce.
 */
export function doesPlantHaveEnoughEnergyToReproduce(plant: Entity): boolean {
  return plant.energy >= REPRODUCTION_THRESHOLD;
}

/**
 * Attempt plant reproduction.
 */
export async function attemptPlantReproduction(
  parent: Entity,
  gardenStateId: number,
  _allEntities: Entity[],
  eventLogger: EventLogger
): Promise<Entity | null> {
  if (parent.type !== 'plant') return null;
  const childPosition = generatePositionNearParent(
    parent.position,
    SEED_SPREAD_RADIUS,
    MIN_SEED_SPREAD_DISTANCE
  );

  parent.energy -= REPRODUCTION_COST;

  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewPlantEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
  await eventLogger.logBirth(child, parent.id, parent.name);
  await logTraitMutationsForOffspring(
    parent,
    child,
    ['reproductionRate', 'metabolismEfficiency', 'photosynthesisRate'],
    eventLogger
  );
  
  return child;
}

function canPlantReproduceInLocalDensity(
  plant: Entity,
  allEntities: Entity[]
): boolean {
  const nearbyPlants = findAllEntitiesOfTypeWithinRadius(
    plant,
    allEntities,
    'plant',
    LOCAL_PLANT_DENSITY_RADIUS
  );
  return nearbyPlants.length <= MAX_LOCAL_PLANTS_FOR_REPRODUCTION;
}

/**
 * Check if a plant has died.
 */
export function isPlantDead(plant: Entity): boolean {
  return isEntityDead(plant);
}

/**
 * Get the cause of death for a plant.
 */
export function getPlantCauseOfDeath(plant: Entity): string {
  return getEntityCauseOfDeath(plant, MAX_AGE, 'starved', 'withered away');
}
