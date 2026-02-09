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
  clampValueToRange
} from '../environment/helpers';
import { calculateSunlightForTick } from '../environment/sunlight-calculator';
import { calculateMoistureGrowthMultiplier } from '../environment/creature-effects';

// Constants
const BASE_PHOTOSYNTHESIS_RATE = DEFAULT_SIMULATION_CONFIG.basePhotosynthesisRate;
const REPRODUCTION_THRESHOLD = DEFAULT_SIMULATION_CONFIG.plantReproductionThreshold;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 30;
const BASE_METABOLISM_COST = 0.3;
const MAX_AGE = 200;
const SEED_SPREAD_RADIUS = 50; // Increased from 30 for more spread out offspring

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
 * Create initial plants for a new garden.
 * Uses a minimum distance algorithm to ensure plants are well-distributed.
 */
export function createInitialPlantPopulation(
  count: number,
  gardenStateId: number
): Entity[] {
  const plants: Entity[] = [];
  const minDistance = 40; // Minimum distance between plants
  const maxAttempts = 30; // Max attempts to find a valid position

  for (let i = 0; i < count; i++) {
    let position: { x: number; y: number } | null = null;
    let attempts = 0;

    // Try to find a position that's far enough from existing plants
    while (attempts < maxAttempts) {
      const candidatePosition = {
        x: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenWidth,
        y: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenHeight
      };

      // Check if this position is far enough from all existing plants
      let isValidPosition = true;
      for (const existingPlant of plants) {
        const dx = candidatePosition.x - existingPlant.position.x;
        const dy = candidatePosition.y - existingPlant.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          isValidPosition = false;
          break;
        }
      }

      if (isValidPosition) {
        position = candidatePosition;
        break;
      }

      attempts++;
    }

    // If we couldn't find a valid position after max attempts, use a random one
    if (!position) {
      position = {
        x: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenWidth,
        y: Math.random() * DEFAULT_SIMULATION_CONFIG.gardenHeight
      };
    }

    plants.push(createNewPlantEntity(position, gardenStateId));
  }

  return plants;
}

/**
 * Process a plant's behavior for one tick.
 */
export async function processPlantBehaviorDuringTick(
  plant: Entity,
  environment: Environment,
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
  if (doesPlantHaveEnoughEnergyToReproduce(plant)) {
    if (willRandomEventOccur(plant.reproductionRate)) {
      const child = await attemptPlantReproduction(plant, plant.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }
  
  // Death checks
  if (plant.age >= MAX_AGE) {
    plant.isAlive = false;
    plant.health = 0;
  }
  
  if (plant.energy <= 0) {
    plant.isAlive = false;
    plant.health = 0;
    plant.energy = 0;
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
  const sunlight = calculateSunlightForTick(environment.tick);
  const plantEfficiency = plant.photosynthesisRate;
  const moistureMultiplier = calculateMoistureGrowthMultiplier(environment.moisture);
  
  return BASE_PHOTOSYNTHESIS_RATE * sunlight * plantEfficiency * moistureMultiplier;
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
  eventLogger: EventLogger
): Promise<Entity | null> {
  if (parent.type !== 'plant') return null;
  parent.energy -= REPRODUCTION_COST;
  
  const childPosition = generatePositionNearParent(parent.position, SEED_SPREAD_RADIUS);
  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewPlantEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
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
  if (parent.type !== 'plant' || child.type !== 'plant') return;

  const traits = [
    'reproductionRate',
    'metabolismEfficiency',
    'photosynthesisRate'
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
 * Check if a plant has died.
 */
export function isPlantDead(plant: Entity): boolean {
  return !plant.isAlive || plant.health <= 0 || plant.energy <= 0;
}

/**
 * Get the cause of death for a plant.
 */
export function getPlantCauseOfDeath(plant: Entity): string {
  if (plant.age >= MAX_AGE) return 'died of old age';
  if (plant.energy <= 0) return 'starved';
  if (plant.health <= 0) return 'withered away';
  return 'unknown cause';
}
