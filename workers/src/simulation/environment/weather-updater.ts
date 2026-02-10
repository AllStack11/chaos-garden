/**
 * Weather Updater
 *
 * Drives environmental evolution through a weather state machine.
 * Each tick, the current weather state modifies sunlight, temperature,
 * and moisture coherently. States persist for multiple ticks and
 * transition naturally, creating meaningful climate patterns.
 */

import type { Environment } from '@chaos-garden/shared';
import type { EventLogger } from '../../logging/event-logger';
import { generateRandomValueInRange } from './helpers';
import { calculateSunlightForTick } from './sunlight-calculator';
import { TICKS_PER_DAY } from './constants';
import {
  WEATHER_TEMPERATURE_JITTER_RANGE,
  TEMPERATURE_DIURNAL_AMPLITUDE,
  TEMPERATURE_DIURNAL_BASELINE,
  getDefaultInitialWeatherState,
  getWeatherStateDefinition
} from './weather-state-definitions';
import {
  advanceWeatherStateForTick,
  calculateInterpolatedWeatherModifiers,
  applyWeatherModifiersToEnvironment
} from './weather-state-machine';

/**
 * Update the environment for the next tick using the weather state machine.
 * Replaces the old random-drift approach with coherent, persistent weather patterns.
 */
export async function updateEnvironmentForNextTick(
  current: Environment,
  eventLogger?: EventLogger
): Promise<Environment> {
  const nextTick = current.tick + 1;

  // Initialize weather state if absent (backward compatibility with pre-weather gardens)
  const currentWeather = current.weatherState ?? getDefaultInitialWeatherState();

  // Advance the weather state machine (may trigger a transition)
  const { weatherState: advancedWeather, transitionOccurred, newStateName } =
    advanceWeatherStateForTick(currentWeather, nextTick);

  // Calculate effective modifiers (with smooth interpolation during transitions)
  const effectiveModifiers = calculateInterpolatedWeatherModifiers(advancedWeather);

  // Calculate base sunlight from deterministic sine wave (unchanged)
  const baseSunlight = calculateSunlightForTick(nextTick);

  // Calculate base temperature from diurnal cycle + small jitter
  const baseTemperature = calculateBaseTemperatureForTick(nextTick, current.temperature);

  // Apply weather modifiers to produce final environment values
  const { temperature, sunlight, moisture } = applyWeatherModifiersToEnvironment(
    baseSunlight,
    baseTemperature,
    current.moisture,
    effectiveModifiers
  );

  const updated: Environment = {
    tick: nextTick,
    temperature,
    sunlight,
    moisture,
    weatherState: advancedWeather,
  };

  // Log weather transition events
  if (eventLogger) {
    if (transitionOccurred && newStateName) {
      const displayLabel = getWeatherStateDefinition(newStateName).displayLabel;
      const previousLabel = advancedWeather.previousState
        ? getWeatherStateDefinition(advancedWeather.previousState).displayLabel
        : 'unknown';
      await eventLogger.logEnvironmentChange(
        `Weather shifted from ${previousLabel} to ${displayLabel}. ${displayLabel} conditions settle over the garden.`
      );
    }

    await logEnvironmentalThresholdCrossings(current, updated, eventLogger);
  }

  return updated;
}

/**
 * Calculate a baseline temperature influenced by time of day.
 * Night is cooler, day is warmer. Adds a tiny random jitter
 * for natural variation without the old large random drift.
 */
function calculateBaseTemperatureForTick(
  nextTick: number,
  previousTemperature: number
): number {
  // Diurnal temperature curve: warmer at midday, cooler at midnight
  const normalizedTime = (nextTick % TICKS_PER_DAY) / TICKS_PER_DAY;
  const diurnalAngle = normalizedTime * Math.PI * 2 - Math.PI / 2;
  const diurnalOffset = Math.sin(diurnalAngle) * TEMPERATURE_DIURNAL_AMPLITUDE;
  const diurnalTarget = TEMPERATURE_DIURNAL_BASELINE + diurnalOffset;

  // Blend previous temperature toward diurnal target (slow drift, not instant snap)
  const blendFactor = 0.05;
  const blended = previousTemperature + (diurnalTarget - previousTemperature) * blendFactor;

  // Add tiny random jitter for natural variation
  const jitter = generateRandomValueInRange(
    -WEATHER_TEMPERATURE_JITTER_RANGE,
    WEATHER_TEMPERATURE_JITTER_RANGE
  );

  return blended + jitter;
}

/**
 * Log when environment crosses significant thresholds.
 * These fire independently of weather transitions for extreme conditions.
 */
async function logEnvironmentalThresholdCrossings(
  previous: Environment,
  current: Environment,
  eventLogger: EventLogger
): Promise<void> {
  const DROUGHT_THRESHOLD = 0.2;
  const HEAVY_RAIN_THRESHOLD = 0.8;
  const HEAT_WAVE_THRESHOLD = 35;
  const FREEZE_THRESHOLD = 5;

  if (previous.moisture > DROUGHT_THRESHOLD && current.moisture <= DROUGHT_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Drought conditions detected! Moisture dropped to ${(current.moisture * 100).toFixed(1)}%`
    );
  }

  if (previous.moisture < HEAVY_RAIN_THRESHOLD && current.moisture >= HEAVY_RAIN_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Heavy rainfall! Moisture increased to ${(current.moisture * 100).toFixed(1)}%`
    );
  }

  if (previous.temperature < HEAT_WAVE_THRESHOLD && current.temperature >= HEAT_WAVE_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Heat wave! Temperature reached ${current.temperature.toFixed(1)}°C`
    );
  }

  if (previous.temperature > FREEZE_THRESHOLD && current.temperature <= FREEZE_THRESHOLD) {
    await eventLogger.logEnvironmentChange(
      `Freeze warning! Temperature dropped to ${current.temperature.toFixed(1)}°C`
    );
  }
}
