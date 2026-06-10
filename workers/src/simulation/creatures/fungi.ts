/**
 * Fungi Behavior
 * 
 * The fourth kingdom of life—decomposers that recycle dead matter.
 * Fungi spread through the soil like a network, breaking down
 * dead plants and herbivores into nutrients that sustain the ecosystem.
 * 
 * They are the silent recyclers, the foundation of nutrient cycling.
 */

import type { Entity, DeadMatter, Environment, Traits, FungusTraits } from '@chaos-garden/shared';
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
  calculateDistanceBetweenPositions,
  moveEntityTowardTarget,
  calculateMovementEnergyCost
} from '../environment/helpers';
import { calculateTemperatureMetabolismMultiplier } from '../environment/creature-effects';
import { getEffectiveWeatherModifiersFromEnvironment } from '../environment/weather-state-machine';
import {
  logTraitMutationsForOffspring,
  applyStarvationHealthDecay,
  isEntityDead,
  getEntityCauseOfDeath
} from './creatureHelpers';

// Constants
const BASE_METABOLISM_COST = 0.2; // Fungi have lower metabolism than plants/herbivores
const REPRODUCTION_THRESHOLD = 82;
const MAX_ENERGY = 100;
const REPRODUCTION_COST = 34;
const DECOMPOSITION_DISTANCE = 30; // pixels - fungi can decompose nearby dead matter
const MAX_AGE = 300; // Fungi live longer than plants/herbivores
const ENERGY_FROM_DECOMPOSITION = 13;
const SPORE_SPREAD_RADIUS = 40; // how far spores can travel
const FUNGUS_MOVEMENT_SPEED = 0.4; // slow creeping movement toward dead matter
const FUNGUS_MOVEMENT_COST_MULTIPLIER = 0.25; // moving is cheap but not free
const STARVATION_HEALTH_DECAY_PER_TICK = 1;

/**
 * Create a new fungus entity.
 */
export function createNewFungusEntity(
  position: { x: number; y: number },
  gardenStateId: number,
  traits?: Partial<FungusTraits>,
  parentId: string = 'origin',
  bornAtTick: number = 0,
  parentName?: string
): Entity {
  const now = createTimestamp();
  const name = generateRandomName('fungus', parentName);
  const species = extractCategoryFromName(name);
  
  return {
    id: generateEntityId(),
    gardenStateId,
    bornAtTick,
    deathTick: undefined,
    isAlive: true,
    type: 'fungus',
    name,
    species,
    position: { ...position },
    energy: 40, // Start with moderate energy
    health: 100,
    age: 0,
    reproductionRate: traits?.reproductionRate ?? 0.025,
    metabolismEfficiency: traits?.metabolismEfficiency ?? 1.2,
    decompositionRate: traits?.decompositionRate ?? 1.0,
    perceptionRadius: traits?.perceptionRadius ?? 80,
    lineage: parentId,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Process a fungus's behavior for one tick.
 * Returns offspring and dead matter items whose energy was changed this tick.
 * The caller is responsible for persisting energy updates and deleting fully
 * decomposed items (energy <= 0).
 */
export async function processFungusBehaviorDuringTick(
  fungus: Entity,
  environment: Environment,
  deadMatter: DeadMatter[],
  eventLogger: EventLogger
): Promise<{ offspring: Entity[]; touchedDeadMatter: DeadMatter[] }> {
  if (fungus.type !== 'fungus') return { offspring: [], touchedDeadMatter: [] };
  const offspring: Entity[] = [];
  const touchedDeadMatter: DeadMatter[] = [];

  // 1. Find nearest dead matter within perception radius
  const target = findNearestDeadMatter(fungus, deadMatter, fungus.perceptionRadius);

  // 2. Decompose or creep toward target
  if (target) {
    const distance = calculateDistanceBetweenPositions(fungus.position, target.position);

    if (distance <= DECOMPOSITION_DISTANCE) {
      const energyGained = decomposeMatter(fungus, target, environment);
      if (energyGained > 0) {
        touchedDeadMatter.push(target);
      }
    } else {
      moveEntityTowardTarget(fungus, target.position, FUNGUS_MOVEMENT_SPEED);
      const movedDistance = Math.min(distance, FUNGUS_MOVEMENT_SPEED);
      const movementCost = calculateMovementEnergyCost(
        movedDistance,
        fungus.metabolismEfficiency
      ) * FUNGUS_MOVEMENT_COST_MULTIPLIER;
      fungus.energy -= movementCost;
    }
  }

  // 3. Base metabolism
  const tempMultiplier = calculateTemperatureMetabolismMultiplier(environment.temperature);
  fungus.energy -= BASE_METABOLISM_COST * tempMultiplier * 0.5;

  // 4. Reproduction
  const weatherModifiers = getEffectiveWeatherModifiersFromEnvironment(environment);
  if (fungus.energy >= REPRODUCTION_THRESHOLD) {
    if (willRandomEventOccur(fungus.reproductionRate * weatherModifiers.reproductionModifier)) {
      const child = await attemptFungusReproduction(fungus, fungus.gardenStateId ?? 0, eventLogger);
      if (child) {
        offspring.push(child);
      }
    }
  }

  // 5. Death checks
  if (fungus.age >= MAX_AGE) {
    fungus.isAlive = false;
    fungus.health = 0;
    fungus.energy = 0;
  } else {
    applyStarvationHealthDecay(fungus, STARVATION_HEALTH_DECAY_PER_TICK);
  }

  fungus.updatedAt = createTimestamp();
  return { offspring, touchedDeadMatter };
}

/**
 * Decompose a dead matter item and gain energy.
 * Mutates both fungus.energy and target.energy in place.
 */
function decomposeMatter(
  fungus: Entity,
  target: DeadMatter,
  environment: Environment
): number {
  if (fungus.type !== 'fungus') return 0;
  const moistureMultiplier = Math.max(0.5, environment.moisture * 2);
  const efficiency = fungus.decompositionRate * moistureMultiplier;

  const energyGained = Math.min(ENERGY_FROM_DECOMPOSITION * efficiency, target.energy);
  fungus.energy = clampValueToRange(fungus.energy + energyGained, 0, MAX_ENERGY);
  target.energy = Math.max(0, target.energy - energyGained);

  return energyGained;
}

/**
 * Attempt fungus reproduction via spores.
 */
async function attemptFungusReproduction(
  parent: Entity,
  gardenStateId: number,
  eventLogger: EventLogger
): Promise<Entity | null> {
  if (parent.type !== 'fungus') return null;
  parent.energy -= REPRODUCTION_COST;
  
  // Spores can travel further than plant seeds
  const childPosition = generatePositionNearParent(parent.position, SPORE_SPREAD_RADIUS);
  const childTraits = copyTraitsWithPossibleMutations(parent);
  
  const child = createNewFungusEntity(childPosition, gardenStateId, childTraits, parent.id, 0, parent.name);
  
  await eventLogger.logBirth(child, parent.id, parent.name);
  await logTraitMutationsForOffspring(
    parent,
    child,
    ['reproductionRate', 'metabolismEfficiency', 'decompositionRate', 'perceptionRadius'],
    eventLogger
  );
  
  return child;
}

/**
 * Find the nearest dead matter item within maxDistance.
 * All items in the array are valid targets (energy > 0 is guaranteed by the caller).
 */
function findNearestDeadMatter(
  fungus: Entity,
  deadMatter: DeadMatter[],
  maxDistance?: number
): DeadMatter | null {
  let nearest: DeadMatter | null = null;
  let minDistance = Infinity;

  for (const item of deadMatter) {
    const distance = calculateDistanceBetweenPositions(fungus.position, item.position);
    if (maxDistance !== undefined && distance > maxDistance) continue;
    if (distance < minDistance) {
      minDistance = distance;
      nearest = item;
    }
  }

  return nearest;
}

/**
 * Check if a fungus has died.
 */
export function isFungusDead(fungus: Entity): boolean {
  return isEntityDead(fungus);
}

/**
 * Get the cause of death for a fungus.
 */
export function getFungusCauseOfDeath(fungus: Entity): string {
  return getEntityCauseOfDeath(
    fungus,
    MAX_AGE,
    'starved (no dead matter found)',
    'withered away'
  );
}

