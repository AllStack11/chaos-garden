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
import {
  buildInsights,
  calculateAggregate,
  calculateEntityVitals,
  toGardenStatsPoint,
} from './stats/analytics';
import type {
  HealthStatus,
  GardenStatsPoint,
} from '@chaos-garden/shared';
import { checkRateLimitForRequest, getRateLimitResetTimeForRequest } from './utils/rate-limiter';
import { validateInteger } from './utils/validation';

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

/** Build CORS and security headers from the configured origin */
function getCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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
function createErrorResponse(
  message: string,
  corsOrigin: string,
  status = 500,
  details?: unknown,
  isDevelopment = false
): Response {
  const responseBody: {
    success: false;
    error: string;
    details?: unknown;
    timestamp: string;
  } = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Only include detailed error information in development mode
  if (isDevelopment && details !== undefined) {
    responseBody.details = details;
  }

  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(corsOrigin),
    },
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

  const result = validateInteger(rawValue, {
    min: MIN_STATS_WINDOW_TICKS,
    max: MAX_STATS_WINDOW_TICKS,
    fieldName: 'windowTicks',
  });

  if (!result.valid) {
    return { valid: false, value: DEFAULT_STATS_WINDOW_TICKS, error: result.error };
  }

  return { valid: true, value: result.value };
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
      error instanceof Error ? error.message : String(error),
      isDevelopment
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
      return createErrorResponse(
        parsedWindow.error ?? 'Invalid windowTicks parameter',
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
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
      error instanceof Error ? error.message : String(error),
      isDevelopment
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

    return createErrorResponse(
      'System unhealthy',
      corsOrigin,
      503,
      error instanceof Error ? error.message : String(error),
      isDevelopment
    );
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
    const isDevelopment = environmentName !== 'production';

    if (!hasDatabaseBinding(env)) {
      return createErrorResponse(
        'Database connection unavailable',
        corsOrigin,
        500,
        'Missing D1 binding `DB`. Ensure workers/wrangler.jsonc has d1_databases[].binding = "DB", then redeploy the Worker.',
        isDevelopment
      );
    }

    try {
      await ensureDatabaseReady(env.DB);
    } catch (error) {
      return createErrorResponse(
        'Database not ready',
        corsOrigin,
        500,
        error instanceof Error ? error.message : String(error),
        isDevelopment
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
