import { describe, expect, it, vi } from 'vitest';
import type { ActiveWeatherState, Environment, WeatherStateModifiers } from '@chaos-garden/shared';
import {
  applyWeatherModifiersToEnvironment,
  calculateInterpolatedWeatherModifiers,
  getEffectiveWeatherModifiersFromEnvironment,
  shouldWeatherStateTransitionThisTick
} from '../../../../src/simulation/environment/weather-state-machine';
import { getWeatherStateDefinition } from '../../../../src/simulation/environment/weather-state-definitions';
import { updateEnvironmentForNextTick } from '../../../../src/simulation/environment/weather-updater';

function buildWeatherState(overrides: Partial<ActiveWeatherState> = {}): ActiveWeatherState {
  return {
    currentState: 'CLEAR',
    stateEnteredAtTick: 0,
    plannedDurationTicks: 30,
    previousState: null,
    transitionProgressTicks: 0,
    ...overrides,
  };
}

function buildEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    tick: 20,
    temperature: 20,
    sunlight: 0.35,
    moisture: 0.5,
    weatherState: buildWeatherState(),
    ...overrides,
  };
}

function buildModifiers(overrides: Partial<WeatherStateModifiers> = {}): WeatherStateModifiers {
  return {
    temperatureOffset: 0,
    sunlightMultiplier: 1,
    moistureChangePerTick: 0,
    photosynthesisModifier: 1,
    movementModifier: 1,
    reproductionModifier: 1,
    ...overrides,
  };
}

describe('simulation/environment/weather-engine', () => {
  it('keeps environment values inside hard safety bounds', () => {
    const updated = applyWeatherModifiersToEnvironment(
      2,
      100,
      -0.5,
      buildModifiers({ sunlightMultiplier: 2, moistureChangePerTick: -0.9, temperatureOffset: 80 })
    );

    expect(updated.sunlight).toBeGreaterThanOrEqual(0);
    expect(updated.sunlight).toBeLessThanOrEqual(1);
    expect(updated.temperature).toBeGreaterThanOrEqual(0);
    expect(updated.temperature).toBeLessThanOrEqual(40);
    expect(updated.moisture).toBeGreaterThanOrEqual(0);
    expect(updated.moisture).toBeLessThanOrEqual(1);
  });

  it('applies stronger moisture loss under high sunlight than low sunlight', () => {
    const lowSun = applyWeatherModifiersToEnvironment(
      0.2,
      20,
      0.6,
      buildModifiers({ moistureChangePerTick: 0 })
    );

    const highSun = applyWeatherModifiersToEnvironment(
      0.95,
      20,
      0.6,
      buildModifiers({ moistureChangePerTick: 0 })
    );

    expect(highSun.moisture).toBeLessThan(lowSun.moisture);
  });

  it('allows slight moisture recovery under very low sunlight', () => {
    const dark = applyWeatherModifiersToEnvironment(
      0.05,
      20,
      0.5,
      buildModifiers({ moistureChangePerTick: 0 })
    );

    const dim = applyWeatherModifiersToEnvironment(
      0.4,
      20,
      0.5,
      buildModifiers({ moistureChangePerTick: 0 })
    );

    expect(dark.moisture).toBeGreaterThan(dim.moisture);
  });

  it('warms on drying and cools on wetting with all else equal', () => {
    const drying = applyWeatherModifiersToEnvironment(
      0.5,
      20,
      0.5,
      buildModifiers({ moistureChangePerTick: -0.02 })
    );

    const wetting = applyWeatherModifiersToEnvironment(
      0.5,
      20,
      0.5,
      buildModifiers({ moistureChangePerTick: 0.02 })
    );

    expect(drying.temperature).toBeGreaterThan(wetting.temperature);
  });

  it('prevents clear-sky sunrise regression where sunlight rises while temperature also drops', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const current = buildEnvironment({
      tick: 20,
      temperature: 20,
      sunlight: 0.35,
      moisture: 0.5,
      weatherState: buildWeatherState({
        currentState: 'CLEAR',
        plannedDurationTicks: 999,
        stateEnteredAtTick: 0,
      }),
    });

    const updated = await updateEnvironmentForNextTick(current);

    expect(updated.sunlight).toBeGreaterThan(current.sunlight);
    expect(updated.moisture).toBeLessThan(current.moisture);
    expect(updated.temperature).toBeGreaterThanOrEqual(current.temperature);
  });

  it('keeps storm dynamics coherent: dimmer light, cooler air, rising moisture', () => {
    const stormModifiers = getWeatherStateDefinition('STORM').modifiers;
    const updated = applyWeatherModifiersToEnvironment(0.9, 24, 0.4, stormModifiers);

    expect(updated.sunlight).toBeLessThan(0.5);
    expect(updated.temperature).toBeLessThan(24);
    expect(updated.moisture).toBeGreaterThan(0.4);
  });

  it('transitions only after planned duration elapses', () => {
    const state = buildWeatherState({ stateEnteredAtTick: 10, plannedDurationTicks: 6 });
    expect(shouldWeatherStateTransitionThisTick(state, 15)).toBe(false);
    expect(shouldWeatherStateTransitionThisTick(state, 16)).toBe(true);
  });

  it('interpolates modifiers between previous and current state during transition', () => {
    const transitioningState = buildWeatherState({
      currentState: 'DROUGHT',
      previousState: 'RAIN',
      transitionProgressTicks: 3,
    });

    const interpolated = calculateInterpolatedWeatherModifiers(transitioningState);
    const rain = getWeatherStateDefinition('RAIN').modifiers;
    const drought = getWeatherStateDefinition('DROUGHT').modifiers;

    expect(interpolated.temperatureOffset).toBeGreaterThan(rain.temperatureOffset);
    expect(interpolated.temperatureOffset).toBeLessThan(drought.temperatureOffset);
    expect(interpolated.sunlightMultiplier).toBeGreaterThan(rain.sunlightMultiplier);
    expect(interpolated.sunlightMultiplier).toBeLessThan(drought.sunlightMultiplier);
  });

  it('returns neutral weather modifiers for legacy environments with no weather state', () => {
    const legacyEnvironment: Environment = buildEnvironment({ weatherState: null });
    const modifiers = getEffectiveWeatherModifiersFromEnvironment(legacyEnvironment);

    expect(modifiers.temperatureOffset).toBe(0);
    expect(modifiers.sunlightMultiplier).toBe(1);
    expect(modifiers.moistureChangePerTick).toBe(0);
  });
});
