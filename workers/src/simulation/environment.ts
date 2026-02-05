/**
 * Environment System
 * 
 * Manages the environmental conditions of the garden—
 * the weather, climate, and seasonal cycles that shape life.
 * 
 * Like the changing seasons, the environment evolves over time,
 * creating challenges and opportunities for the ecosystem.
 */

import type { Environment, Entity } from '@chaos-garden/shared';
import type { EventLogger } from '../logging/event-logger';
import { 
  clampValueToRange, 
  generateRandomValueInRange,
  willRandomEventOccur 
} from './helpers';

// ==========================================
// Environment Constants
// ==========================================

/** Day length in ticks (for day/night cycles if implemented) */
export const TICKS_PER_DAY = 96; // 15 minutes * 96 = 24 hours

/** Probability of weather change per tick */
const WEATHER_CHANGE_PROBABILITY = 0.05; // 5% chance per tick

/** Maximum change in temperature per tick */
const MAX_TEMPERATURE_CHANGE = 2.0; // ±2°C per tick

/** Maximum change in moisture per tick */
const MAX_MOISTURE_CHANGE = 0.05; // ±5% per tick

/** Sunlight cycles based on time of day (simplified) */
export function calculateSunlightForTick(tick: number): number {
  // Simplified day/night cycle: peak at tick 48, night at ticks 0 and 96
  // This creates a sine wave from 0 to 1 over 96 ticks
  const normalizedTime = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;
  const angle = normalizedTime * Math.PI * 2 - Math.PI / 2;
  const sunlight = (Math.sin(angle) + 1) / 2;
  
  // Clamp to ensure valid range
  return clampValueToRange(sunlight, 0, 1);
}

// ==========================================
// Environment Updates
// ==========================================

/**
 * Update the environment for the next tick.
 * Simulates weather patterns, temperature changes, and seasonal cycles.
 * 
 * @param current - Current environment state
 * @param eventLogger - Logger for environmental events
 * @returns Updated environment
 */
export function updateEnvironmentForNextTick(
  current: Environment,
  eventLogger?: EventLogger
): Environment {
  const nextTick = current.tick + 1;
  
  // Calculate sunlight based on time of day
  const sunlight = calculateSunlightForTick(nextTick);
  
  // Temperature drifts randomly but stays within bounds
  let temperature = current.temperature;
  if (willRandomEventOccur(WEATHER_CHANGE_PROBABILITY)) {
    const change = generateRandomValueInRange(-MAX_TEMPERATURE_CHANGE, MAX_TEMPERATURE_CHANGE);
    temperature = clampValueToRange(temperature + change, 0, 40);
  }
  
  // Moisture drifts randomly
  let moisture = current.moisture;
  if (willRandomEventOccur(WEATHER_CHANGE_PROBABILITY)) {
    const change = generateRandomValueInRange(-MAX_MOISTURE_CHANGE, MAX_MOISTURE_CHANGE);
    moisture = clampValueToRange(moisture + change, 0, 1);
  }
  
  // Create updated environment
  const updated: Environment = {
    tick: nextTick,
    temperature,
    sunlight,
    moisture
  };
  
  // Log significant environmental changes
  if (eventLogger) {
    logEnvironmentalChanges(current, updated, eventLogger);
  }
  
  return updated;
}

/**
 * Log significant environmental changes.
 * Detects and reports notable weather events.
 */
function logEnvironmentalChanges(
  previous: Environment,
  current: Environment,
  eventLogger: EventLogger
): void {
  // Detect drought (low moisture)
  if (previous.moisture > 0.2 && current.moisture <= 0.2) {
    eventLogger.logEnvironmentChange(
      `Drought conditions detected! Moisture dropped to ${(current.moisture * 100).toFixed(1)}%`
    );
  }
  
  // Detect heavy rain (high moisture)
  if (previous.moisture < 0.8 && current.moisture >= 0.8) {
    eventLogger.logEnvironmentChange(
      `Heavy rainfall! Moisture increased to ${(current.moisture * 100).toFixed(1)}%`
    );
  }
  
  // Detect heat wave
  if (previous.temperature < 35 && current.temperature >= 35) {
    eventLogger.logEnvironmentChange(
      `Heat wave! Temperature reached ${current.temperature.toFixed(1)}°C`
    );
  }
  
  // Detect freeze
  if (previous.temperature > 5 && current.temperature <= 5) {
    eventLogger.logEnvironmentChange(
      `Freeze warning! Temperature dropped to ${current.temperature.toFixed(1)}°C`
    );
  }
}

// ==========================================
// Environmental Effects on Entities
// ==========================================

/**
 * Calculate the effect of temperature on an entity.
 * Extreme temperatures reduce health and energy.
 * 
 * @param entity - Entity to affect
 * @param temperature - Current temperature
 * @returns Health and energy penalties
 */
export function calculateTemperatureEffects(
  temperature: number
): { healthPenalty: number; energyPenalty: number } {
  // Ideal temperature is around 20°C
  const deviation = Math.abs(temperature - 20);
  
  if (deviation <= 10) {
    // Comfortable range - no penalty
    return { healthPenalty: 0, energyPenalty: 0 };
  }
  
  if (deviation <= 20) {
    // Uncomfortable - mild penalty
    return { 
      healthPenalty: deviation * 0.1, 
      energyPenalty: deviation * 0.05 
    };
  }
  
  // Extreme - severe penalty
  return { 
    healthPenalty: deviation * 0.3, 
    energyPenalty: deviation * 0.2 
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

/**
 * Calculate the effect of temperature on metabolism.
 * Warmer temperatures increase metabolic rate.
 * 
 * @param temperature - Current temperature
 * @returns Metabolism multiplier (0.5 to 1.5)
 */
export function calculateTemperatureMetabolismMultiplier(temperature: number): number {
  // Metabolism peaks at 25°C, decreases in cold
  const optimalTemp = 25;
  const deviation = Math.abs(temperature - optimalTemp);
  
  // 1.0 at optimal, decreases as we move away
  return clampValueToRange(1.5 - (deviation / 20), 0.5, 1.5);
}

/**
 * Apply environmental effects to an entity.
 * Updates entity in place (mutates).
 * 
 * @param entity - Entity to affect
 * @param environment - Current environment
 */
export function applyEnvironmentalEffectsToEntity(
  entity: Entity,
  environment: Environment
): void {
  // Temperature effects
  const tempEffects = calculateTemperatureEffects(environment.temperature);
  entity.health -= tempEffects.healthPenalty;
  entity.energy -= tempEffects.energyPenalty;
  
  // Moisture effects (more relevant for plants, handled in plant behavior)
  // but all entities lose more energy in drought
  if (environment.moisture < 0.2) {
    entity.energy -= 0.5; // Drought stress
  }
  
  // Ensure values stay valid
  entity.health = clampValueToRange(entity.health, 0, 100);
  entity.energy = clampValueToRange(entity.energy, 0, 100);
}

/**
 * Create the initial environment for a new garden.
 * 
 * @returns Starting environment
 */
export function createInitialEnvironment(): Environment {
  return {
    tick: 0,
    temperature: 20, // Pleasant 20°C
    sunlight: 0.5,   // Midday sun
    moisture: 0.5    // Moderate moisture
  };
}

/**
 * Check if environmental conditions are favorable for life.
 * 
 * @param environment - Current environment
 * @returns True if conditions support life
 */
export function areConditionsHabitable(environment: Environment): boolean {
  // Life can exist in a wide range, but extremes are dangerous
  return (
    environment.temperature >= 0 &&
    environment.temperature <= 40 &&
    environment.moisture >= 0 &&
    environment.moisture <= 1
  );
}
