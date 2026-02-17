import { describe, expect, it } from 'vitest';
import type { GardenState, SimulationEvent } from '@chaos-garden/shared';
import { deriveEventAccents, deriveSoundscapeState, scheduleSmoothedValue } from './soundscapeEngine';

function createGardenState(overrides: Partial<GardenState> = {}): GardenState {
  return {
    id: 1,
    tick: 64,
    timestamp: '2026-02-01T00:00:00.000Z',
    environment: {
      temperature: 18,
      sunlight: 0.7,
      moisture: 0.5,
      tick: 64,
      weatherState: {
        currentState: 'CLEAR',
        stateEnteredAtTick: 60,
        plannedDurationTicks: 20,
        previousState: 'OVERCAST',
        transitionProgressTicks: 4,
      },
    },
    populationSummary: {
      plants: 120,
      herbivores: 36,
      carnivores: 18,
      fungi: 24,
      deadPlants: 2,
      deadHerbivores: 1,
      deadCarnivores: 0,
      deadFungi: 0,
      allTimeDeadPlants: 50,
      allTimeDeadHerbivores: 40,
      allTimeDeadCarnivores: 12,
      allTimeDeadFungi: 20,
      total: 198,
      totalLiving: 198,
      totalDead: 3,
      allTimeDead: 122,
    },
    ...overrides,
  };
}

function createEvent(type: SimulationEvent['eventType'], severity: SimulationEvent['severity']): SimulationEvent {
  return {
    id: 1,
    gardenStateId: 1,
    tick: 64,
    timestamp: '2026-02-01T00:00:00.000Z',
    eventType: type,
    description: `${type} happened`,
    entitiesAffected: [],
    tags: [],
    severity,
  };
}

describe('audio/soundscapeEngine deriveSoundscapeState', () => {
  it('derives bounded targets from weather/daylight/population tension', () => {
    const inputState = createGardenState({
      environment: {
        ...createGardenState().environment,
        sunlight: 0.2,
        weatherState: {
          currentState: 'STORM',
          stateEnteredAtTick: 64,
          plannedDurationTicks: 12,
          previousState: 'RAIN',
          transitionProgressTicks: 3,
        },
      },
    });

    const derived = deriveSoundscapeState({
      gardenState: inputState,
      recentEvents: [createEvent('DEATH', 'HIGH')],
    });

    expect(derived.weather).toBe('STORM');
    expect(derived.sunlight).toBeGreaterThanOrEqual(0);
    expect(derived.sunlight).toBeLessThanOrEqual(1);
    expect(derived.populationTension).toBeGreaterThanOrEqual(0);
    expect(derived.populationTension).toBeLessThanOrEqual(1);

    const { layerTargets } = derived;
    expect(layerTargets.windLevel).toBeGreaterThan(0);
    expect(layerTargets.windLevel).toBeLessThanOrEqual(0.3);
    expect(layerTargets.tensionLevel).toBeGreaterThan(0);
    expect(layerTargets.tensionLevel).toBeLessThanOrEqual(0.26);
    expect(layerTargets.droneFilterHz).toBeGreaterThanOrEqual(220);
    expect(layerTargets.droneFilterHz).toBeLessThanOrEqual(2200);
  });
});

describe('audio/soundscapeEngine deriveEventAccents', () => {
  it('creates accents only for mapped event types with intensity by severity', () => {
    const accents = deriveEventAccents({
      gardenState: createGardenState(),
      recentEvents: [
        createEvent('BIRTH', 'LOW'),
        createEvent('DEATH', 'CRITICAL'),
        createEvent('AMBIENT', 'LOW'),
      ],
    });

    expect(accents).toHaveLength(2);
    expect(accents[0]?.type).toBe('BIRTH');
    expect(accents[0]?.intensity).toBeCloseTo(0.4);
    expect(accents[1]?.type).toBe('DEATH');
    expect(accents[1]?.intensity).toBeCloseTo(1);
  });
});

describe('audio/soundscapeEngine scheduleSmoothedValue', () => {
  it('applies smoothing with clamped ramp and calls expected param methods', () => {
    const calls: Array<{ method: string; value: number; time: number; timeConstant?: number }> = [];
    const fakeParam = {
      value: 0.3,
      setValueAtTime(value: number, startTime: number) {
        calls.push({ method: 'setValueAtTime', value, time: startTime });
      },
      linearRampToValueAtTime(value: number, endTime: number) {
        calls.push({ method: 'linearRampToValueAtTime', value, time: endTime });
      },
      setTargetAtTime(value: number, startTime: number, timeConstant: number) {
        calls.push({ method: 'setTargetAtTime', value, time: startTime, timeConstant });
      },
    };

    scheduleSmoothedValue(fakeParam, 0.8, 12, 0);

    expect(calls).toEqual([
      { method: 'setValueAtTime', value: 0.3, time: 12 },
      { method: 'linearRampToValueAtTime', value: 0.8, time: 12.01 },
    ]);
  });
});
