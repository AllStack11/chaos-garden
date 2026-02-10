import { describe, expect, it } from 'vitest';
import { createLightingContext, getTimePhaseFromSunlight } from './lighting.ts';

describe('rendering/lighting', () => {
  it('maps sunlight thresholds to the expected time phases', () => {
    expect(getTimePhaseFromSunlight(0.19)).toBe('night');
    expect(getTimePhaseFromSunlight(0.2)).toBe('dawn');
    expect(getTimePhaseFromSunlight(0.45)).toBe('day');
    expect(getTimePhaseFromSunlight(0.75)).toBe('dusk');
  });

  it('clamps sunlight and computes stable baseline lighting values', () => {
    const lowSunlight = createLightingContext(-1, 96);
    const highSunlight = createLightingContext(2, 48);

    expect(lowSunlight.sunlight).toBe(0);
    expect(lowSunlight.ambientLevel).toBeCloseTo(0.2);
    expect(lowSunlight.sunDirection).toBeCloseTo(0);

    expect(highSunlight.sunlight).toBe(1);
    expect(highSunlight.ambientLevel).toBeCloseTo(1);
    expect(highSunlight.sunDirection).toBeCloseTo(Math.PI);
  });

  it('applies weather-specific adjustments on top of baseline values', () => {
    const baseline = createLightingContext(0.6, 24);
    const storm = createLightingContext(0.6, 24, 'STORM');
    const fog = createLightingContext(0.6, 24, 'FOG');
    const drought = createLightingContext(0.6, 24, 'DROUGHT');

    expect(storm.fogDensity).toBeGreaterThan(baseline.fogDensity);
    expect(storm.shadowStrength).toBeGreaterThan(baseline.shadowStrength);
    expect(storm.bloomFactor).toBeLessThan(baseline.bloomFactor);

    expect(fog.fogDensity).toBeGreaterThan(storm.fogDensity - 0.01);
    expect(drought.bloomFactor).toBeGreaterThan(baseline.bloomFactor);
  });
});
