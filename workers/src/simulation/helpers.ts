/**
 * Simulation Helpers
 * 
 * Pure utility functions for the simulation engine.
 * These are the mathematical and spatial primitives—
 * the physics that governs our digital ecosystem.
 * 
 * All functions are pure (no side effects) and deterministic
 * (same inputs always produce same outputs), making them
 * reliable building blocks for emergent behavior.
 */

import type { Position, Entity, Traits, SimulationConfig, PopulationSummary } from '@chaos-garden/shared';
import { DEFAULT_SIMULATION_CONFIG } from '@chaos-garden/shared';

// Re-export config for convenience
export { DEFAULT_SIMULATION_CONFIG };

/**
 * Calculate Euclidean distance between two positions.
 * The straight-line distance, as the crow flies.
 * 
 * @param firstPosition - Starting position
 * @param secondPosition - Ending position
 * @returns Distance in pixels
 */
export function calculateDistanceBetweenPositions(
  firstPosition: Position,
  secondPosition: Position
): number {
  const deltaX = firstPosition.x - secondPosition.x;
  const deltaY = firstPosition.y - secondPosition.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * Calculate Euclidean distance between two entities.
 * 
 * @param firstEntity - First entity
 * @param secondEntity - Second entity
 * @returns Distance in pixels
 */
export function calculateDistanceBetweenEntities(
  firstEntity: Entity,
  secondEntity: Entity
): number {
  return calculateDistanceBetweenPositions(firstEntity.position, secondEntity.position);
}

/**
 * Generate a random position within the garden boundaries.
 * Like scattering seeds to the wind.
 * 
 * @param width - Garden width (default: 800)
 * @param height - Garden height (default: 600)
 * @returns Random position within bounds
 */
export function generateRandomPositionInGarden(
  width: number = DEFAULT_SIMULATION_CONFIG.gardenWidth,
  height: number = DEFAULT_SIMULATION_CONFIG.gardenHeight
): Position {
  return {
    x: Math.random() * width,
    y: Math.random() * height
  };
}

/**
 * Generate a position near a parent (for offspring).
 * Children appear near their parents, like seeds falling nearby.
 * 
 * @param parentPosition - Parent's position
 * @param spreadRadius - Maximum distance from parent (default: 50)
 * @param width - Garden width
 * @param height - Garden height
 * @returns Position near parent, clamped to garden bounds
 */
export function generatePositionNearParent(
  parentPosition: Position,
  spreadRadius: number = 50,
  width: number = DEFAULT_SIMULATION_CONFIG.gardenWidth,
  height: number = DEFAULT_SIMULATION_CONFIG.gardenHeight
): Position {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * spreadRadius;
  
  let x = parentPosition.x + Math.cos(angle) * distance;
  let y = parentPosition.y + Math.sin(angle) * distance;
  
  // Clamp to garden bounds
  x = Math.max(0, Math.min(width, x));
  y = Math.max(0, Math.min(height, y));
  
  return { x, y };
}

/**
 * Generate a random UUID v4.
 * Unique identifiers for every entity in the garden.
 * 
 * @returns UUID string
 */
export function generateEntityId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

/**
 * Determine if a random event should occur based on probability.
 * The hand of fate, governed by chance.
 * 
 * @param probability - Chance of occurrence (0-1)
 * @returns True if event should occur
 */
export function willRandomEventOccur(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Generate a random value within a range.
 * 
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random value between min and max
 */
export function generateRandomValueInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Clamp a value to a range.
 * Ensures values stay within valid bounds.
 * 
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
export function clampValueToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply a random mutation to a trait value.
 * Evolution introduces variation—traits shift by ±mutationRange.
 * 
 * @param originalValue - Starting trait value
 * @param mutationRange - Maximum percent change (default: 0.2 = ±20%)
 * @returns Mutated value
 */
export function applyRandomMutationToTrait(
  originalValue: number,
  mutationRange: number = DEFAULT_SIMULATION_CONFIG.mutationRange
): number {
  // Generate random multiplier: (1 - range) to (1 + range)
  const randomMultiplier = 1 - mutationRange + (Math.random() * mutationRange * 2);
  return originalValue * randomMultiplier;
}

/**
 * Copy traits with potential mutations.
 * Creates a new traits object, possibly modified from parent.
 * 
 * @param parentTraits - Parent's genetic traits
 * @param mutationProbability - Chance of each trait mutating (default: 0.1)
 * @returns New traits object (possibly mutated)
 */
export function copyTraitsWithPossibleMutations(
  parentTraits: Traits,
  mutationProbability: number = DEFAULT_SIMULATION_CONFIG.mutationProbability
): Traits {
  const mutate = (value: number) => 
    willRandomEventOccur(mutationProbability) 
      ? applyRandomMutationToTrait(value) 
      : value;
  
  return {
    reproductionRate: clampValueToRange(mutate(parentTraits.reproductionRate), 0, 1),
    movementSpeed: Math.max(0, mutate(parentTraits.movementSpeed)),
    metabolismEfficiency: clampValueToRange(mutate(parentTraits.metabolismEfficiency), 0.5, 1.5),
    photosynthesisRate: clampValueToRange(mutate(parentTraits.photosynthesisRate), 0.5, 1.5),
    perceptionRadius: Math.max(0, mutate(parentTraits.perceptionRadius))
  };
}

/**
 * Move an entity toward a target position.
 * Updates entity position in place (side effect - use carefully).
 * 
 * @param entity - Entity to move (mutated)
 * @param target - Target position
 * @param speed - Movement speed (uses entity traits if not provided)
 */
export function moveEntityTowardTarget(
  entity: Entity,
  target: Position,
  speed?: number
): void {
  const moveSpeed = speed ?? entity.traits.movementSpeed;
  
  if (moveSpeed <= 0) {
    return; // Cannot move
  }
  
  const deltaX = target.x - entity.position.x;
  const deltaY = target.y - entity.position.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  if (distance === 0) {
    return; // Already at target
  }
  
  if (distance <= moveSpeed) {
    // Can reach target this tick
    entity.position.x = target.x;
    entity.position.y = target.y;
  } else {
    // Move toward target at speed
    entity.position.x += (deltaX / distance) * moveSpeed;
    entity.position.y += (deltaY / distance) * moveSpeed;
  }
}

/**
 * Find the nearest entity of a specific type.
 * Returns null if no entities of that type exist.
 * 
 * @param source - Entity searching
 * @param candidates - Array of entities to search
 * @param typeFilter - Optional type to filter by
 * @returns Nearest entity or null
 */
export function findNearestEntity(
  source: Entity,
  candidates: Entity[],
  typeFilter?: Entity['type']
): Entity | null {
  const validTargets = typeFilter 
    ? candidates.filter(e => e.type === typeFilter && e.id !== source.id)
    : candidates.filter(e => e.id !== source.id);
  
  if (validTargets.length === 0) {
    return null;
  }
  
  let nearest = validTargets[0];
  let minDistance = calculateDistanceBetweenEntities(source, nearest);
  
  for (let i = 1; i < validTargets.length; i++) {
    const distance = calculateDistanceBetweenEntities(source, validTargets[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = validTargets[i];
    }
  }
  
  return nearest;
}

/**
 * Check if an entity is within perception radius of another.
 * 
 * @param observer - Entity doing the perceiving
 * @param target - Entity being perceived
 * @returns True if target is within perception radius
 */
export function isEntityWithinPerceptionRadius(
  observer: Entity,
  target: Entity
): boolean {
  const distance = calculateDistanceBetweenEntities(observer, target);
  return distance <= observer.traits.perceptionRadius;
}

/**
 * Calculate energy cost for movement.
 * 
 * @param distance - Distance moved in pixels
 * @param efficiency - Metabolism efficiency (higher = cheaper)
 * @returns Energy cost
 */
export function calculateMovementEnergyCost(
  distance: number,
  efficiency: number
): number {
  const baseCost = DEFAULT_SIMULATION_CONFIG.movementEnergyCostPerPixel * distance;
  // More efficient metabolism = lower cost
  return baseCost / efficiency;
}

/**
 * Create a timestamp string (ISO 8601).
 * 
 * @returns ISO timestamp
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format a number to fixed decimal places.
 * Useful for consistent logging and display.
 * 
 * @param value - Number to format
 * @param decimals - Decimal places (default: 2)
 * @returns Formatted string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Pick a random element from an array.
 * 
 * @param array - Array to pick from
 * @returns Random element or undefined if empty
 */
export function pickRandomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) {
    return undefined;
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle an array in place (Fisher-Yates algorithm).
 * 
 * @param array - Array to shuffle
 * @returns Same array, shuffled
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Group entities by type.
 * 
 * @param entities - Array of entities
 * @returns Object with entities grouped by type
 */
export function groupEntitiesByType(entities: Entity[]): Record<Entity['type'], Entity[]> {
  const groups: Record<Entity['type'], Entity[]> = {
    plant: [],
    herbivore: [],
    carnivore: [],
    fungus: []
  };
  
  for (const entity of entities) {
    groups[entity.type].push(entity);
  }
  
  return groups;
}

/**
 * Count entities by type.
 * 
 * @param entities - Array of entities
 * @returns Population summary
 */
export function countEntitiesByType(entities: Entity[]): PopulationSummary {
    const living = entities.filter(e => e.isAlive === true || (e as any).isAlive === 1);
    const dead = entities.filter(e => e.isAlive === false || (e as any).isAlive === 0);
  
  const livingCounts = groupEntitiesByType(living);
  const deadCounts = groupEntitiesByType(dead);
  
  return {
    plants: livingCounts.plant.length,
    herbivores: livingCounts.herbivore.length,
    carnivores: livingCounts.carnivore.length,
    fungi: livingCounts.fungus.length,
    deadPlants: deadCounts.plant.length,
    deadHerbivores: deadCounts.herbivore.length,
    deadCarnivores: deadCounts.carnivore.length,
    deadFungi: deadCounts.fungus.length,
    total: entities.length,
    totalLiving: living.length,
    totalDead: dead.length
  };
}

/**
 * Calculate the effect of moisture on plant growth.
 * Moisture affects photosynthesis efficiency.
 * 
 * @param moisture - Current moisture level
 * @returns Multiplier for photosynthesis (0.5 to 1.5)
 */
export function calculateMoistureGrowthMultiplier(moisture: number): number {
  // Plants grow best at 50% moisture
  const optimalMoisture = 0.5;
  const deviation = Math.abs(moisture - optimalMoisture);
  
  // Linear decrease from optimal: 1.5 at optimal, 0.5 at extremes
  return clampValueToRange(1.5 - deviation, 0.5, 1.5);
}
