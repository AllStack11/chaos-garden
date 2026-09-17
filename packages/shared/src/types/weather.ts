/**
 * Chaos Garden - Atmospheric & Weather State Types
 * 
 * Governs diurnal sunlight cycles, Markov chain weather patterns,
 * and environmental modifiers affecting metabolism and soil moisture.
 */

import type { Vector2D } from './spatial.js';

export type WeatherStateName =
  | 'CLEAR'
  | 'OVERCAST'
  | 'RAIN'
  | 'STORM'
  | 'DROUGHT'
  | 'FOG';

export interface WeatherModifiers {
  /** Temperature delta in degrees Celsius (-10 to +10) */
  temperatureOffset: number;
  /** Sunlight intensity scaling (0.0 to 1.5) */
  sunlightMultiplier: number;
  /** Soil moisture delta applied across the terrain per tick */
  moistureChangePerTick: number;
  /** Plant energy conversion multiplier */
  photosynthesisModifier: number;
  /** Terrestrial movement resistance multiplier (e.g. mud in storm) */
  movementModifier: number;
  /** Reproduction rate modifier */
  reproductionModifier: number;
  /** Atmospheric wind vector pushing spores and seeds */
  windVector: Vector2D;
}

export interface ActiveWeatherState {
  currentState: WeatherStateName;
  stateEnteredAtTick: number;
  plannedDurationTicks: number;
  previousState: WeatherStateName | null;
  transitionProgressTicks: number;
  modifiers: WeatherModifiers;
}

export interface AtmosphericState {
  /** Ambient temperature in Celsius (0 - 40°C) */
  temperature: number;
  /** Sunlight intensity (0.0 = night, 1.0 = peak zenith) */
  sunlight: number;
  /** Humidity / atmospheric moisture (0.0 - 1.0) */
  humidity: number;
  /** Diurnal time phase */
  timePhase: 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';
  /** Active weather system */
  weather: ActiveWeatherState;
}

export const DEFAULT_ATMOSPHERIC_STATE: AtmosphericState = {
  temperature: 21.0,
  sunlight: 0.8,
  humidity: 0.5,
  timePhase: 'DAY',
  weather: {
    currentState: 'CLEAR',
    stateEnteredAtTick: 0,
    plannedDurationTicks: 1200,
    previousState: null,
    transitionProgressTicks: 0,
    modifiers: {
      temperatureOffset: 0,
      sunlightMultiplier: 1.0,
      moistureChangePerTick: -0.0005,
      photosynthesisModifier: 1.0,
      movementModifier: 1.0,
      reproductionModifier: 1.0,
      windVector: { x: 0.5, y: 0.0 },
    },
  },
};

