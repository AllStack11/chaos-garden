import type { LightingContext, TimePhase } from './types.ts';

export function getTimePhaseFromSunlight(sunlight: number): TimePhase {
  if (sunlight < 0.2) return 'night';
  if (sunlight < 0.45) return 'dawn';
  if (sunlight < 0.75) return 'day';
  return 'dusk';
}

export function createLightingContext(sunlight: number, tick: number): LightingContext {
  const normalizedSunlight = Math.max(0, Math.min(1, sunlight));
  const dayProgress = tick % 96 / 96;
  const sunDirection = Math.PI * 2 * dayProgress;
  const ambientLevel = 0.2 + normalizedSunlight * 0.8;

  return {
    sunlight: normalizedSunlight,
    ambientLevel,
    sunDirection,
    colorTemperature: 2800 + normalizedSunlight * 3500,
    fogDensity: 0.05 + (1 - normalizedSunlight) * 0.2,
    shadowStrength: 0.2 + (1 - normalizedSunlight) * 0.55,
    bloomFactor: 0.08 + normalizedSunlight * 0.22,
  };
}
