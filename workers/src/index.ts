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
  getDeadMatterFromDatabase,
  getGardenStateHistoryFromDatabase,
  getSimulationEventCountsByTypeFromDatabase,
  getSimulationEventSeverityBreakdownFromDatabase,
  getLatestEngineCheckpoint,
  getLatestCheckpointTick,
  saveEngineCheckpoint,
  pruneEngineCheckpoints,
  getActiveCuratorLease,
  hasActiveCuratorLease,
  acquireOrRenewCuratorLease,
} from './db/queries';
import { executeQuery } from './db/connection';
import {
  buildInsights,
  calculateAggregate,
  calculateEntityVitals,
  toGardenStatsPoint,
} from './stats/analytics';
import {
  type HealthStatus,
  type GardenStatsPoint,
  type GardenBootstrapResponse,
  type CanonicalWorldState,
  type CheckpointSubmission,
  type ChronicleEvent,
  base64ToUint8Array,
  computeSha256Hex,
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
  CURATOR_SECRET?: string;
  CURATOR_TOKEN?: string;
}

interface AuthenticatedCurator {
  curatorId: string;
}

type CuratorAuthResult =
  | { success: true; curator: AuthenticatedCurator }
  | { success: false; status: number; error: string };

function authenticateCuratorRequest(
  request: Request,
  env: Env,
  expectedCuratorId?: string
): CuratorAuthResult {
  const authHeader = request.headers.get('Authorization') || request.headers.get('X-Curator-Key');
  if (!authHeader) {
    return {
      success: false,
      status: 401,
      error: 'Unauthorized: Missing curator authorization header',
    };
  }

  let token = authHeader.trim();
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  const configuredSecret = env.CURATOR_SECRET || env.CURATOR_TOKEN;
  if (!configuredSecret) {
    // Fail closed: secret MUST be provisioned in non-test environments
    if (env.ENVIRONMENT !== 'test') {
      return {
        success: false,
        status: 500,
        error: 'Server configuration error: Curator authentication is unconfigured (CURATOR_SECRET must be provisioned in non-test environments)',
      };
    }

    // Explicit test environment fallback: require non-empty token
    if (!token || token.length < 3) {
      return {
        success: false,
        status: 401,
        error: 'Unauthorized: Invalid curator authorization credentials',
      };
    }
  } else if (token !== configuredSecret) {
    return {
      success: false,
      status: 401,
      error: 'Unauthorized: Invalid curator authorization credentials',
    };
  }

  // Derive or extract curator identity
  const headerCuratorId = request.headers.get('X-Curator-Id');
  const curatorId = headerCuratorId || expectedCuratorId || (token.startsWith('curator-') ? token : `curator-${token.slice(0, 16)}`);

  return { success: true, curator: { curatorId } };
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
 * Returns canonical garden bootstrap state with checkpoint and events.
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

    // Get all living entities, dead matter, recent events, and latest engine checkpoint
    const [entities, deadMatter, events, checkpoint] = await Promise.all([
      getAllLivingEntitiesFromDatabase(env.DB),
      getDeadMatterFromDatabase(env.DB),
      getRecentSimulationEventsFromDatabase(env.DB, 20),
      getLatestEngineCheckpoint(env.DB),
    ]);

    const chronicleEvents: ChronicleEvent[] = events.map((e) => ({
      id: String(e.id),
      tick: e.tick,
      timestamp: e.timestamp,
      type: e.eventType,
      severity: e.severity,
      description: e.description,
      tags: e.tags ?? [],
    }));

    const effectiveTick = checkpoint?.tick ?? gardenState.tick;

    const canonicalState: CanonicalWorldState = {
      id: gardenState.id ?? 1,
      tick: effectiveTick,
      epoch: Math.floor(effectiveTick / 1200),
      timestamp: gardenState.timestamp,
      seed: checkpoint?.seed ?? 42,
      atmospheric: {
        temperature: gardenState.environment.temperature,
        sunlight: gardenState.environment.sunlight,
        moisture: gardenState.environment.moisture,
        weatherState: gardenState.environment.weatherState ?? undefined,
      },
      populationSummary: gardenState.populationSummary,
      entities,
      deadMatter,
      soil: {
        cols: 50,
        rows: 37,
        moisture: [],
        nitrates: [],
      },
      checksum: checkpoint?.checksum ?? `state-${gardenState.tick}`,
      checkpoint: checkpoint ?? undefined,
    };

    const responseData: GardenBootstrapResponse & {
      gardenState: typeof gardenState;
      entities: typeof entities;
      deadMatter: typeof deadMatter;
      timestamp: string;
    } = {
      canonicalState,
      checkpoint: checkpoint ?? undefined,
      events: chronicleEvents,
      gardenState,
      entities,
      deadMatter,
      timestamp: new Date().toISOString(),
    };

    await logger.debug('api_get_garden_success', 'Garden state retrieved', {
      tick: canonicalState.tick,
      hasCheckpoint: !!checkpoint,
      entityCount: entities.length,
      deadMatterCount: deadMatter.length,
      eventCount: events.length
    });

    return createSuccessResponse(responseData, corsOrigin);

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
 * Handle POST /api/garden/lease and POST /api/garden/curator-lease
 * Issues or renews a temporary curator authority lease.
 */
async function handlePostLease(request: Request, env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      curatorId?: string;
      authorizedTick?: number;
      leaseId?: string;
      ttlMs?: number;
    };

    // Authenticate and authorize curator identity
    const auth = authenticateCuratorRequest(request, env, body.curatorId);
    if (!auth.success) {
      return createErrorResponse(auth.error, corsOrigin, auth.status, undefined, isDevelopment);
    }

    const curatorId = auth.curator.curatorId;

    let authorizedTick = body.authorizedTick;
    if (typeof authorizedTick !== 'number') {
      authorizedTick = await getLatestCheckpointTick(env.DB);
      if (authorizedTick < 0) {
        const latestState = await getLatestGardenStateFromDatabase(env.DB);
        authorizedTick = latestState?.tick ?? 0;
      }
    }

    const result = await acquireOrRenewCuratorLease(
      env.DB,
      curatorId,
      authorizedTick,
      body.leaseId,
      body.ttlMs ?? 120000
    );

    if ('error' in result) {
      return createErrorResponse(
        result.error,
        corsOrigin,
        409,
        { conflictingCuratorId: result.conflictingCuratorId },
        isDevelopment
      );
    }

    await logger.info('api_lease_granted', 'Curator lease issued/renewed', {
      leaseId: result.lease.leaseId,
      curatorId: result.lease.curatorId,
      expiresAtMs: result.lease.expiresAtMs,
    });

    return createSuccessResponse(result.lease, corsOrigin, 200);
  } catch (error) {
    return createErrorResponse(
      'Failed to acquire curator lease',
      corsOrigin,
      500,
      error instanceof Error ? error.message : String(error),
      isDevelopment
    );
  }
}

/**
 * Handle POST /api/garden/checkpoint
 * Validates curator lease, monotonic tick, SHA-256 integrity, binary header,
 * and atomically persists the deterministic engine checkpoint.
 */
async function handlePostCheckpoint(request: Request, env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    // 0. Verify curator authorization
    const auth = authenticateCuratorRequest(request, env);
    if (!auth.success) {
      return createErrorResponse(auth.error, corsOrigin, auth.status, undefined, isDevelopment);
    }

    const submission = (await request.json().catch(() => null)) as CheckpointSubmission | null;
    if (!submission || !submission.leaseId || !submission.checkpoint) {
      return createErrorResponse(
        'Missing leaseId or checkpoint in request payload',
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    // 1. Verify active curator lease
    const activeLease = await getActiveCuratorLease(env.DB, submission.leaseId);
    if (!activeLease) {
      return createErrorResponse(
        'Invalid or expired curator lease',
        corsOrigin,
        403,
        undefined,
        isDevelopment
      );
    }

    // Verify lease owner matches authenticated curator
    if (activeLease.curatorId !== auth.curator.curatorId) {
      return createErrorResponse(
        'Forbidden: Curator identity does not match active lease holder',
        corsOrigin,
        403,
        undefined,
        isDevelopment
      );
    }

    const checkpoint = submission.checkpoint;

    // 2. Monotonic tick check
    const lastTick = await getLatestCheckpointTick(env.DB);
    if (checkpoint.tick <= lastTick) {
      return createErrorResponse(
        `Checkpoint tick (${checkpoint.tick}) must be strictly greater than last checkpoint tick (${lastTick})`,
        corsOrigin,
        409,
        undefined,
        isDevelopment
      );
    }

    // 3. Format and envelope validation
    if (
      typeof checkpoint.tick !== 'number' ||
      typeof checkpoint.version !== 'number' ||
      typeof checkpoint.seed !== 'number' ||
      typeof checkpoint.byteLength !== 'number' ||
      !checkpoint.checksum ||
      !checkpoint.payload
    ) {
      return createErrorResponse(
        'Malformed EncodedEngineCheckpoint envelope',
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    // 4. Decode payload bytes
    let rawBytes: Uint8Array;
    try {
      rawBytes = base64ToUint8Array(checkpoint.payload);
    } catch {
      return createErrorResponse(
        'Malformed base64 payload in checkpoint',
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    if (rawBytes.byteLength !== checkpoint.byteLength) {
      return createErrorResponse(
        `Payload byte length mismatch: expected ${checkpoint.byteLength}, got ${rawBytes.byteLength}`,
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    // 5. SHA-256 checksum verification
    const computedChecksum = await computeSha256Hex(rawBytes);
    if (computedChecksum.toLowerCase() !== checkpoint.checksum.toLowerCase()) {
      return createErrorResponse(
        `Checksum mismatch: computed ${computedChecksum}, expected ${checkpoint.checksum}`,
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    // 6. Binary header validation (minimum 44 bytes for CGS2 format)
    if (rawBytes.byteLength < 44) {
      return createErrorResponse(
        'Checkpoint binary payload smaller than header length',
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== 0x43475332) {
      return createErrorResponse(
        'Invalid checkpoint magic bytes (expected CGS2)',
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    const headerVersion = view.getUint32(4, true);
    if (headerVersion !== checkpoint.version) {
      return createErrorResponse(
        `Header version (${headerVersion}) does not match checkpoint version (${checkpoint.version})`,
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    const headerTick = view.getUint32(8, true);
    if (headerTick !== checkpoint.tick) {
      return createErrorResponse(
        `Header tick (${headerTick}) does not match checkpoint tick (${checkpoint.tick})`,
        corsOrigin,
        400,
        undefined,
        isDevelopment
      );
    }

    // 7. Atomic persistence to engine_checkpoints conditioned on active curator lease
    const saveResult = await saveEngineCheckpoint(env.DB, checkpoint, {
      leaseId: activeLease.leaseId,
      curatorId: auth.curator.curatorId,
      nowMs: Date.now(),
    });
    if (!saveResult.success) {
      const statusCode = saveResult.conflict ? 409 : 500;
      return createErrorResponse(
        saveResult.error || 'Failed to save engine checkpoint',
        corsOrigin,
        statusCode,
        undefined,
        isDevelopment
      );
    }

    // 8. Prune older checkpoints to maintain maximum 500 retained rows
    await pruneEngineCheckpoints(env.DB, 500);

    await logger.info('api_checkpoint_saved', 'Engine checkpoint committed successfully', {
      tick: checkpoint.tick,
      checksum: checkpoint.checksum,
      byteLength: checkpoint.byteLength,
    });

    return createSuccessResponse(
      {
        tick: checkpoint.tick,
        checksum: checkpoint.checksum,
        byteLength: checkpoint.byteLength,
      },
      corsOrigin,
      201
    );
  } catch (error) {
    return createErrorResponse(
      'Failed to process checkpoint submission',
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
    const [gardenState, hasLease, checkpoint] = await Promise.all([
      getLatestGardenStateFromDatabase(env.DB),
      hasActiveCuratorLease(env.DB),
      getLatestEngineCheckpoint(env.DB),
    ]);

    const tick = checkpoint?.tick ?? gardenState?.tick ?? 0;

    const health: HealthStatus = {
      status: 'healthy',
      tick,
      timestamp: new Date().toISOString(),
      version: '1.9.0',
      databaseReady: true,
      activeCuratorLease: hasLease,
      gardenState: gardenState ? {
        tick: gardenState.tick,
        timestamp: gardenState.timestamp
      } : null,
      config: {
        tickIntervalMinutes: 15
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

    if (path === '/api/garden/checkpoint' && request.method === 'POST') {
      return handlePostCheckpoint(request, env, corsOrigin);
    }

    if ((path === '/api/garden/lease' || path === '/api/garden/curator-lease') && request.method === 'POST') {
      return handlePostLease(request, env, corsOrigin);
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
          { path: '/api/garden', method: 'GET', description: 'Get canonical garden bootstrap state' },
          { path: '/api/garden/checkpoint', method: 'POST', description: 'Commit validated engine checkpoint (curator lease protected)' },
          { path: '/api/garden/lease', method: 'POST', description: 'Acquire or renew temporary curator lease' },
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
