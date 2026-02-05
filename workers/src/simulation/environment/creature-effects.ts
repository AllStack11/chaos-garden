/**
 * Creature Effects
 * 
 * Calculates how environmental conditions affect living creatures—
 * the physiological responses to temperature, moisture, and sunlight.
 * 
 * Like real organisms, our digital creatures experience stress
 * from extreme conditions and thrive in optimal environments.
 */

import type { Environment, Entity } from '@chaos-garden/shared';
import { clampValueToRange } from './helpers';
import {
  IDEAL_TEMPERATURE,
  IDEAL_METABOLISM_TEMPERATURE,
  IDEAL_MOISTURE_FOR_PLANTS,
  MAX_PHOTOSYNTHESIS_MULTIPLIER,
  MIN_PHOTOSYNTHESIS_MULTIPLIER,
  MAX_METABOLISM_MULTIPLIER,
  MIN_METABOLISM_MULTIPLIER,
  MILD_TEMPERATURE_DEVIATION,
  SEVERE_TEMPERATURE_DEVIATION,
  MILD_HEALTH_PENALTY_MULTIPLIER,
  MILD_ENERGY_PENALTY_MULTIPLIER,
  SEVERE_HEALTH_PENALTY_MULTIPLIER,
  SEVERE_ENERGY_PENALTY_MULTIPLIER,
  DROUGHT_THRESHOLD,
  DROUGHT_STRESS_ENERGY_PENALTY
} from './constants';

/**
 * Calculate the effect of temperature on a creature.
 * Extreme temperatures reduce health and energy.
 * 
 * @param temperature - Current temperature in Celsius
 * @returns Health and energy penalties
 */
export function calculateTemperatureEffects(
  temperature: number
): { healthPenalty: number; energyPenalty: number } {
  const deviation = Math.abs(temperature - IDEAL_TEMPERATURE);
  
  if (deviation <= MILD_TEMPERATURE_DEVIATION) {
    // Comfortable range - no penalty
    return { healthPenalty: 0, energyPenalty: 0 };
  }
  
  if (deviation <= SEVERE_TEMPERATURE_DEVIATION) {
    // Uncomfortable - mild penalty
    return { 
      healthPenalty: deviation * MILD_HEALTH_PENALTY_MULTIPLIER, 
      energyPenalty: deviation * MILD_ENERGY_PENALTY_MULTIPLIER 
    };
  }
  
  // Extreme - severe penalty
  return { 
    healthPenalty: deviation * SEVERE_HEALTH_PENALTY_MULTIPLIER, 
    energyPenalty: deviation * SEVERE_ENERGY_PENALTY_MULTIPLIER 
  };
}

/**
 * Calculate the effect of moisture on plant growth.
 * Moisture affects photosynthesis efficiency.
 * 
 * @param moisture - Current moisture level (0-1)
 * @returns Multiplier for photosynthesis (0.5 to 1.5)
 */
export function calculateMoistureGrowthMultiplier(moisture: number): number {
  const deviation = Math.abs(moisture - IDEAL_MOISTURE_FOR_PLANTS);
  
  // Linear decrease from optimal: 1.5 at optimal, 0.5 at extremes
  return clampValueToRange(
    MAX_PHOTOSYNTHESIS_MULTIPLIER - deviation, 
    MIN_PHOTOSYNTHESIS_MULTIPLIER, 
    MAX_PHOTOSYNTHESIS_MULTIPLIER
  );
}

/**
 * Calculate the effect of temperature on metabolism.
 * Warmer temperatures increase metabolic rate.
 * 
 * @param temperature - Current temperature in Celsius
 * @returns Metabolism multiplier (0.5 to 1.5)
 */
export function calculateTemperatureMetabolismMultiplier(temperature: number): number {
  const deviation = Math.abs(temperature - IDEAL_METABOLISM_TEMPERATURE);
  
  // Metabolism decreases as we move away from optimal temperature
  return clampValueToRange(
    MAX_METABOLISM_MULTIPLIER - (deviation / 20), 
    MIN_METABOLISM_MULTIPLIER, 
    MAX_METABOLISM_MULTIPLIER
  );
}

/**
 * Apply environmental effects to a creature.
 * Updates creature in place (mutates).
 * 
 * @param creature - Creature to affect
 * @param environment - Current environment
 */
export function applyEnvironmentalEffectsToCreature(
  creature: Entity,
  environment: Environment
): void {
  // Temperature effects
  const tempEffects = calculateTemperatureEffects(environment.temperature);
  creature.health -= tempEffects.healthPenalty;
  creature.energy -= tempEffects.energyPenalty;
  
  // Moisture effects (more relevant for plants, handled in plant behavior)
  // but all creatures lose more energy in drought
  if (environment.moisture < DROUGHT_THRESHOLD) {
    creature.energy -= DROUGHT_STRESS_ENERGY_PENALTY;
  }
  
  // Ensure values stay valid
  creature.health = clampValueToRange(creature.health, 0, 100);
  creature.energy = clampValueToRange(creature.energy, 0, 100);
}

/**
 * Calculate the optimal temperature range for a creature type.
 * Different creature types have different temperature preferences.
 * 
 * @param creatureType - Type of creature
 * @returns Object with min, max, and ideal temperatures
 */
export function getOptimalTemperatureRangeForCreatureType(
  creatureType: Entity['type']
): { min: number; max: number; ideal: number } {
  switch (creatureType) {
    case 'plant':
      return { min: 5, max: 35, ideal: 22 };
    case 'herbivore':
      return { min: 10, max: 30, ideal: 20 };
    case 'carnivore':
      return { min: 15, max: 25, ideal: 20 };
    case 'fungus':
      return { min: 0, max: 25, ideal: 15 };
    default:
      return { min: 0, max: 40, ideal: 20 };
  }
}

/**
 * Check if temperature is within optimal range for a creature type.
 * 
 * @param temperature - Current temperature
 * @param creatureType - Type of creature
 * @returns True if temperature is optimal
 */
export function isTemperatureOptimalForCreatureType(
  temperature: number,
  creatureType: Entity['type']
): boolean {
  const range = getOptimalTemperatureRangeForCreatureType(creatureType);
  return temperature >= range.min && temperature <= range.max;
}

/**
 * Calculate temperature stress level for a creature.
 * 
 * @param creature - Creature to check
 * @param temperature - Current temperature
 * @returns Stress level (0 = no stress, 1 = maximum stress)
 */
export function calculateTemperatureStressLevel(
  creature: Entity,
  temperature: number
): number {
  const range = getOptimalTemperatureRangeForCreatureType(creature.type);
  
  if (temperature >= range.min && temperature <= range.max) {
    return 0; // Within optimal range
  }
  
  // Calculate how far outside the optimal range
  if (temperature < range.min) {
    return (range.min - temperature) / 10;
  } else {
    return (temperature - range.max) / 10;
  }
}