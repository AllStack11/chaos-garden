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

import type { 
  Position, 
  Entity, 
  EntityType,
  Traits, 
  SimulationConfig, 
  PopulationSummary,
  BaseTraits,
  PlantTraits,
  HerbivoreTraits,
  CarnivoreTraits,
  FungusTraits
} from '@chaos-garden/shared';
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
 * Extract traits from an entity.
 */
export function extractTraits<T extends Entity>(entity: T): 
  T extends { type: 'plant' } ? PlantTraits :
  T extends { type: 'herbivore' } ? HerbivoreTraits :
  T extends { type: 'carnivore' } ? CarnivoreTraits :
  T extends { type: 'fungus' } ? FungusTraits : BaseTraits {
  const traitKeysMap: Record<string, string[]> = {
    plant: ['reproductionRate', 'metabolismEfficiency', 'photosynthesisRate'],
    herbivore: ['reproductionRate', 'metabolismEfficiency', 'movementSpeed', 'perceptionRadius'],
    carnivore: ['reproductionRate', 'metabolismEfficiency', 'movementSpeed', 'perceptionRadius'],
    fungus: ['reproductionRate', 'metabolismEfficiency', 'decompositionRate', 'perceptionRadius']
  };

  const keys = traitKeysMap[entity.type] || ['reproductionRate', 'metabolismEfficiency'];
  const traits: any = {};
  for (const key of keys) {
    traits[key] = (entity as any)[key];
  }
  return traits;
}

/**
 * Create a new copy of traits with potential random mutations.
 */
export function copyTraitsWithPossibleMutations<T extends Entity>(
  entity: T
): T extends { type: 'plant' } ? PlantTraits :
   T extends { type: 'herbivore' } ? HerbivoreTraits :
   T extends { type: 'carnivore' } ? CarnivoreTraits :
   T extends { type: 'fungus' } ? FungusTraits : BaseTraits {
  const mutationProbability = DEFAULT_SIMULATION_CONFIG.mutationProbability;
  const mutationRange = DEFAULT_SIMULATION_CONFIG.mutationRange;
  
  // Define which keys are traits for each entity type
  const traitKeysMap: Record<string, string[]> = {
    plant: ['reproductionRate', 'metabolismEfficiency', 'photosynthesisRate'],
    herbivore: ['reproductionRate', 'metabolismEfficiency', 'movementSpeed', 'perceptionRadius'],
    carnivore: ['reproductionRate', 'metabolismEfficiency', 'movementSpeed', 'perceptionRadius'],
    fungus: ['reproductionRate', 'metabolismEfficiency', 'decompositionRate', 'perceptionRadius']
  };

  const keysToCopy = traitKeysMap[entity.type] || ['reproductionRate', 'metabolismEfficiency'];
  const mutatedTraits: any = {};
  
  for (const key of keysToCopy) {
    const originalValue = (entity as any)[key];
    if (typeof originalValue === 'number') {
      if (willRandomEventOccur(mutationProbability)) {
        mutatedTraits[key] = applyRandomMutationToTrait(originalValue, mutationRange);
      } else {
        mutatedTraits[key] = originalValue;
      }
    }
  }
  
  return mutatedTraits;
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
  const moveSpeed = speed ?? (entity.type === 'herbivore' || entity.type === 'carnivore' ? entity.movementSpeed : 0);
  
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
    ? candidates.filter(e =>
      e.type === typeFilter &&
      e.id !== source.id &&
      e.isAlive &&
      e.health > 0 &&
      e.energy > 0
    )
    : candidates.filter(e =>
      e.id !== source.id &&
      e.isAlive &&
      e.health > 0 &&
      e.energy > 0
    );
  
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
  const perceptionRadius = (observer.type === 'herbivore' || observer.type === 'carnivore' || observer.type === 'fungus') 
    ? observer.perceptionRadius 
    : 0;
  return distance <= perceptionRadius;
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
 * Extract the biological category from an entity name.
 * e.g., "Fern-whisper" -> "Fern"
 * 
 * @param name - The lyrical name
 * @returns The category prefix
 */
export function extractCategoryFromName(name: string): string {
  if (!name.includes('-')) return name;
  return name.split('-')[0];
}

/**
 * Generate a random name for an entity.
 * If a parent name is provided, the child might inherit parts of it.
 * 
 * The prefixes include type-specific keywords that map to visual renderers:
 * - Plants: Fern, Flower, Grass, Vine, Succulent, Lily, Moss, Cactus, Bush, Herb
 * - Herbivores: Butterfly, Beetle, Rabbit, Snail, Cricket, Ladybug, Grasshopper, Ant, Bee, Moth
 * 
 * @param type - The type of entity
 * @param parentName - Optional parent's name to inherit from
 * @returns A unique moniker with type-specific keywords
 */
export function generateRandomName(type: EntityType, parentName?: string): string {
  // Type-specific prefixes that map to visual renderers
  const prefixes: Record<EntityType, string[]> = {
    plant: ['Fern', 'Flower', 'Grass', 'Vine', 'Succulent', 'Lily', 'Moss', 'Cactus', 'Bush', 'Herb'],
    herbivore: ['Butterfly', 'Beetle', 'Rabbit', 'Snail', 'Cricket', 'Ladybug', 'Grasshopper', 'Ant', 'Bee', 'Moth'],
    carnivore: ['Fang', 'Claw', 'Night', 'Shadow', 'Sharp', 'Hunt', 'Stalk', 'Blood', 'Pounce', 'Roar'],
    fungus: ['Spore', 'Cap', 'Mycel', 'Mold', 'Glow', 'Damp', 'Shroom', 'Puff', 'Web', 'Rot']
  };

  // Suffixes that work with any prefix
  const suffixes: Record<EntityType, string[]> = {
    plant: ['whisper', 'glow', 'heart', 'reach', 'shade', 'burst', 'thorn', 'bud', 'leaf', 'petal'],
    herbivore: ['stride', 'dash', 'leap', 'bound', 'graze', 'fleet', 'fur', 'step', 'breeze', 'song'],
    carnivore: ['strike', 'rip', 'tear', 'kill', 'fang', 'pounce', 'shade', 'hunter', 'stalker', 'howl'],
    fungus: ['pulse', 'spread', 'bloom', 'rot', 'puff', 'creep', 'glow', 'web', 'drift', 'spore']
  };

  const typePrefixes = prefixes[type];
  const typeSuffixes = suffixes[type];

  // Inheritance logic - 70% chance to inherit part of parent name
  if (parentName && parentName.includes('-') && willRandomEventOccur(0.7)) {
    const parts = parentName.split('-');
    if (parts.length === 2) {
      if (willRandomEventOccur(0.5)) {
        // Inherit prefix (with 30% chance of mutation to different type)
        if (willRandomEventOccur(0.3)) {
          return `${pickRandomElement(typePrefixes)}-${parts[1]}`;
        }
        return `${parts[0]}-${pickRandomElement(typeSuffixes)}`;
      } else {
        // Inherit suffix
        return `${pickRandomElement(typePrefixes)}-${parts[1]}`;
      }
    }
  }

  // Pure random name
  return `${pickRandomElement(typePrefixes)}-${pickRandomElement(typeSuffixes)}`;
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
