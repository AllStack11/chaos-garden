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
import { runSimulationTick } from './simulation/tick';
import {
  getLatestGardenStateFromDatabase,
  getRecentSimulationEventsFromDatabase,
  getAllLivingEntitiesFromDatabase,
} from './db/queries';
import type { HealthStatus } from '@chaos-garden/shared';

// ==========================================
// Environment Type Definition
// ==========================================

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
}

// ==========================================
// CORS Headers
// ==========================================

/** Headers to enable cross-origin requests */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ==========================================
// Response Helpers
// ==========================================

/** Create a successful JSON response */
function createSuccessResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

/** Create an error response */
function createErrorResponse(message: string, status = 500, details?: unknown): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

/** Create a not found response */
function createNotFoundResponse(message = 'Resource not found'): Response {
  return createErrorResponse(message, 404);
}

// ==========================================
// Request Handlers
// ==========================================

/**
 * Handle GET /api/garden
 * Returns current garden state with all entities and recent events.
 */
async function handleGetGarden(env: Env): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);
  
  try {
    await logger.info('api_get_garden', 'Fetching current garden state');
    
    // Get latest garden state
    const gardenState = await getLatestGardenStateFromDatabase(env.DB);
    if (!gardenState) {
      return createNotFoundResponse('No garden state found - garden may not be initialized');
    }
    
    // Get all living entities
    const entities = await getAllLivingEntitiesFromDatabase(env.DB);
    
    // Get recent events
    const events = await getRecentSimulationEventsFromDatabase(env.DB, 20);
    
    await logger.debug('api_get_garden_success', 'Garden state retrieved', {
      tick: gardenState.tick,
      entityCount: entities.length,
      eventCount: events.length
    });
    
    return createSuccessResponse({
      gardenState,
      entities,
      events,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const logger = createApplicationLogger(env.DB, 'API');
    await logger.error('api_get_garden_failed', 'Failed to fetch garden state', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return createErrorResponse(
      'Failed to fetch garden state',
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Handle GET /api/health
 * Returns system health status.
 */
async function handleGetHealth(env: Env): Promise<Response> {
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
    
    await logger.debug('api_health', 'Health check performed', health as any);
    
    return createSuccessResponse(health);
    
  } catch (error) {
    const logger = createApplicationLogger(env.DB, 'API');
    await logger.error('api_health_failed', 'Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return createErrorResponse('System unhealthy', 503, {
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
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS
      });
    }
    
    // Route requests
    if (path === '/api/garden' && request.method === 'GET') {
      return handleGetGarden(env);
    }
    
    if (path === '/api/health' && request.method === 'GET') {
      return handleGetHealth(env);
    }

    // Handle manual tick trigger (Development only)
    if (path === '/api/tick' && request.method === 'POST') {
      const isDevelopment = env.ENVIRONMENT !== 'production';
      const logger = createApplicationLogger(env.DB, 'SIMULATION', undefined, isDevelopment);
      
      try {
        await logger.info('api_tick_triggered', 'Manual simulation tick starting');
        const result = await runSimulationTick(env.DB, logger, isDevelopment);
        await logger.info('api_tick_complete', 'Manual simulation tick completed', result as unknown as Record<string, unknown>);
        return createSuccessResponse(result);
      } catch (error) {
        return createErrorResponse(
          'Manual tick failed',
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
          ...CORS_HEADERS
        }
      });
    }
    
    // Not found
    return createNotFoundResponse(`No route found for ${request.method} ${path}`);
  },
  
  /**
   * Handle scheduled Cron triggers (every 15 minutes)
   */
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
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
