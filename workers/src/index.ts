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
} from './db/queries';
import type { HealthStatus } from '@chaos-garden/shared';
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
          `Database is not initialized for schema ${CURRENT_SCHEMA_VERSION}. Run: npm run db:init:local`
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

// ==========================================
// CORS Headers
// ==========================================

/** Build CORS headers from the configured origin */
function getCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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
    const corsOrigin = env.CORS_ORIGIN ?? '*';

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
