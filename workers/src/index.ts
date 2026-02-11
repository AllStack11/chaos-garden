/**
 * Cloudflare Worker Main Entry Point
 * 
 * The gateway to the Chaos Garden ecosystem.
 * This file handles all incoming HTTP requests and schedules
 * automatic simulation ticks via Cron triggers.
 * 
 * It orchestrates the API layer, providing endpoints for:
 * - Querying current garden state
 * - System health checks
 */

import type { D1Database, ScheduledEvent } from './types/worker';
import { createApplicationLogger } from './logging/application-logger';
import { runSimulationTick } from './simulation/tick/tick';
import { CURRENT_SCHEMA_VERSION } from './db/migrations';
import {
  getLatestGardenStateFromDatabase,
  getRecentSimulationEventsFromDatabase,
  getAllLivingEntitiesFromDatabase,
  getAllDecomposableDeadEntitiesFromDatabase,
  getGardenStateHistoryFromDatabase,
  getSimulationEventCountsByTypeFromDatabase,
  getSimulationEventSeverityBreakdownFromDatabase,
} from './db/queries';
import type {
  HealthStatus,
  Entity,
  GardenStatsPoint,
  GardenStatsAggregate,
  GardenInsight,
  GardenState,
  GardenEntityVitals,
  GardenTypeVitalSummary,
  EventTypeBreakdown,
  EventSeverityBreakdown,
} from '@chaos-garden/shared';
import { checkRateLimitForRequest, getRateLimitResetTimeForRequest } from './utils/rate-limiter';

// ==========================================
// Environment Type Definition
// ==========================================

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  CORS_ORIGIN?: string;
}

let databaseReadyPromise: Promise<void> | null = null;

async function ensureDatabaseReady(db: D1Database): Promise<void> {
  if (!databaseReadyPromise) {
    databaseReadyPromise = (async () => {
      const versionResult = await db
        .prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'")
        .first<{ value: string }>();

      const tickZeroResult = await db
        .prepare('SELECT id FROM garden_state WHERE tick = 0 LIMIT 1')
        .first<{ id: number }>();

      const isSchemaReady = versionResult?.value === CURRENT_SCHEMA_VERSION;
      if (!isSchemaReady || !tickZeroResult) {
        throw new Error(
          `Database is not initialized for schema ${CURRENT_SCHEMA_VERSION}. Run: npm run db:init:local (local) or npm run db:init:remote (production)`
        );
      }
    })();
  }
  try {
    await databaseReadyPromise;
  } catch (error) {
    databaseReadyPromise = null;
    throw error;
  }
}

function hasDatabaseBinding(env: Env): boolean {
  if (!env.DB || typeof env.DB !== 'object') {
    return false;
  }
  const maybeDatabase = env.DB as unknown as { prepare?: unknown };
  return typeof maybeDatabase.prepare === 'function';
}

// ==========================================
// CORS Headers
// ==========================================

/** Build CORS headers from the configured origin */
function getCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

/**
 * Resolve request-specific CORS origin.
 * Allows Pages preview subdomains when CORS_ORIGIN is a pages.dev host.
 */
function resolveCorsOrigin(request: Request, configuredOrigin: string): string {
  if (configuredOrigin === '*') {
    return '*';
  }

  const requestOrigin = request.headers.get('Origin');
  if (!requestOrigin) {
    return configuredOrigin;
  }

  try {
    const configuredUrl = new URL(configuredOrigin);
    const requestUrl = new URL(requestOrigin);

    const configuredHost = configuredUrl.hostname;
    const requestHost = requestUrl.hostname;
    const isSameOrigin = configuredUrl.origin === requestUrl.origin;
    const isPagesPreviewOrigin =
      configuredHost.endsWith('.pages.dev') &&
      requestHost.endsWith(`.${configuredHost}`) &&
      requestUrl.protocol === configuredUrl.protocol;

    if (isSameOrigin || isPagesPreviewOrigin) {
      return requestUrl.origin;
    }
  } catch {
    // Fall back to configured origin if URL parsing fails.
  }

  return configuredOrigin;
}

// ==========================================
// Response Helpers
// ==========================================

/** Create a successful JSON response */
function createSuccessResponse(data: unknown, corsOrigin: string, status = 200): Response {
  return new Response(JSON.stringify({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(corsOrigin)
    }
  });
}

/** Create an error response */
function createErrorResponse(message: string, corsOrigin: string, status = 500, details?: unknown): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(corsOrigin)
    }
  });
}

/** Create a not found response */
function createNotFoundResponse(corsOrigin: string, message = 'Resource not found'): Response {
  return createErrorResponse(message, corsOrigin, 404);
}

const MIN_STATS_WINDOW_TICKS = 10;
const MAX_STATS_WINDOW_TICKS = 500;
const DEFAULT_STATS_WINDOW_TICKS = 120;

interface ParsedStatsWindow {
  valid: boolean;
  value: number;
  error?: string;
}

function parseWindowTicks(searchParams: URLSearchParams): ParsedStatsWindow {
  const rawValue = searchParams.get('windowTicks');
  if (!rawValue) {
    return { valid: true, value: DEFAULT_STATS_WINDOW_TICKS };
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsedValue)) {
    return { valid: false, value: DEFAULT_STATS_WINDOW_TICKS, error: 'windowTicks must be an integer' };
  }

  if (parsedValue < MIN_STATS_WINDOW_TICKS || parsedValue > MAX_STATS_WINDOW_TICKS) {
    return {
      valid: false,
      value: DEFAULT_STATS_WINDOW_TICKS,
      error: `windowTicks must be between ${MIN_STATS_WINDOW_TICKS} and ${MAX_STATS_WINDOW_TICKS}`
    };
  }

  return { valid: true, value: parsedValue };
}

function toGardenStatsPoint(gardenState: GardenState | null): GardenStatsPoint | null {
  if (!gardenState) {
    return null;
  }

  return {
    tick: gardenState.tick,
    timestamp: gardenState.timestamp,
    populations: {
      plants: gardenState.populationSummary.plants,
      herbivores: gardenState.populationSummary.herbivores,
      carnivores: gardenState.populationSummary.carnivores,
      fungi: gardenState.populationSummary.fungi,
      living: gardenState.populationSummary.totalLiving,
      dead: gardenState.populationSummary.totalDead,
    },
    environment: {
      temperature: gardenState.environment.temperature,
      sunlight: gardenState.environment.sunlight,
      moisture: gardenState.environment.moisture,
      weatherState: gardenState.environment.weatherState?.currentState ?? null,
    },
  };
}

function getSlope(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  return (values[values.length - 1] - values[0]) / (values.length - 1);
}

function getVolatility(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function roundMetric(value: number, decimalPlaces: number = 4): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function calculateBiodiversityIndex(point: GardenStatsPoint): number {
  const speciesCounts = [
    point.populations.plants,
    point.populations.herbivores,
    point.populations.carnivores,
    point.populations.fungi,
  ];
  const totalLiving = Math.max(1, point.populations.living);
  let index = 0;

  for (const count of speciesCounts) {
    if (count <= 0) {
      continue;
    }
    const proportion = count / totalLiving;
    index += -(proportion * Math.log(proportion));
  }

  return roundMetric(index, 5);
}

function calculateAggregate(history: GardenStatsPoint[]): GardenStatsAggregate {
  if (history.length === 0) {
    return {
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
    };
  }

  const firstPoint = history[0];
  const lastPoint = history[history.length - 1];
  const tickSpan = Math.max(1, lastPoint.tick - firstPoint.tick);

  const livingValues = history.map((point) => point.populations.living);
  const deadValues = history.map((point) => point.populations.dead);
  const temperatureValues = history.map((point) => point.environment.temperature);
  const sunlightValues = history.map((point) => point.environment.sunlight);
  const moistureValues = history.map((point) => point.environment.moisture);

  const averageEnvironment = {
    temperature: roundMetric(temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length),
    sunlight: roundMetric(sunlightValues.reduce((sum, value) => sum + value, 0) / sunlightValues.length),
    moisture: roundMetric(moistureValues.reduce((sum, value) => sum + value, 0) / moistureValues.length),
  };

  return {
    tickSpan,
    deltas: {
      plants: lastPoint.populations.plants - firstPoint.populations.plants,
      herbivores: lastPoint.populations.herbivores - firstPoint.populations.herbivores,
      carnivores: lastPoint.populations.carnivores - firstPoint.populations.carnivores,
      fungi: lastPoint.populations.fungi - firstPoint.populations.fungi,
      living: lastPoint.populations.living - firstPoint.populations.living,
      dead: lastPoint.populations.dead - firstPoint.populations.dead,
    },
    growthRates: {
      livingPerTick: roundMetric((lastPoint.populations.living - firstPoint.populations.living) / tickSpan),
      deadPerTick: roundMetric((lastPoint.populations.dead - firstPoint.populations.dead) / tickSpan),
    },
    mortalityPressure: roundMetric(lastPoint.populations.dead / Math.max(1, lastPoint.populations.living)),
    populationVolatility: roundMetric(getVolatility(livingValues)),
    biodiversityIndex: calculateBiodiversityIndex(lastPoint),
    predatorPreyRatio: roundMetric(lastPoint.populations.carnivores / Math.max(1, lastPoint.populations.herbivores)),
    decompositionPressure: roundMetric(lastPoint.populations.dead / Math.max(1, lastPoint.populations.fungi)),
    averageEnvironment,
    trendSlopes: {
      temperature: roundMetric(getSlope(temperatureValues)),
      sunlight: roundMetric(getSlope(sunlightValues)),
      moisture: roundMetric(getSlope(moistureValues)),
    },
  };
}

function buildTypeVitals(entities: Entity[], entityType: Entity['type']): GardenTypeVitalSummary {
  const matchingEntities = entities.filter((entity) => entity.type === entityType);
  if (matchingEntities.length === 0) {
    return { count: 0, averageEnergy: 0, averageHealth: 0 };
  }

  const averageEnergy = matchingEntities.reduce((sum, entity) => sum + entity.energy, 0) / matchingEntities.length;
  const averageHealth = matchingEntities.reduce((sum, entity) => sum + entity.health, 0) / matchingEntities.length;

  return {
    count: matchingEntities.length,
    averageEnergy: roundMetric(averageEnergy),
    averageHealth: roundMetric(averageHealth),
  };
}

function calculateEntityVitals(livingEntities: Entity[]): GardenEntityVitals {
  if (livingEntities.length === 0) {
    return {
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
      },
    };
  }

  const oldestLivingAge = Math.max(...livingEntities.map((entity) => entity.age));
  const youngestLivingAge = Math.min(...livingEntities.map((entity) => entity.age));
  const youngestThresholdAge = youngestLivingAge + 10;
  const youngestCohortCount = livingEntities.filter((entity) => entity.age <= youngestThresholdAge).length;

  return {
    totalLiving: livingEntities.length,
    oldestLivingAge,
    youngestLivingAge,
    youngestCohortCount,
    averageEnergyAcrossLiving: roundMetric(
      livingEntities.reduce((sum, entity) => sum + entity.energy, 0) / livingEntities.length
    ),
    averageHealthAcrossLiving: roundMetric(
      livingEntities.reduce((sum, entity) => sum + entity.health, 0) / livingEntities.length
    ),
    byType: {
      plant: buildTypeVitals(livingEntities, 'plant'),
      herbivore: buildTypeVitals(livingEntities, 'herbivore'),
      carnivore: buildTypeVitals(livingEntities, 'carnivore'),
      fungus: buildTypeVitals(livingEntities, 'fungus'),
    },
  };
}

function buildInsights(
  history: GardenStatsPoint[],
  aggregate: GardenStatsAggregate,
  eventBreakdown: EventTypeBreakdown[],
  severityBreakdown: EventSeverityBreakdown[]
): GardenInsight[] {
  if (history.length === 0) {
    return [];
  }

  const lastPoint = history[history.length - 1];
  const firstPoint = history[0];
  const tickRange = { start: firstPoint.tick, end: lastPoint.tick };
  const insights: GardenInsight[] = [];
  const severeEvents = severityBreakdown.find((item) => item.severity === 'CRITICAL')?.count ?? 0;
  const deathEvents = eventBreakdown.find((item) => item.eventType === 'DEATH')?.count ?? 0;

  if (aggregate.growthRates.livingPerTick > 0.7) {
    insights.push({
      id: 'population-surge',
      title: 'Population surge detected',
      description: 'Living population is rising rapidly over the active window.',
      severity: 'MEDIUM',
      kind: 'POPULATION_SURGE',
      confidence: 0.82,
      relatedMetrics: ['growthRates.livingPerTick', 'deltas.living'],
      tickRange,
    });
  }

  if (aggregate.growthRates.livingPerTick < -0.4 || aggregate.mortalityPressure > 0.45 || severeEvents > 0) {
    insights.push({
      id: 'collapse-risk',
      title: 'Collapse risk emerging',
      description: 'Mortality pressure and negative living growth indicate instability risk.',
      severity: severeEvents > 0 ? 'CRITICAL' : 'HIGH',
      kind: 'COLLAPSE_RISK',
      confidence: severeEvents > 0 ? 0.92 : 0.78,
      relatedMetrics: ['mortalityPressure', 'growthRates.livingPerTick'],
      tickRange,
    });
  }

  if (aggregate.predatorPreyRatio > 0.9 || aggregate.predatorPreyRatio < 0.08) {
    insights.push({
      id: 'predator-prey-imbalance',
      title: 'Predator-prey imbalance',
      description: 'Carnivore and herbivore populations have diverged beyond stable bounds.',
      severity: aggregate.predatorPreyRatio > 1.2 ? 'HIGH' : 'MEDIUM',
      kind: 'PREDATOR_PREY_IMBALANCE',
      confidence: 0.8,
      relatedMetrics: ['predatorPreyRatio'],
      tickRange,
    });
  }

  if (aggregate.decompositionPressure > 4 || (aggregate.deltas.dead > 0 && aggregate.deltas.fungi <= 0)) {
    insights.push({
      id: 'decomposition-backlog',
      title: 'Decomposition backlog',
      description: 'Dead matter accumulation is outpacing fungal decomposition capacity.',
      severity: 'MEDIUM',
      kind: 'DECOMPOSITION_BACKLOG',
      confidence: 0.74,
      relatedMetrics: ['decompositionPressure', 'deltas.dead', 'deltas.fungi'],
      tickRange,
    });
  }

  if ((aggregate.averageEnvironment.moisture < 0.26 || aggregate.averageEnvironment.sunlight < 0.22) && deathEvents > 0) {
    insights.push({
      id: 'environmental-stress',
      title: 'Environmental stress pattern',
      description: 'Sustained low resources are correlated with mortality events in this window.',
      severity: 'HIGH',
      kind: 'ENVIRONMENTAL_STRESS',
      confidence: 0.77,
      relatedMetrics: ['averageEnvironment.moisture', 'averageEnvironment.sunlight'],
      tickRange,
    });
  }

  if (aggregate.populationVolatility < 4 && aggregate.biodiversityIndex > 1.1 && aggregate.mortalityPressure < 0.2) {
    insights.push({
      id: 'stability-window',
      title: 'Stability window',
      description: 'Population volatility is low while biodiversity and survivability remain healthy.',
      severity: 'LOW',
      kind: 'STABILITY_WINDOW',
      confidence: 0.86,
      relatedMetrics: ['populationVolatility', 'biodiversityIndex', 'mortalityPressure'],
      tickRange,
    });
  }

  return insights;
}

// ==========================================
// Request Handlers
// ==========================================

/**
 * Handle GET /api/garden
 * Returns current garden state with all entities and recent events.
 */
async function handleGetGarden(env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    await logger.info('api_get_garden', 'Fetching current garden state');

    // Get latest garden state
    const gardenState = await getLatestGardenStateFromDatabase(env.DB);
    if (!gardenState) {
      return createNotFoundResponse(corsOrigin, 'No garden state found - garden may not be initialized');
    }

    // Get all entities currently visible in the garden (living + decomposable dead matter)
    const livingEntities = await getAllLivingEntitiesFromDatabase(env.DB);
    const decomposableDeadEntities = await getAllDecomposableDeadEntitiesFromDatabase(env.DB);
    const entities = [...livingEntities, ...decomposableDeadEntities];

    // Get recent events
    const events = await getRecentSimulationEventsFromDatabase(env.DB, 20);

    await logger.debug('api_get_garden_success', 'Garden state retrieved', {
      tick: gardenState.tick,
      entityCount: entities.length,
      livingEntityCount: livingEntities.length,
      deadEntityCount: decomposableDeadEntities.length,
      eventCount: events.length
    });

    return createSuccessResponse({
      gardenState,
      entities,
      events,
      timestamp: new Date().toISOString()
    }, corsOrigin);

  } catch (error) {
    const logger = createApplicationLogger(env.DB, 'API');
    await logger.error('api_get_garden_failed', 'Failed to fetch garden state', {
      error: error instanceof Error ? error.message : String(error)
    });

    return createErrorResponse(
      'Failed to fetch garden state',
      corsOrigin,
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Handle GET /api/garden/stats
 * Returns historical and derived statistics for dashboard analytics.
 */
async function handleGetGardenStats(request: Request, env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    const url = new URL(request.url);
    const parsedWindow = parseWindowTicks(url.searchParams);
    if (!parsedWindow.valid) {
      return createErrorResponse(parsedWindow.error ?? 'Invalid windowTicks parameter', corsOrigin, 400);
    }

    const windowTicks = parsedWindow.value;
    const latestGardenState = await getLatestGardenStateFromDatabase(env.DB);
    if (!latestGardenState) {
      return createNotFoundResponse(corsOrigin, 'No garden state found - garden may not be initialized');
    }

    const historyStates = await getGardenStateHistoryFromDatabase(env.DB, windowTicks, latestGardenState.tick);
    const history = historyStates
      .map((state) => toGardenStatsPoint(state))
      .filter((point): point is GardenStatsPoint => point !== null);

    const currentPoint = toGardenStatsPoint(latestGardenState);
    if (!currentPoint) {
      return createErrorResponse('Unable to build stats point from latest state', corsOrigin, 500);
    }

    const effectiveHistory = history.length > 0 ? history : [currentPoint];
    const startTick = effectiveHistory[0].tick;
    const endTick = effectiveHistory[effectiveHistory.length - 1].tick;

    const [eventBreakdown, severityBreakdown, livingEntities] = await Promise.all([
      getSimulationEventCountsByTypeFromDatabase(env.DB, startTick, endTick),
      getSimulationEventSeverityBreakdownFromDatabase(env.DB, startTick, endTick),
      getAllLivingEntitiesFromDatabase(env.DB),
    ]);

    const derived = calculateAggregate(effectiveHistory);
    const insights = buildInsights(effectiveHistory, derived, eventBreakdown, severityBreakdown);
    const entityVitals = calculateEntityVitals(livingEntities);

    await logger.debug('api_get_garden_stats_success', 'Garden stats retrieved', {
      tick: latestGardenState.tick,
      windowTicks,
      historyPoints: effectiveHistory.length,
      eventTypeCount: eventBreakdown.length,
      insightCount: insights.length,
    });

    return createSuccessResponse({
      current: latestGardenState,
      history: effectiveHistory,
      eventBreakdown,
      severityBreakdown,
      derived,
      insights,
      entityVitals,
      windowTicks,
      generatedAt: new Date().toISOString(),
    }, corsOrigin);
  } catch (error) {
    await logger.error('api_get_garden_stats_failed', 'Failed to fetch garden stats', {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse(
      'Failed to fetch garden stats',
      corsOrigin,
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Handle GET /api/health
 * Returns system health status.
 */
async function handleGetHealth(env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    // Get latest state to check if system is operational
    const gardenState = await getLatestGardenStateFromDatabase(env.DB);

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gardenState: gardenState ? {
        tick: gardenState.tick,
        timestamp: gardenState.timestamp
      } : null,
      config: {
        tickIntervalMinutes: 15 // Current standard
      }
    };

    await logger.debug('api_health', 'Health check performed', { status: health.status, tick: health.gardenState?.tick });

    return createSuccessResponse(health, corsOrigin);

  } catch (error) {
    const logger = createApplicationLogger(env.DB, 'API');
    await logger.error('api_health_failed', 'Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return createErrorResponse('System unhealthy', corsOrigin, 503, {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}

// ==========================================
// Main Worker Handler
// ==========================================

export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const configuredCorsOrigin = env.CORS_ORIGIN ?? '*';
    const corsOrigin = resolveCorsOrigin(request, configuredCorsOrigin);
    const environmentName = env.ENVIRONMENT ?? 'production';

    if (!hasDatabaseBinding(env)) {
      return createErrorResponse(
        'Missing D1 binding `DB`. Ensure workers/wrangler.jsonc has d1_databases[].binding = "DB", then redeploy the Worker.',
        corsOrigin,
        500,
        { environment: environmentName }
      );
    }

    try {
      await ensureDatabaseReady(env.DB);
    } catch (error) {
      return createErrorResponse(
        'Database is not initialized. Run `npm run db:init:local` from the project root.',
        corsOrigin,
        500,
        error instanceof Error ? error.message : String(error)
      );
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getCorsHeaders(corsOrigin)
      });
    }

    // Check rate limit (skip for health check to allow monitoring)
    if (path !== '/api/health') {
      const isAllowed = checkRateLimitForRequest(request);
      if (!isAllowed) {
        const resetTime = getRateLimitResetTimeForRequest(request);
        const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);

        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: retryAfterSeconds,
          timestamp: new Date().toISOString()
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfterSeconds.toString(),
            ...getCorsHeaders(corsOrigin)
          }
        });
      }
    }

    // Route requests
    if (path === '/api/garden' && request.method === 'GET') {
      return handleGetGarden(env, corsOrigin);
    }

    if (path === '/api/garden/stats' && request.method === 'GET') {
      return handleGetGardenStats(request, env, corsOrigin);
    }

    if (path === '/api/health' && request.method === 'GET') {
      return handleGetHealth(env, corsOrigin);
    }

    // Handle manual tick trigger (Development only)
    if (path === '/api/tick' && request.method === 'POST') {
      const isDevelopment = env.ENVIRONMENT !== 'production';
      const logger = createApplicationLogger(env.DB, 'SIMULATION', undefined, isDevelopment);

      try {
        await logger.info('api_tick_triggered', 'Manual simulation tick starting');
        const result = await runSimulationTick(env.DB, logger, isDevelopment);
        await logger.info('api_tick_complete', 'Manual simulation tick completed', result as unknown as Record<string, unknown>);
        return createSuccessResponse(result, corsOrigin);
      } catch (error) {
        return createErrorResponse(
          'Manual tick failed',
          corsOrigin,
          500,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Handle root path
    if (path === '/' || path === '/api') {
      return new Response(JSON.stringify({
        name: 'Chaos Garden API',
        version: '1.0.0',
        endpoints: [
          { path: '/api/garden', method: 'GET', description: 'Get current garden state' },
          { path: '/api/garden/stats', method: 'GET', description: 'Get historical garden analytics' },
          { path: '/api/health', method: 'GET', description: 'System health check' }
        ],
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(corsOrigin)
        }
      });
    }

    // Not found
    return createNotFoundResponse(corsOrigin, `No route found for ${request.method} ${path}`);
  },
  
  /**
   * Handle scheduled Cron triggers (every 15 minutes)
   */
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (!hasDatabaseBinding(env)) {
      console.error(
        'Skipping scheduled tick because D1 binding `DB` is missing. Redeploy the Worker with workers/wrangler.jsonc binding set to "DB".'
      );
      return;
    }

    try {
      await ensureDatabaseReady(env.DB);
    } catch (error) {
      console.error(
        'Skipping scheduled tick because database is not initialized. Run `npm run db:init:local`.',
        error
      );
      return;
    }

    const isDevelopment = env.ENVIRONMENT !== 'production';

    if (isDevelopment) {
      console.log(`[${new Date().toISOString()}] [SCHEDULED] Cron triggered: ${event.cron}`);
    }

    const logger = createApplicationLogger(env.DB, 'SIMULATION', undefined, isDevelopment);
    
    try {
      await logger.info('cron_triggered', 'Cron-triggered tick starting', {
        cron: event.cron,
        scheduledTime: event.scheduledTime
      });
      
      const result = await runSimulationTick(env.DB, logger, isDevelopment);
      
      await logger.info('cron_complete', 'Cron-triggered tick completed', result as unknown as Record<string, unknown>);
      
    } catch (error) {
      await logger.error('cron_failed', 'Cron-triggered tick failed', {
        error: error instanceof Error ? error.message : String(error),
        scheduledTime: event.scheduledTime
      });
    }
  }
};
