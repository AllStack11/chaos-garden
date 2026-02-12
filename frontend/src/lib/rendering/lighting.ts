import type { LightingContext, TimePhase } from './types.ts';

export function getTimePhaseFromSunlight(sunlight: number): TimePhase {
  if (sunlight < 0.2) return 'night';
  if (sunlight < 0.45) return 'dawn';
  if (sunlight < 0.75) return 'day';
  return 'dusk';
}

export function createLightingContext(sunlight: number, tick: number, weatherStateName?: string): LightingContext {
  const normalizedSunlight = Math.max(0, Math.min(1, sunlight));
  const dayProgress = tick % 96 / 96;
  const sunDirection = Math.PI * 2 * dayProgress;
  const ambientLevel = 0.2 + normalizedSunlight * 0.8;

  let fogDensity = 0.05 + (1 - normalizedSunlight) * 0.2;
  let shadowStrength = 0.2 + (1 - normalizedSunlight) * 0.55;
  let bloomFactor = 0.08 + normalizedSunlight * 0.22;

  // Weather-specific lighting adjustments
  if (weatherStateName) {
    switch (weatherStateName) {
      case 'STORM':
        fogDensity += 0.25;
        shadowStrength += 0.35;
        bloomFactor *= 0.3;
        break;
      case 'FOG':
        fogDensity += 0.45;
        bloomFactor *= 0.4;
        break;
      case 'RAIN':
        fogDensity += 0.15;
        shadowStrength += 0.2;
        bloomFactor *= 0.6;
        break;
      case 'OVERCAST':
        fogDensity += 0.12;
        shadowStrength += 0.1;
        bloomFactor *= 0.8;
        break;
      case 'DROUGHT':
        bloomFactor += 0.15;
        shadowStrength -= 0.1;
        break;
    }
  }

  return {
    sunlight: normalizedSunlight,
    ambientLevel,
    sunDirection,
    colorTemperature: 2800 + normalizedSunlight * 3500,
    fogDensity,
    shadowStrength,
    bloomFactor,
  };
}
