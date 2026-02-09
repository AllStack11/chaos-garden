/**
 * Weather Updater
 * 
 * Simulates weather patterns and climate changes over time—
 * the atmospheric engine that drives environmental evolution.
 * 
 * Weather in our garden follows semi-random patterns,
 * with gradual changes punctuated by sudden shifts,
 * much like real-world meteorological systems.
 */

import type { Environment } from '@chaos-garden/shared';
import type { EventLogger } from '../../logging/event-logger';
import { clampValueToRange, willRandomEventOccur, generateRandomValueInRange } from './helpers';
import { calculateSunlightForTick } from './sunlight-calculator';
import {
  WEATHER_CHANGE_PROBABILITY,
  MAX_TEMPERATURE_CHANGE,
  MAX_MOISTURE_CHANGE,
  MINIMUM_TEMPERATURE_FOR_LIFE,
  MAXIMUM_TEMPERATURE_FOR_LIFE,
  MINIMUM_MOISTURE_FOR_LIFE,
  MAXIMUM_MOISTURE_FOR_LIFE,
  DROUGHT_THRESHOLD,
  HEAVY_RAIN_THRESHOLD,
  HEAT_WAVE_THRESHOLD,
  FREEZE_THRESHOLD
} from './constants';

/**
 * Update the environment for the next tick.
 * Simulates weather patterns, temperature changes, and seasonal cycles.
 * 
 * @param current - Current environment state
 * @param eventLogger - Logger for environmental events
 * @returns Updated environment
 */
export async function updateEnvironmentForNextTick(
  current: Environment,
  eventLogger?: EventLogger
): Promise<Environment> {
  const nextTick = current.tick + 1;
  
  // Calculate sunlight based on time of day
  const sunlight = calculateSunlightForTick(nextTick);
  
  // Temperature drifts randomly but stays within bounds
  let temperature = current.temperature;
  if (willRandomEventOccur(WEATHER_CHANGE_PROBABILITY)) {
    const change = generateRandomValueInRange(-MAX_TEMPERATURE_CHANGE, MAX_TEMPERATURE_CHANGE);
    temperature = clampValueToRange(
      temperature + change, 
      MINIMUM_TEMPERATURE_FOR_LIFE, 
      MAXIMUM_TEMPERATURE_FOR_LIFE
    );
  }
  
  // Moisture drifts randomly
  let moisture = current.moisture;
  if (willRandomEventOccur(WEATHER_CHANGE_PROBABILITY)) {
    const change = generateRandomValueInRange(-MAX_MOISTURE_CHANGE, MAX_MOISTURE_CHANGE);
    moisture = clampValueToRange(
      moisture + change, 
      MINIMUM_MOISTURE_FOR_LIFE, 
      MAXIMUM_MOISTURE_FOR_LIFE
    );
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
    await logEnvironmentalChanges(current, updated, eventLogger);
  }
  
  return updated;
}

/**
 * Log significant environmental changes.
 * Detects and reports notable weather events.
 */
async function logEnvironmentalChanges(
  previous: Environment,
  current: Environment,
  eventLogger: EventLogger
): Promise<void> {
  // Detect drought (low moisture)
  if (previous.moisture > DROUGHT_THRESHOLD && current.moisture <= DROUGHT_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Drought conditions detected! Moisture dropped to ${(current.moisture * 100).toFixed(1)}%`
    );
  }
  
  // Detect heavy rain (high moisture)
  if (previous.moisture < HEAVY_RAIN_THRESHOLD && current.moisture >= HEAVY_RAIN_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Heavy rainfall! Moisture increased to ${(current.moisture * 100).toFixed(1)}%`
    );
  }
  
  // Detect heat wave
  if (previous.temperature < HEAT_WAVE_THRESHOLD && current.temperature >= HEAT_WAVE_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Heat wave! Temperature reached ${current.temperature.toFixed(1)}°C`
    );
  }
  
  // Detect freeze
  if (previous.temperature > FREEZE_THRESHOLD && current.temperature <= FREEZE_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Freeze warning! Temperature dropped to ${current.temperature.toFixed(1)}°C`
    );
  }
  
  // Detect rapid temperature change
  const tempChange = Math.abs(current.temperature - previous.temperature);
  if (tempChange > 5) {
    await eventLogger.logEnvironmentChange(
      `Rapid temperature change: ${previous.temperature.toFixed(1)}°C → ${current.temperature.toFixed(1)}°C`
    );
  }
  
  // Detect rapid moisture change
  const moistureChange = Math.abs(current.moisture - previous.moisture);
  if (moistureChange > 0.2) {
    await eventLogger.logEnvironmentChange(
      `Rapid moisture change: ${(previous.moisture * 100).toFixed(1)}% → ${(current.moisture * 100).toFixed(1)}%`
    );
  }
}

/**
 * Generate a random weather event.
 * Creates dramatic environmental shifts for variety.
 * 
 * @param current - Current environment
 * @param eventLogger - Logger for events
 * @returns Environment with weather event applied
 */
export async function generateRandomWeatherEvent(
  current: Environment,
  eventLogger?: EventLogger
): Promise<Environment> {
  const eventType = Math.floor(Math.random() * 4);
  
  let newTemperature = current.temperature;
  let newMoisture = current.moisture;
  let eventDescription = '';
  
  switch (eventType) {
    case 0: // Heat spike
      newTemperature = clampValueToRange(current.temperature + 10, MINIMUM_TEMPERATURE_FOR_LIFE, MAXIMUM_TEMPERATURE_FOR_LIFE);
      eventDescription = `Heat spike! Temperature jumped to ${newTemperature.toFixed(1)}°C`;
      break;
      
    case 1: // Cold snap
      newTemperature = clampValueToRange(current.temperature - 10, MINIMUM_TEMPERATURE_FOR_LIFE, MAXIMUM_TEMPERATURE_FOR_LIFE);
      eventDescription = `Cold snap! Temperature dropped to ${newTemperature.toFixed(1)}°C`;
      break;
      
    case 2: // Rainstorm
      newMoisture = clampValueToRange(current.moisture + 0.3, MINIMUM_MOISTURE_FOR_LIFE, MAXIMUM_MOISTURE_FOR_LIFE);
      eventDescription = `Rainstorm! Moisture increased to ${(newMoisture * 100).toFixed(1)}%`;
      break;
      
    case 3: // Dry spell
      newMoisture = clampValueToRange(current.moisture - 0.3, MINIMUM_MOISTURE_FOR_LIFE, MAXIMUM_MOISTURE_FOR_LIFE);
      eventDescription = `Dry spell! Moisture decreased to ${(newMoisture * 100).toFixed(1)}%`;
      break;
  }
  
  const updated: Environment = {
    ...current,
    temperature: newTemperature,
    moisture: newMoisture
  };
  
  if (eventLogger && eventDescription) {
    await eventLogger.logEnvironmentChange(eventDescription);
  }
  
  return updated;
}

/**
 * Check if a weather event should occur this tick.
 * 
 * @returns True if a random weather event should occur
 */
export function shouldWeatherEventOccur(): boolean {
  // 1% chance per tick of a dramatic weather event
  return willRandomEventOccur(0.01);
}
