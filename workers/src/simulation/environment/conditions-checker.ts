/**
 * Conditions Checker
 * 
 * Evaluates environmental conditions for habitability and suitability—
 * determining whether life can survive and thrive in the current climate.
 * 
 * These checks form the boundary conditions of our ecosystem,
 * defining the limits within which digital life can persist.
 */

import type { Environment } from '@chaos-garden/shared';
import {
  MINIMUM_TEMPERATURE_FOR_LIFE,
  MAXIMUM_TEMPERATURE_FOR_LIFE,
  MINIMUM_MOISTURE_FOR_LIFE,
  MAXIMUM_MOISTURE_FOR_LIFE,
  IDEAL_TEMPERATURE,
  IDEAL_MOISTURE_FOR_PLANTS
} from './constants';
import { calculateSunlightForTick } from './sunlight-calculator';

/**
 * Create the initial environment for a new garden.
 * 
 * @returns Starting environment with balanced conditions
 */
export function createInitialEnvironment(): Environment {
  const initialTick = 0;
  return {
    tick: initialTick,
    temperature: IDEAL_TEMPERATURE, // Pleasant 20°C
    sunlight: calculateSunlightForTick(initialTick),
    moisture: IDEAL_MOISTURE_FOR_PLANTS, // Moderate moisture
    weatherState: null
  };
}

/**
 * Check if environmental conditions are favorable for life.
 * 
 * @param environment - Current environment
 * @returns True if conditions support basic life
 */
export function areConditionsHabitable(environment: Environment): boolean {
  return (
    environment.temperature >= MINIMUM_TEMPERATURE_FOR_LIFE &&
    environment.temperature <= MAXIMUM_TEMPERATURE_FOR_LIFE &&
    environment.moisture >= MINIMUM_MOISTURE_FOR_LIFE &&
    environment.moisture <= MAXIMUM_MOISTURE_FOR_LIFE
  );
}

/**
 * Check if conditions are optimal for plant growth.
 * 
 * @param environment - Current environment
 * @returns True if conditions are ideal for plants
 */
export function areConditionsOptimalForPlants(environment: Environment): boolean {
  const temperatureOptimal = Math.abs(environment.temperature - IDEAL_TEMPERATURE) <= 5;
  const moistureOptimal = Math.abs(environment.moisture - IDEAL_MOISTURE_FOR_PLANTS) <= 0.2;
  
  return temperatureOptimal && moistureOptimal && environment.sunlight > 0.3;
}

/**
 * Calculate a habitability score (0-100).
 * Higher scores indicate better conditions for life.
 * 
 * @param environment - Current environment
 * @returns Habitability score (0-100)
 */
export function calculateHabitabilityScore(environment: Environment): number {
  if (!areConditionsHabitable(environment)) {
    return 0;
  }
  
  // Temperature score (0-50 points)
  const tempRange = MAXIMUM_TEMPERATURE_FOR_LIFE - MINIMUM_TEMPERATURE_FOR_LIFE;
  const tempDeviation = Math.abs(environment.temperature - IDEAL_TEMPERATURE);
  const tempScore = 50 * (1 - (tempDeviation / (tempRange / 2)));
  
  // Moisture score (0-30 points)
  const moistureRange = MAXIMUM_MOISTURE_FOR_LIFE - MINIMUM_MOISTURE_FOR_LIFE;
  const moistureDeviation = Math.abs(environment.moisture - IDEAL_MOISTURE_FOR_PLANTS);
  const moistureScore = 30 * (1 - (moistureDeviation / (moistureRange / 2)));
  
  // Sunlight score (0-20 points)
  const sunlightScore = 20 * environment.sunlight;
  
  return Math.round(tempScore + moistureScore + sunlightScore);
}

/**
 * Get a descriptive label for current conditions.
 * 
 * @param environment - Current environment
 * @returns Human-readable condition description
 */
export function getConditionDescription(environment: Environment): string {
  if (!areConditionsHabitable(environment)) {
    return 'Lethal';
  }
  
  const score = calculateHabitabilityScore(environment);
  
  if (score >= 80) return 'Optimal';
  if (score >= 60) return 'Favorable';
  if (score >= 40) return 'Tolerable';
  if (score >= 20) return 'Stressful';
  return 'Harsh';
}

/**
 * Check if conditions are improving or deteriorating.
 * 
 * @param previous - Previous environment state
 * @param current - Current environment state
 * @returns 'improving', 'deteriorating', or 'stable'
 */
export function getConditionTrend(
  previous: Environment,
  current: Environment
): 'improving' | 'deteriorating' | 'stable' {
  const previousScore = calculateHabitabilityScore(previous);
  const currentScore = calculateHabitabilityScore(current);
  
  const difference = currentScore - previousScore;
  
  if (difference > 5) return 'improving';
  if (difference < -5) return 'deteriorating';
  return 'stable';
}

/**
 * Check if conditions are within survival range for a specific temperature.
 * 
 * @param temperature - Temperature to check
 * @returns True if temperature supports life
 */
export function isTemperatureWithinSurvivalRange(temperature: number): boolean {
  return temperature >= MINIMUM_TEMPERATURE_FOR_LIFE && temperature <= MAXIMUM_TEMPERATURE_FOR_LIFE;
}

/**
 * Check if moisture level is within survival range.
 * 
 * @param moisture - Moisture level to check (0-1)
 * @returns True if moisture supports life
 */
export function isMoistureWithinSurvivalRange(moisture: number): boolean {
  return moisture >= MINIMUM_MOISTURE_FOR_LIFE && moisture <= MAXIMUM_MOISTURE_FOR_LIFE;
}

/**
 * Calculate how many ticks until conditions become lethal.
 * 
 * @param environment - Current environment
 * @param trend - Current trend (improving/deteriorating/stable)
 * @returns Estimated ticks until lethal conditions, or Infinity if safe
 */
export function estimateTicksUntilLethalConditions(
  environment: Environment,
  trend: 'improving' | 'deteriorating' | 'stable'
): number {
  if (trend === 'improving') {
    return Infinity; // Conditions getting better
  }
  
  if (trend === 'stable' && areConditionsHabitable(environment)) {
    return Infinity; // Stable and habitable
  }
  
  // Calculate worst-case deterioration
  const score = calculateHabitabilityScore(environment);
  const ticksPerPoint = trend === 'deteriorating' ? 2 : 10; // Faster if already deteriorating
  
  return Math.max(1, Math.floor(score / ticksPerPoint));
}
