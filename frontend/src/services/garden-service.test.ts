import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthStatus, GardenStatsResponse } from '@chaos-garden/shared';
import { ApiClient } from './api-client';
import { GardenService, type GardenData } from './garden-service';

describe('services/GardenService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Reflect.set(GardenService, 'instance', undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns the same singleton instance across calls', () => {
    const first = GardenService.getInstance('https://api.one.example');
    const second = GardenService.getInstance('https://api.two.example');

    expect(first).toBe(second);
  });

  it('returns garden data when the API request succeeds', async () => {
    const responseData: GardenData = {
      gardenState: {
        id: 1,
        tick: 10,
        timestamp: '2026-01-01T00:00:00.000Z',
        environment: {
          temperature: 22,
          sunlight: 0.8,
          moisture: 0.4,
          tick: 10,
          weatherState: null
        },
        populationSummary: {
          plants: 1,
          herbivores: 1,
          carnivores: 0,
          fungi: 0,
          deadPlants: 0,
          deadHerbivores: 0,
          deadCarnivores: 0,
          deadFungi: 0,
          allTimeDeadPlants: 0,
          allTimeDeadHerbivores: 0,
          allTimeDeadCarnivores: 0,
          allTimeDeadFungi: 0,
          total: 2,
          totalLiving: 2,
          totalDead: 0,
          allTimeDead: 0
        }
      },
      entities: [],
      events: []
    };

    const getSpy = vi.spyOn(ApiClient.prototype, 'get').mockResolvedValue({
      success: true,
      data: responseData,
      timestamp: '2026-01-01T00:00:00.000Z'
    });

    const service = GardenService.getInstance('https://api.example');
    const result = await service.fetchGardenData();

    expect(getSpy).toHaveBeenCalledWith('/api/garden');
    expect(result).toEqual(responseData);
  });

  it('returns null when garden endpoint returns failure', async () => {
    vi.spyOn(ApiClient.prototype, 'get').mockResolvedValue({
      success: false,
      error: 'unavailable',
      timestamp: '2026-01-01T00:00:00.000Z'
    });

    const service = GardenService.getInstance('https://api.example');
    const result = await service.fetchGardenData();

    expect(result).toBeNull();
  });

  it('returns health status when health endpoint succeeds', async () => {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: '2026-01-01T00:00:00.000Z',
      gardenState: {
        tick: 10,
        timestamp: '2026-01-01T00:00:00.000Z'
      },
      config: {
        tickIntervalMinutes: 15
      }
    };

    const getSpy = vi.spyOn(ApiClient.prototype, 'get').mockResolvedValue({
      success: true,
      data: health,
      timestamp: '2026-01-01T00:00:00.000Z'
    });

    const service = GardenService.getInstance('https://api.example');
    const result = await service.checkHealth();

    expect(getSpy).toHaveBeenCalledWith('/api/health');
    expect(result).toEqual(health);
  });

  it('returns garden stats when stats endpoint succeeds', async () => {
    const stats: GardenStatsResponse = {
      current: {
        id: 10,
        tick: 42,
        timestamp: '2026-01-01T00:00:00.000Z',
        environment: {
          temperature: 22,
          sunlight: 0.6,
          moisture: 0.5,
          tick: 42,
          weatherState: null,
        },
        populationSummary: {
          plants: 20,
          herbivores: 9,
          carnivores: 3,
          fungi: 8,
          deadPlants: 1,
          deadHerbivores: 1,
          deadCarnivores: 0,
          deadFungi: 0,
          allTimeDeadPlants: 30,
          allTimeDeadHerbivores: 14,
          allTimeDeadCarnivores: 4,
          allTimeDeadFungi: 2,
          total: 42,
          totalLiving: 40,
          totalDead: 2,
          allTimeDead: 50,
        },
      },
      history: [],
      eventBreakdown: [],
      severityBreakdown: [],
      derived: {
        tickSpan: 0,
        deltas: { plants: 0, herbivores: 0, carnivores: 0, fungi: 0, living: 0, dead: 0 },
        growthRates: { livingPerTick: 0, deadPerTick: 0 },
        mortalityPressure: 0,
        populationVolatility: 0,
        biodiversityIndex: 0,
        predatorPreyRatio: 0,
        decompositionPressure: 0,
        averageEnvironment: { temperature: 0, sunlight: 0, moisture: 0 },
        trendSlopes: { temperature: 0, sunlight: 0, moisture: 0 },
      },
      insights: [],
      entityVitals: {
        totalLiving: 0,
        oldestLivingAge: 0,
        youngestLivingAge: 0,
        youngestCohortCount: 0,
        averageEnergyAcrossLiving: 0,
        averageHealthAcrossLiving: 0,
        byType: {
          plant: { count: 0, averageEnergy: 0, averageHealth: 0 },
          herbivore: { count: 0, averageEnergy: 0, averageHealth: 0 },
          carnivore: { count: 0, averageEnergy: 0, averageHealth: 0 },
          fungus: { count: 0, averageEnergy: 0, averageHealth: 0 },
        }
      },
      windowTicks: 120,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const getSpy = vi.spyOn(ApiClient.prototype, 'get').mockResolvedValue({
      success: true,
      data: stats,
      timestamp: '2026-01-01T00:00:00.000Z'
    });

    const service = GardenService.getInstance('https://api.example');
    const result = await service.fetchGardenStats(120);

    expect(getSpy).toHaveBeenCalledWith('/api/garden/stats?windowTicks=120');
    expect(result).toEqual(stats);
  });
});
