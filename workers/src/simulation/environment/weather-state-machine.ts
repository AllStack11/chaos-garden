/**
 * Weather State Machine
 *
 * The engine that drives weather transitions and applies
 * atmospheric modifiers to the garden's environment.
 * Weather states follow a Markov chain with weighted transitions,
 * smooth interpolation between states, and coherent effects
 * on temperature, sunlight, moisture, and creature behavior.
 */

import type {
  ActiveWeatherState,
  WeatherStateName,
  WeatherStateModifiers,
  Environment
} from '@chaos-garden/shared';
import {
  WEATHER_STATE_DEFINITIONS,
  WEATHER_TRANSITION_INTERPOLATION_TICKS,
  getWeatherStateDefinition,
  getDefaultInitialWeatherState
} from './weather-state-definitions';
import { clampValueToRange, generateRandomValueInRange } from './helpers';
import {
  MINIMUM_TEMPERATURE_FOR_LIFE,
  MAXIMUM_TEMPERATURE_FOR_LIFE,
  MINIMUM_MOISTURE_FOR_LIFE,
  MAXIMUM_MOISTURE_FOR_LIFE
} from './constants';

/** Neutral modifiers that have no effect (used for backward compatibility) */
const NEUTRAL_WEATHER_MODIFIERS: WeatherStateModifiers = {
  temperatureOffset: 0,
  sunlightMultiplier: 1.0,
  moistureChangePerTick: 0,
  photosynthesisModifier: 1.0,
  movementModifier: 1.0,
  reproductionModifier: 1.0,
};

/**
 * Determine if the current weather state has lasted long enough to transition.
 */
export function shouldWeatherStateTransitionThisTick(
  activeState: ActiveWeatherState,
  currentTick: number
): boolean {
  const ticksElapsed = currentTick - activeState.stateEnteredAtTick;
  return ticksElapsed >= activeState.plannedDurationTicks;
}

/**
 * Select the next weather state using weighted random selection
 * from the current state's transition table.
 */
export function selectNextWeatherStateFromTransitions(
  currentStateName: WeatherStateName
): WeatherStateName {
  const definition = getWeatherStateDefinition(currentStateName);
  const transitions = definition.transitions;

  const totalWeight = transitions.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const transition of transitions) {
    roll -= transition.weight;
    if (roll <= 0) {
      return transition.targetState;
    }
  }

  // Fallback to last transition (should not happen with valid weights)
  return transitions[transitions.length - 1].targetState;
}

/**
 * Create a new ActiveWeatherState when transitioning between states.
 * Randomizes the planned duration within the new state's range.
 */
export function createTransitionedWeatherState(
  previousStateName: WeatherStateName,
  nextStateName: WeatherStateName,
  currentTick: number
): ActiveWeatherState {
  const nextDefinition = getWeatherStateDefinition(nextStateName);
  const plannedDuration = Math.floor(
    generateRandomValueInRange(
      nextDefinition.minimumDurationTicks,
      nextDefinition.maximumDurationTicks
    )
  );

  return {
    currentState: nextStateName,
    stateEnteredAtTick: currentTick,
    plannedDurationTicks: plannedDuration,
    previousState: previousStateName,
    transitionProgressTicks: 0,
  };
}

/**
 * Calculate the interpolated modifiers during a transition period.
 * Blends linearly between previous and current state modifiers.
 * Returns current state modifiers if no transition is in progress.
 */
export function calculateInterpolatedWeatherModifiers(
  activeState: ActiveWeatherState
): WeatherStateModifiers {
  const currentModifiers = getWeatherStateDefinition(activeState.currentState).modifiers;

  if (
    activeState.previousState === null ||
    activeState.transitionProgressTicks >= WEATHER_TRANSITION_INTERPOLATION_TICKS
  ) {
    return currentModifiers;
  }

  const previousModifiers = getWeatherStateDefinition(activeState.previousState).modifiers;
  const t = activeState.transitionProgressTicks / WEATHER_TRANSITION_INTERPOLATION_TICKS;

  return {
    temperatureOffset: previousModifiers.temperatureOffset * (1 - t) + currentModifiers.temperatureOffset * t,
    sunlightMultiplier: previousModifiers.sunlightMultiplier * (1 - t) + currentModifiers.sunlightMultiplier * t,
    moistureChangePerTick: previousModifiers.moistureChangePerTick * (1 - t) + currentModifiers.moistureChangePerTick * t,
    photosynthesisModifier: previousModifiers.photosynthesisModifier * (1 - t) + currentModifiers.photosynthesisModifier * t,
    movementModifier: previousModifiers.movementModifier * (1 - t) + currentModifiers.movementModifier * t,
    reproductionModifier: previousModifiers.reproductionModifier * (1 - t) + currentModifiers.reproductionModifier * t,
  };
}

/**
 * Apply weather modifiers to raw environment values.
 * Sunlight is multiplied, temperature is offset, moisture drifts.
 */
export function applyWeatherModifiersToEnvironment(
  baseSunlight: number,
  baseTemperature: number,
  currentMoisture: number,
  modifiers: WeatherStateModifiers
): { temperature: number; sunlight: number; moisture: number } {
  const sunlight = clampValueToRange(
    baseSunlight * modifiers.sunlightMultiplier,
    0,
    1
  );

  const temperature = clampValueToRange(
    baseTemperature + modifiers.temperatureOffset,
    MINIMUM_TEMPERATURE_FOR_LIFE,
    MAXIMUM_TEMPERATURE_FOR_LIFE
  );

  const moisture = clampValueToRange(
    currentMoisture + modifiers.moistureChangePerTick,
    MINIMUM_MOISTURE_FOR_LIFE,
    MAXIMUM_MOISTURE_FOR_LIFE
  );

  return { temperature, sunlight, moisture };
}

/**
 * Advance the weather state for the next tick.
 * Handles transition checks, state selection, and interpolation progress.
 */
export function advanceWeatherStateForTick(
  currentWeatherState: ActiveWeatherState,
  currentTick: number
): { weatherState: ActiveWeatherState; transitionOccurred: boolean; newStateName?: WeatherStateName } {
  // Check if it's time to transition
  if (shouldWeatherStateTransitionThisTick(currentWeatherState, currentTick)) {
    const nextStateName = selectNextWeatherStateFromTransitions(currentWeatherState.currentState);
    const newState = createTransitionedWeatherState(
      currentWeatherState.currentState,
      nextStateName,
      currentTick
    );
    return { weatherState: newState, transitionOccurred: true, newStateName: nextStateName };
  }

  // Advance interpolation progress if still in transition
  const updatedState = { ...currentWeatherState };
  if (
    updatedState.previousState !== null &&
    updatedState.transitionProgressTicks < WEATHER_TRANSITION_INTERPOLATION_TICKS
  ) {
    updatedState.transitionProgressTicks += 1;
  }

  return { weatherState: updatedState, transitionOccurred: false };
}

/**
 * Extract effective weather modifiers from an environment.
 * Returns neutral (1.0) modifiers if no weather state is present,
 * ensuring backward compatibility with pre-weather environments.
 */
export function getEffectiveWeatherModifiersFromEnvironment(
  environment: Environment
): WeatherStateModifiers {
  if (!environment.weatherState) {
    return NEUTRAL_WEATHER_MODIFIERS;
  }
  return calculateInterpolatedWeatherModifiers(environment.weatherState);
}
