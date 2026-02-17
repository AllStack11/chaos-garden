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
  spreadRadius: number = 75,
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
    herbivore: ['reproductionRate', 'metabolismEfficiency', 'movementSpeed', 'perceptionRadius', 'threatDetectionRadius'],
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
    herbivore: ['reproductionRate', 'metabolismEfficiency', 'movementSpeed', 'perceptionRadius', 'threatDetectionRadius'],
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
  typeFilter?: Entity['type'],
  maxDistance?: number
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

  const targetsWithinRange = typeof maxDistance === 'number'
    ? validTargets.filter(target =>
      calculateDistanceBetweenEntities(source, target) <= maxDistance
    )
    : validTargets;
  
  if (targetsWithinRange.length === 0) {
    return null;
  }
  
  let nearest = targetsWithinRange[0];
  let minDistance = calculateDistanceBetweenEntities(source, nearest);
  
  for (let i = 1; i < targetsWithinRange.length; i++) {
    const distance = calculateDistanceBetweenEntities(source, targetsWithinRange[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = targetsWithinRange[i];
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
 * Pick a random element from weighted options.
 *
 * @param options - Candidate values with weights
 * @returns Random element or undefined if empty/invalid
 */
export function pickWeightedRandomElement<T>(
  options: Array<{ value: T; weight: number }>
): T | undefined {
  if (options.length === 0) return undefined;

  const normalized = options
    .filter((option) => option.weight > 0);

  if (normalized.length === 0) return undefined;

  const totalWeight = normalized.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const option of normalized) {
    roll -= option.weight;
    if (roll <= 0) return option.value;
  }

  return normalized[normalized.length - 1]?.value;
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
    plant: [
      'Fern', 'Flower', 'Grass', 'Vine', 'Succulent', 'Lily', 'Moss', 'Cactus', 'Bush', 'Herb',
      'Rose', 'Tulip', 'Mint', 'Thyme', 'Shrub', 'Jade', 'Blossom', 'Willow', 'Clover', 'Bramble',
      'Crystal', 'Prism', 'Shard', 'Coral', 'Reef', 'Kelp', 'Seaweed', 'Drake', 'Spike', 'Void'
    ],
    herbivore: [
      'Butterfly', 'Beetle', 'Rabbit', 'Snail', 'Cricket', 'Ladybug', 'Grasshopper', 'Ant', 'Bee', 'Moth',
      'Centipede', 'Crawler', 'Mouse', 'Hare', 'Bunny', 'Locust', 'Caterpillar', 'Mite', 'Weevil', 'Firefly', 'Wren', 'Finch'
    ],
    carnivore: [
      'Fang', 'Claw', 'Night', 'Shadow', 'Sharp', 'Hunt', 'Stalk', 'Blood', 'Raptor', 'Rend', 
      'Howl', 'Strike', 'Raze', 'Hawk', 'Eagle', 'Viper', 'Serpent', 'Cobra', 'Vulture', 
      'Drake', 'Talon', 'Slither', 'Coil', 'Wolf', 'Bane', 'Grim', 'Dire', 'Savage'
    ],
    fungus: [
      'Spore', 'Cap', 'Mycel', 'Mold', 'Glow', 'Damp', 'Shroom', 'Puff', 'Web', 'Rot',
      'Bract', 'Shelf', 'Gill', 'Lichen', 'Murk', 'Hypha', 'Truffle', 'Bloom', 'Smut', 'Veil'
    ]
  };

  // Suffixes that work with any prefix
  const suffixes: Record<EntityType, string[]> = {
    plant: [
      'whisper', 'glow', 'heart', 'reach', 'shade', 'burst', 'thorn', 'bud', 'leaf', 'petal',
      'sprout', 'bloom', 'frond', 'tangle', 'briar', 'root', 'breeze', 'dew', 'canopy', 'verdant',
      'facet', 'cluster', 'reef', 'frond', 'spire', 'spine', 'scale'
    ],
    herbivore: [
      'stride', 'dash', 'leap', 'bound', 'graze', 'fleet', 'fur', 'step', 'breeze', 'song',
      'flutter', 'forage', 'skip', 'scurry', 'nibble', 'drift', 'glide', 'hum', 'trill', 'meadow'
    ],
    carnivore: [
      'strike', 'rip', 'tear', 'kill', 'fang', 'shade', 'hunter', 'stalker', 'howl',
      'ambush', 'prowl', 'snare', 'ravenous', 'chase', 'snarl', 'grim', 'rush', 'fury',
      'dive', 'beak', 'glide', 'soar', 'hiss', 'venom', 'snap', 'scourge', 'bane'
    ],
    fungus: [
      'pulse', 'spread', 'bloom', 'rot', 'puff', 'creep', 'glow', 'web', 'drift', 'spore',
      'gloom', 'veil', 'smolder', 'decay', 'mist', 'mire', 'wilt', 'clump', 'mycelia', 'dust'
    ]
  };

  const typePrefixes = prefixes[type];
  const typeSuffixes = suffixes[type];
  const plantPrefixWeights: Partial<Record<string, number>> = {
    Grass: 0.35,
    Moss: 0.85,
    Rose: 1.15,
    Tulip: 1.15,
    Mint: 1.2,
    Thyme: 1.2,
    Shrub: 1.1,
    Jade: 1.1,
    Blossom: 1.1,
    Clover: 1.05,
    Crystal: 0.6,
    Prism: 0.5,
    Shard: 0.5,
    Coral: 0.7,
    Reef: 0.7,
    Kelp: 0.7,
    Seaweed: 0.6,
    Drake: 0.4,
    Spike: 0.6,
    Void: 0.3,
  };

  const pickTypePrefix = (): string => {
    if (type === 'plant') {
      const weighted = typePrefixes.map((prefix) => ({
        value: prefix,
        weight: plantPrefixWeights[prefix] ?? 1,
      }));
      return pickWeightedRandomElement(weighted) ?? typePrefixes[0] ?? 'Entity';
    }
    return pickRandomElement(typePrefixes) ?? typePrefixes[0] ?? 'Entity';
  };
  const pickTypeSuffix = (): string => pickRandomElement(typeSuffixes) ?? typeSuffixes[0] ?? 'form';
  const canonicalPrefixByLowercase = new Map(
    typePrefixes.map((prefix) => [prefix.toLowerCase(), prefix] as const)
  );
  const getSafeInheritedPrefix = (candidatePrefix: string): string => {
    const canonicalPrefix = canonicalPrefixByLowercase.get(candidatePrefix.toLowerCase());
    return canonicalPrefix ?? pickTypePrefix();
  };

  // Inheritance logic - 70% chance to inherit part of parent name
  if (parentName && parentName.includes('-') && willRandomEventOccur(0.7)) {
    const parts = parentName.split('-');
    if (parts.length === 2) {
      if (willRandomEventOccur(0.5)) {
        // Inherit prefix (with 30% chance of mutation to different type)
        if (willRandomEventOccur(0.3)) {
          return `${pickTypePrefix()}-${parts[1]}`;
        }
        return `${getSafeInheritedPrefix(parts[0])}-${pickTypeSuffix()}`;
      } else {
        // Inherit suffix
        return `${pickTypePrefix()}-${parts[1]}`;
      }
    }
  }

  // Pure random name
  return `${pickTypePrefix()}-${pickTypeSuffix()}`;
}

/**
 * Count entities by type.
 * 
 * @param entities - Array of entities
 * @returns Population summary
 */
export function countEntitiesByType(entities: Entity[]): PopulationSummary {
  const living = entities.filter(entity => entity.isAlive);
  const deadInGarden = entities.filter(entity => !entity.isAlive && entity.energy > 0);
  
  const livingCounts = groupEntitiesByType(living);
  const deadCounts = groupEntitiesByType(deadInGarden);
  
  return {
    plants: livingCounts.plant.length,
    herbivores: livingCounts.herbivore.length,
    carnivores: livingCounts.carnivore.length,
    fungi: livingCounts.fungus.length,
    deadPlants: deadCounts.plant.length,
    deadHerbivores: deadCounts.herbivore.length,
    deadCarnivores: deadCounts.carnivore.length,
    deadFungi: deadCounts.fungus.length,
    allTimeDeadPlants: 0,
    allTimeDeadHerbivores: 0,
    allTimeDeadCarnivores: 0,
    allTimeDeadFungi: 0,
    total: living.length + deadInGarden.length,
    totalLiving: living.length,
    totalDead: deadInGarden.length,
    allTimeDead: 0
  };
}

// ==========================================
// Predator-Prey Perception Functions
// ==========================================

/**
 * Find all entities of a specific type within a radius.
 * Returns array (not just nearest) for threat assessment.
 *
 * @param source - Entity searching
 * @param candidates - Array of entities to search
 * @param typeFilter - Type to filter by
 * @param radius - Maximum distance to include
 * @returns Array of entities within radius
 */
export function findAllEntitiesOfTypeWithinRadius(
  source: Entity,
  candidates: Entity[],
  typeFilter: EntityType,
  radius: number
): Entity[] {
  return candidates.filter(entity =>
    entity.type === typeFilter &&
    entity.id !== source.id &&
    entity.isAlive &&
    entity.health > 0 &&
    entity.energy > 0 &&
    calculateDistanceBetweenEntities(source, entity) <= radius
  );
}

/**
 * Calculate threat level for a herbivore based on carnivore proximity and state.
 * Returns threat score (higher = more dangerous).
 *
 * @param herbivore - Herbivore assessing threat
 * @param carnivore - Potential predator
 * @returns Threat score (0-100, higher = more dangerous)
 */
export function calculateThreatLevelForHerbivore(
  herbivore: Entity,
  carnivore: Entity
): number {
  const distance = calculateDistanceBetweenEntities(herbivore, carnivore);

  // Base threat: inverse of distance (closer = more threatening)
  const proximityThreat = 100 - (distance / 2); // Normalized to 0-100

  // Carnivore energy factor: higher energy = more dangerous (can chase longer)
  const energyThreat = carnivore.energy / 2; // 0-50 range

  // Combined threat score
  return Math.max(0, Math.min(100, proximityThreat + (energyThreat * 0.3)));
}

/**
 * Find the most dangerous threat to a herbivore.
 * Returns the carnivore posing the highest threat, or null if none.
 *
 * @param herbivore - Herbivore searching for threats
 * @param allCarnivores - Array of all carnivores in the garden
 * @returns Most dangerous carnivore or null
 */
export function findMostDangerousThreat(
  herbivore: Entity,
  allCarnivores: Entity[]
): Entity | null {
  if (herbivore.type !== 'herbivore') return null;

  const threatsInRange = findAllEntitiesOfTypeWithinRadius(
    herbivore,
    allCarnivores,
    'carnivore',
    herbivore.threatDetectionRadius
  );

  if (threatsInRange.length === 0) return null;

  // Score each threat and return the most dangerous
  let mostDangerousThreat = threatsInRange[0];
  let highestThreatScore = calculateThreatLevelForHerbivore(herbivore, threatsInRange[0]);

  for (let i = 1; i < threatsInRange.length; i++) {
    const threatScore = calculateThreatLevelForHerbivore(herbivore, threatsInRange[i]);
    if (threatScore > highestThreatScore) {
      highestThreatScore = threatScore;
      mostDangerousThreat = threatsInRange[i];
    }
  }

  return mostDangerousThreat;
}

/**
 * Calculate optimal flee direction away from threat.
 * Adds random jitter and handles boundary avoidance.
 *
 * @param herbivore - Herbivore fleeing
 * @param threat - Threat position
 * @param gardenWidth - Garden width in pixels
 * @param gardenHeight - Garden height in pixels
 * @param addJitter - Whether to add random jitter to avoid predictability
 * @returns Target position to flee toward
 */
export function findOptimalFleeDirection(
  herbivore: Entity,
  threat: Entity,
  gardenWidth: number,
  gardenHeight: number,
  addJitter: boolean
): Position {
  // Calculate vector away from threat
  const deltaX = herbivore.position.x - threat.position.x;
  const deltaY = herbivore.position.y - threat.position.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance === 0) {
    // Threat is exactly on top of us, pick random direction
    const angle = Math.random() * Math.PI * 2;
    return {
      x: herbivore.position.x + Math.cos(angle) * 100,
      y: herbivore.position.y + Math.sin(angle) * 100
    };
  }

  // Normalized flee direction
  let fleeX = deltaX / distance;
  let fleeY = deltaY / distance;

  // Add jitter if requested (±30 degrees)
  if (addJitter) {
    const jitterAngle = (Math.random() - 0.5) * (Math.PI / 3); // ±60 degrees total range
    const cosJitter = Math.cos(jitterAngle);
    const sinJitter = Math.sin(jitterAngle);
    const newFleeX = fleeX * cosJitter - fleeY * sinJitter;
    const newFleeY = fleeX * sinJitter + fleeY * cosJitter;
    fleeX = newFleeX;
    fleeY = newFleeY;
  }

  // Project flee direction far ahead
  let targetX = herbivore.position.x + fleeX * 100;
  let targetY = herbivore.position.y + fleeY * 100;

  // Boundary avoidance: if near edge, add perpendicular component
  const boundaryThreshold = 50;
  if (herbivore.position.x < boundaryThreshold) {
    // Near left edge, bias right
    targetX += 50;
  } else if (herbivore.position.x > gardenWidth - boundaryThreshold) {
    // Near right edge, bias left
    targetX -= 50;
  }

  if (herbivore.position.y < boundaryThreshold) {
    // Near top edge, bias down
    targetY += 50;
  } else if (herbivore.position.y > gardenHeight - boundaryThreshold) {
    // Near bottom edge, bias up
    targetY -= 50;
  }

  // Clamp to garden bounds
  targetX = Math.max(0, Math.min(gardenWidth, targetX));
  targetY = Math.max(0, Math.min(gardenHeight, targetY));

  return { x: targetX, y: targetY };
}

/**
 * Move entity away from a threat position.
 * Mutates entity position in place.
 *
 * @param entity - Entity to move (mutated)
 * @param threat - Threat to flee from
 * @param speed - Movement speed
 * @param gardenWidth - Garden width
 * @param gardenHeight - Garden height
 * @param addJitter - Whether to add evasion jitter
 */
export function moveEntityAwayFromTarget(
  entity: Entity,
  threat: Position,
  speed: number,
  gardenWidth: number,
  gardenHeight: number,
  addJitter: boolean
): void {
  if (speed <= 0) return;

  // Calculate vector away from threat
  const deltaX = entity.position.x - threat.x;
  const deltaY = entity.position.y - threat.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance === 0) {
    // Threat is exactly on top of us, move in random direction
    const angle = Math.random() * Math.PI * 2;
    entity.position.x += Math.cos(angle) * speed;
    entity.position.y += Math.sin(angle) * speed;
  } else {
    // Normalized flee direction
    let fleeX = deltaX / distance;
    let fleeY = deltaY / distance;

    // Add jitter if requested
    if (addJitter && willRandomEventOccur(0.3)) {
      const jitterAngle = (Math.random() - 0.5) * (Math.PI / 4); // ±45 degrees
      const cosJitter = Math.cos(jitterAngle);
      const sinJitter = Math.sin(jitterAngle);
      const newFleeX = fleeX * cosJitter - fleeY * sinJitter;
      const newFleeY = fleeX * sinJitter + fleeY * cosJitter;
      fleeX = newFleeX;
      fleeY = newFleeY;
    }

    // Move away from threat
    entity.position.x += fleeX * speed;
    entity.position.y += fleeY * speed;
  }

  // Boundary handling: bounce off edges
  const boundaryThreshold = 50;
  if (entity.position.x < boundaryThreshold) {
    entity.position.x = Math.max(0, entity.position.x);
  } else if (entity.position.x > gardenWidth - boundaryThreshold) {
    entity.position.x = Math.min(gardenWidth, entity.position.x);
  }

  if (entity.position.y < boundaryThreshold) {
    entity.position.y = Math.max(0, entity.position.y);
  } else if (entity.position.y > gardenHeight - boundaryThreshold) {
    entity.position.y = Math.min(gardenHeight, entity.position.y);
  }

  // Final clamp to ensure within bounds
  entity.position.x = Math.max(0, Math.min(gardenWidth, entity.position.x));
  entity.position.y = Math.max(0, Math.min(gardenHeight, entity.position.y));
}

/**
 * Check if entity is near garden boundary.
 * Returns edge information for boundary avoidance.
 *
 * @param entity - Entity to check
 * @param boundaryThreshold - Distance from edge to consider "near"
 * @param gardenWidth - Garden width
 * @param gardenHeight - Garden height
 * @returns Object with boundary proximity info
 */
export function isEntityNearGardenBoundary(
  entity: Entity,
  boundaryThreshold: number,
  gardenWidth: number,
  gardenHeight: number
): { isNear: boolean; nearestEdge: 'top' | 'bottom' | 'left' | 'right' | null } {
  const { x, y } = entity.position;

  const nearLeft = x < boundaryThreshold;
  const nearRight = x > gardenWidth - boundaryThreshold;
  const nearTop = y < boundaryThreshold;
  const nearBottom = y > gardenHeight - boundaryThreshold;

  if (!nearLeft && !nearRight && !nearTop && !nearBottom) {
    return { isNear: false, nearestEdge: null };
  }

  // Determine nearest edge
  const distances = {
    left: x,
    right: gardenWidth - x,
    top: y,
    bottom: gardenHeight - y
  };

  const nearestEdge = (Object.keys(distances) as Array<'top' | 'bottom' | 'left' | 'right'>)
    .reduce((nearest, edge) =>
      distances[edge] < distances[nearest] ? edge : nearest
    );

  return { isNear: true, nearestEdge };
}

/**
 * Generate random exploration target within garden bounds.
 * Used when perception fails instead of omniscient search.
 *
 * @param entity - Entity exploring
 * @param gardenWidth - Garden width
 * @param gardenHeight - Garden height
 * @returns Random target position for exploration
 */
export function generateExplorationTarget(
  entity: Entity,
  gardenWidth: number,
  gardenHeight: number
): Position {
  // Generate exploration target within a reasonable range from current position
  const explorationRange = 150; // pixels - reasonable search distance
  const angle = Math.random() * Math.PI * 2; // Random direction
  const distance = Math.random() * explorationRange;

  let targetX = entity.position.x + Math.cos(angle) * distance;
  let targetY = entity.position.y + Math.sin(angle) * distance;

  // Clamp to garden bounds
  targetX = Math.max(0, Math.min(gardenWidth, targetX));
  targetY = Math.max(0, Math.min(gardenHeight, targetY));

  return { x: targetX, y: targetY };
}

/**
 * Find carnivores targeting the same prey (for pack coordination).
 * Returns array of competing carnivores.
 *
 * @param carnivore - Carnivore checking for competition
 * @param allCarnivores - Array of all carnivores
 * @param targetPrey - The prey being targeted (null if none)
 * @param coordinationRadius - Radius to check for other carnivores
 * @returns Array of competing carnivores
 */
export function findCompetingCarnivores(
  carnivore: Entity,
  allCarnivores: Entity[],
  targetPrey: Entity | null,
  coordinationRadius: number
): Entity[] {
  if (!targetPrey) return [];

  return allCarnivores.filter(otherCarnivore =>
    otherCarnivore.id !== carnivore.id &&
    otherCarnivore.isAlive &&
    otherCarnivore.health > 0 &&
    otherCarnivore.energy > 0 &&
    calculateDistanceBetweenEntities(carnivore, otherCarnivore) <= coordinationRadius &&
    // Check if other carnivore is also close to the target prey (likely competing)
    calculateDistanceBetweenEntities(otherCarnivore, targetPrey) < calculateDistanceBetweenEntities(carnivore, targetPrey) * 1.5
  );
}
