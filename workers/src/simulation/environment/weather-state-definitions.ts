/**
 * Weather State Definitions
 *
 * The atmospheric archetypes that shape the garden's climate.
 * Each weather state is a complete description of conditions:
 * how long it lasts, how it modifies the environment, and
 * which states it naturally transitions into.
 */

import type {
  WeatherStateName,
  WeatherStateDefinition,
  ActiveWeatherState
} from '@chaos-garden/shared';

/** Number of ticks over which weather transitions interpolate smoothly */
export const WEATHER_TRANSITION_INTERPOLATION_TICKS = 6;

/** Small random temperature jitter per tick (replaces old +/-2.0 random drift) */
export const WEATHER_TEMPERATURE_JITTER_RANGE = 0.3;

/** Temperature time-of-day amplitude (peak offset at midday vs midnight) */
export const TEMPERATURE_DIURNAL_AMPLITUDE = 3.0;

/** Base temperature around which diurnal cycle oscillates */
export const TEMPERATURE_DIURNAL_BASELINE = 20.0;

/**
 * Complete definition of all six weather states.
 * Modifiers influence (not replace) baseline environment values.
 */
export const WEATHER_STATE_DEFINITIONS: Record<WeatherStateName, WeatherStateDefinition> = {
  CLEAR: {
    name: 'CLEAR',
    displayLabel: 'Clear',
    minimumDurationTicks: 12,
    maximumDurationTicks: 48,
    modifiers: {
      temperatureOffset: 0.0,
      sunlightMultiplier: 1.0,
      moistureChangePerTick: -0.005,
      photosynthesisModifier: 1.0,
      movementModifier: 1.0,
      reproductionModifier: 1.0,
    },
    transitions: [
      { targetState: 'OVERCAST', weight: 30 },
      { targetState: 'DROUGHT', weight: 6 },
      { targetState: 'FOG', weight: 15 },
    ],
  },

  OVERCAST: {
    name: 'OVERCAST',
    displayLabel: 'Overcast',
    minimumDurationTicks: 8,
    maximumDurationTicks: 36,
    modifiers: {
      temperatureOffset: -1.0,
      sunlightMultiplier: 0.65,
      moistureChangePerTick: 0.002,
      photosynthesisModifier: 0.8,
      movementModifier: 1.0,
      reproductionModifier: 0.95,
    },
    transitions: [
      { targetState: 'CLEAR', weight: 20 },
      { targetState: 'RAIN', weight: 35 },
      { targetState: 'DROUGHT', weight: 6 },
      { targetState: 'FOG', weight: 15 },
    ],
  },

  RAIN: {
    name: 'RAIN',
    displayLabel: 'Rain',
    minimumDurationTicks: 6,
    maximumDurationTicks: 24,
    modifiers: {
      temperatureOffset: -2.0,
      sunlightMultiplier: 0.4,
      moistureChangePerTick: 0.015,
      photosynthesisModifier: 0.6,
      movementModifier: 0.75,
      reproductionModifier: 0.85,
    },
    transitions: [
      { targetState: 'CLEAR', weight: 10 },
      { targetState: 'OVERCAST', weight: 30 },
      { targetState: 'STORM', weight: 16 },
      { targetState: 'FOG', weight: 5 },
    ],
  },

  STORM: {
    name: 'STORM',
    displayLabel: 'Storm',
    minimumDurationTicks: 3,
    maximumDurationTicks: 8,
    modifiers: {
      temperatureOffset: -4.0,
      sunlightMultiplier: 0.15,
      moistureChangePerTick: 0.03,
      photosynthesisModifier: 0.3,
      movementModifier: 0.5,
      reproductionModifier: 0.6,
    },
    transitions: [
      { targetState: 'OVERCAST', weight: 50 },
      { targetState: 'RAIN', weight: 20 },
      { targetState: 'FOG', weight: 5 },
    ],
  },

  DROUGHT: {
    name: 'DROUGHT',
    displayLabel: 'Drought',
    minimumDurationTicks: 12,
    maximumDurationTicks: 48,
    modifiers: {
      temperatureOffset: 3.0,
      sunlightMultiplier: 1.1,
      moistureChangePerTick: -0.015,
      photosynthesisModifier: 0.75,
      movementModifier: 0.92,
      reproductionModifier: 0.85,
    },
    transitions: [
      { targetState: 'CLEAR', weight: 40 },
      { targetState: 'OVERCAST', weight: 20 },
      { targetState: 'FOG', weight: 5 },
    ],
  },

  FOG: {
    name: 'FOG',
    displayLabel: 'Fog',
    minimumDurationTicks: 8,
    maximumDurationTicks: 24,
    modifiers: {
      temperatureOffset: -0.5,
      sunlightMultiplier: 0.5,
      moistureChangePerTick: 0.005,
      photosynthesisModifier: 0.7,
      movementModifier: 0.7,
      reproductionModifier: 0.9,
    },
    transitions: [
      { targetState: 'CLEAR', weight: 50 },
      { targetState: 'OVERCAST', weight: 25 },
      { targetState: 'RAIN', weight: 5 },
    ],
  },
};

/**
 * Retrieve the full definition for a given weather state name.
 */
export function getWeatherStateDefinition(name: WeatherStateName): WeatherStateDefinition {
  return WEATHER_STATE_DEFINITIONS[name];
}

/**
 * Create the default initial weather state for a new or legacy garden.
 * Starts with CLEAR skies at tick 0.
 */
export function getDefaultInitialWeatherState(): ActiveWeatherState {
  const clearDef = WEATHER_STATE_DEFINITIONS.CLEAR;
  return {
    currentState: 'CLEAR',
    stateEnteredAtTick: 0,
    plannedDurationTicks: Math.floor(
      (clearDef.minimumDurationTicks + clearDef.maximumDurationTicks) / 2
    ),
    previousState: null,
    transitionProgressTicks: 0,
  };
}
