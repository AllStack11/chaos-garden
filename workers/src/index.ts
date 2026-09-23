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
  getEngineCheckpointById,
  saveEngineCheckpoint,
  pruneEngineCheckpoints,
  getActiveCuratorLease,
  hasActiveCuratorLease,
  acquireOrRenewCuratorLease,
  getCanonicalAnchor,
  getChronicleEvents,
  commitCanonicalCheckpoint,
  recordApiMetric,
  getDiagnosticsSummary,
  getGardenStatsBucketed,
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
  type CanonicalCheckpointSubmission,
  type ChronicleEvent,
  type DiagnosticsSummary,
  type ApiErrorCode,
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
  CANONICAL_WRITES_DISABLED?: string | boolean;
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

export function resetDatabaseReadyForTesting(): void {
  databaseReadyPromise = null;
}

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

function generateRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

/** Create a successful JSON response adhering to Phase 4 v1 contracts while maintaining backwards compatibility */
function createSuccessResponse<T>(
  data: T,
  corsOrigin: string,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  const now = new Date().toISOString();
  const responseBody = {
    ok: true,
    apiVersion: 1,
    serverTime: now,
    success: true,
    timestamp: now,
    data,
    ...(typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}),
  };

  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(corsOrigin),
      ...extraHeaders,
    },
  });
}

/** Create an error response adhering to Phase 4 v1 contracts while maintaining backwards compatibility */
function createErrorResponse(
  message: string,
  corsOrigin: string,
  status = 500,
  details?: unknown,
  isDevelopment = false,
  code?: ApiErrorCode,
  requestId?: string,
  extraHeaders: Record<string, string> = {}
): Response {
  const reqId = requestId || generateRequestId();

  let errorCode: ApiErrorCode = code || 'INVALID_REQUEST';
  if (!code) {
    if (status === 401) errorCode = 'UNAUTHENTICATED';
    else if (status === 403) errorCode = 'FORBIDDEN';
    else if (status === 404) errorCode = 'NOT_FOUND';
    else if (status === 409) errorCode = 'LEASE_CONFLICT';
    else if (status === 413) errorCode = 'INVALID_REQUEST';
    else if (status === 429) errorCode = 'RATE_LIMITED';
    else if (status === 503) errorCode = 'UNAVAILABLE';
    else if (status >= 500) errorCode = 'UNAVAILABLE';
  }

  const responseBody: Record<string, unknown> = {
    ok: false,
    apiVersion: 1,
    code: errorCode,
    message,
    requestId: reqId,
    error: message,
    success: false,
    timestamp: new Date().toISOString(),
  };

  if (isDevelopment && details !== undefined) {
    responseBody.details = details;
  }

  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(corsOrigin),
      ...extraHeaders,
    },
  });
}

/** Create a not found response */
function createNotFoundResponse(corsOrigin: string, message = 'Resource not found'): Response {
  return createErrorResponse(message, corsOrigin, 404, undefined, false, 'NOT_FOUND');
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
 * Returns canonical garden bootstrap state with checkpoint and chronicle events.
 */
async function handleGetGarden(env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    await logger.info('api_get_garden', 'Fetching current garden state');
    recordApiMetric(env.DB, 'garden_reads').catch(() => {});

    // 1. Get canonical anchor and latest garden state in parallel
    const [anchor, gardenState] = await Promise.all([
      getCanonicalAnchor(env.DB),
      getLatestGardenStateFromDatabase(env.DB),
    ]);

    if (!gardenState && !anchor) {
      return createNotFoundResponse(corsOrigin, 'No garden state found - garden may not be initialized');
    }

    // 2. Get all living entities, dead matter, chronicle events, and checkpoint
    const [entities, deadMatter, rawChronicleEvents, checkpoint] = await Promise.all([
      getAllLivingEntitiesFromDatabase(env.DB),
      getDeadMatterFromDatabase(env.DB),
      getChronicleEvents(env.DB, 50),
      anchor?.checkpointId
        ? getEngineCheckpointById(env.DB, anchor.checkpointId)
        : getLatestEngineCheckpoint(env.DB),
    ]);

    let chronicleEvents: ChronicleEvent[] = [];
    if (rawChronicleEvents.length > 0) {
      chronicleEvents = rawChronicleEvents;
    } else {
      const legacyEvents = await getRecentSimulationEventsFromDatabase(env.DB, 20);
      chronicleEvents = legacyEvents.map((e) => ({
        id: String(e.id),
        tick: e.tick,
        timestamp: e.timestamp,
        type: e.eventType,
        severity: e.severity,
        description: e.description,
        tags: e.tags ?? [],
      }));
    }

    const effectiveTick = anchor?.canonicalTick ?? checkpoint?.tick ?? gardenState?.tick ?? 0;
    const exactContinuation = !!(
      checkpoint &&
      anchor &&
      checkpoint.tick === anchor.canonicalTick &&
      (!anchor.checksum || checkpoint.checksum === anchor.checksum)
    );

    const canonicalState: CanonicalWorldState = {
      id: gardenState?.id ?? 1,
      tick: effectiveTick,
      epoch: Math.floor(effectiveTick / 1200),
      timestamp: gardenState?.timestamp ?? new Date().toISOString(),
      seed: checkpoint?.seed ?? 42,
      atmospheric: {
        temperature: gardenState?.environment?.temperature ?? 20,
        sunlight: gardenState?.environment?.sunlight ?? 0.5,
        moisture: gardenState?.environment?.moisture ?? 0.5,
        weatherState: gardenState?.environment?.weatherState ?? undefined,
      },
      populationSummary: gardenState?.populationSummary ?? {
        plants: 0,
        herbivores: 0,
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
        totalLiving: 0,
        totalDead: 0,
        allTimeDead: 0,
        total: 0,
      },
      entities,
      deadMatter,
      soil: {
        cols: 50,
        rows: 37,
        moisture: [],
        nitrates: [],
      },
      checksum: checkpoint?.checksum ?? `state-${effectiveTick}`,
      checkpoint: checkpoint ?? undefined,
    };

    const responseData = {
      canonicalState,
      checkpoint: checkpoint ?? undefined,
      events: chronicleEvents,
      exactContinuation,
      gardenState: gardenState ?? undefined,
      entities,
      deadMatter,
      timestamp: new Date().toISOString(),
    };

    await logger.debug('api_get_garden_success', 'Garden state retrieved', {
      tick: canonicalState.tick,
      hasCheckpoint: !!checkpoint,
      exactContinuation,
      entityCount: entities.length,
      deadMatterCount: deadMatter.length,
      eventCount: chronicleEvents.length,
    });

    return createSuccessResponse(responseData, corsOrigin, 200, {
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=45',
    });
  } catch (error) {
    const logger = createApplicationLogger(env.DB, 'API');
    await logger.error('api_get_garden_failed', 'Failed to fetch garden state', {
      error: error instanceof Error ? error.message : String(error),
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
 * Supports bounded bucketing with ?fromTick=&toTick=&bucket=
 */
async function handleGetGardenStats(request: Request, env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    const url = new URL(request.url);
    const fromTickParam = url.searchParams.get('fromTick');
    const toTickParam = url.searchParams.get('toTick');

    if (fromTickParam !== null && toTickParam !== null) {
      const fromTick = parseInt(fromTickParam, 10);
      const toTick = parseInt(toTickParam, 10);

      if (isNaN(fromTick) || isNaN(toTick) || fromTick < 0 || toTick < fromTick) {
        return createErrorResponse(
          'Invalid tick range: fromTick and toTick must be non-negative integers with fromTick <= toTick',
          corsOrigin,
          400,
          undefined,
          isDevelopment,
          'INVALID_REQUEST'
        );
      }

      if (toTick - fromTick > 50000) {
        return createErrorResponse(
          'Tick range exceeds maximum span of 50,000 ticks',
          corsOrigin,
          400,
          undefined,
          isDevelopment,
          'INVALID_REQUEST'
        );
      }

      const bucketParam = url.searchParams.get('bucket');
      let bucket = bucketParam ? parseInt(bucketParam, 10) : 1;
      if (isNaN(bucket) || bucket < 1) {
        bucket = Math.max(1, Math.ceil((toTick - fromTick) / 500));
      }

      const bucketedRows = await getGardenStatsBucketed(env.DB, fromTick, toTick, bucket);
      return createSuccessResponse(bucketedRows, corsOrigin, 200, {
        'Cache-Control': 'public, max-age=60',
      });
    }

    const parsedWindow = parseWindowTicks(url.searchParams);
    if (!parsedWindow.valid) {
      return createErrorResponse(
        parsedWindow.error ?? 'Invalid windowTicks parameter',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_REQUEST'
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
    }, corsOrigin, 200, {
      'Cache-Control': 'public, max-age=60',
    });
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
  const requestId = generateRequestId();

  try {
    const body = (await request.json().catch(() => ({}))) as {
      curatorId?: string;
      authorizedTick?: number;
      leaseId?: string;
      renewLeaseId?: string;
      ttlMs?: number;
    };

    // Authenticate and authorize curator identity
    const auth = authenticateCuratorRequest(request, env, body.curatorId);
    if (!auth.success) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        auth.error,
        corsOrigin,
        auth.status,
        undefined,
        isDevelopment,
        auth.status === 401 ? 'UNAUTHENTICATED' : auth.status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE',
        requestId
      );
    }

    const curatorId = auth.curator.curatorId;
    const requestedLeaseId = body.renewLeaseId || body.leaseId;

    let authorizedTick = body.authorizedTick;
    if (typeof authorizedTick !== 'number') {
      const anchor = await getCanonicalAnchor(env.DB);
      authorizedTick = anchor?.canonicalTick ?? 0;
      if (authorizedTick === 0) {
        authorizedTick = await getLatestCheckpointTick(env.DB);
        if (authorizedTick < 0) {
          const latestState = await getLatestGardenStateFromDatabase(env.DB);
          authorizedTick = latestState?.tick ?? 0;
        }
      }
    }

    const result = await acquireOrRenewCuratorLease(
      env.DB,
      curatorId,
      authorizedTick,
      requestedLeaseId,
      body.ttlMs ?? 120000
    );

    if ('error' in result) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        result.error,
        corsOrigin,
        409,
        { conflictingCuratorId: result.conflictingCuratorId },
        isDevelopment,
        'LEASE_CONFLICT',
        requestId
      );
    }

    await logger.info('api_lease_granted', 'Curator lease issued/renewed', {
      leaseId: result.lease.leaseId,
      curatorId: result.lease.curatorId,
      expiresAtMs: result.lease.expiresAtMs,
    });

    return createSuccessResponse(result.lease, corsOrigin, 200);
  } catch (error) {
    recordApiMetric(env.DB, 'server_errors').catch(() => {});
    return createErrorResponse(
      'Failed to acquire curator lease',
      corsOrigin,
      500,
      error instanceof Error ? error.message : String(error),
      isDevelopment,
      'UNAVAILABLE',
      requestId
    );
  }
}

/**
 * Handle POST /api/garden/checkpoint
 * Validates curator lease, monotonic tick, SHA-256 integrity, binary header,
 * and atomically persists the deterministic engine checkpoint and chronicle events.
 */
async function handlePostCheckpoint(request: Request, env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);
  const requestId = generateRequestId();

  try {
    // 0. Emergency killswitch check
    if (env.CANONICAL_WRITES_DISABLED === 'true' || env.CANONICAL_WRITES_DISABLED === true) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Service Unavailable: Emergency killswitch active (CANONICAL_WRITES_DISABLED)',
        corsOrigin,
        503,
        undefined,
        isDevelopment,
        'UNAVAILABLE',
        requestId
      );
    }

    // 1. Verify curator authorization
    const auth = authenticateCuratorRequest(request, env);
    if (!auth.success) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        auth.error,
        corsOrigin,
        auth.status,
        undefined,
        isDevelopment,
        auth.status === 401 ? 'UNAUTHENTICATED' : auth.status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE',
        requestId
      );
    }

    // 2. Body limit check (1 MiB cap)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Payload Too Large: checkpoint submission exceeds 1 MiB limit',
        corsOrigin,
        413,
        undefined,
        isDevelopment,
        'INVALID_REQUEST',
        requestId
      );
    }

    const rawText = await request.text().catch(() => '');
    if (rawText.length > 1024 * 1024) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Payload Too Large: checkpoint submission exceeds 1 MiB limit',
        corsOrigin,
        413,
        undefined,
        isDevelopment,
        'INVALID_REQUEST',
        requestId
      );
    }

    let submission: CanonicalCheckpointSubmission;
    try {
      submission = JSON.parse(rawText);
    } catch {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Malformed JSON request body',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_REQUEST',
        requestId
      );
    }

    if (!submission || !submission.leaseId || !submission.checkpoint) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Missing leaseId or checkpoint in request payload',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_REQUEST',
        requestId
      );
    }

    // 3. Verify active curator lease
    const activeLease = await getActiveCuratorLease(env.DB, submission.leaseId);
    if (!activeLease) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Invalid or expired curator lease',
        corsOrigin,
        403,
        undefined,
        isDevelopment,
        'FORBIDDEN',
        requestId
      );
    }

    // Verify lease owner matches authenticated curator
    if (activeLease.curatorId !== auth.curator.curatorId) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Forbidden: Curator identity does not match active lease holder',
        corsOrigin,
        403,
        undefined,
        isDevelopment,
        'FORBIDDEN',
        requestId
      );
    }

    const checkpoint = submission.checkpoint;

    // 4. Format and envelope validation
    if (
      typeof checkpoint.tick !== 'number' ||
      typeof checkpoint.version !== 'number' ||
      typeof checkpoint.seed !== 'number' ||
      typeof checkpoint.byteLength !== 'number' ||
      !checkpoint.checksum ||
      !checkpoint.payload
    ) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Malformed EncodedEngineCheckpoint envelope',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    // 5. Decode payload bytes
    let rawBytes: Uint8Array;
    try {
      rawBytes = base64ToUint8Array(checkpoint.payload);
    } catch {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Malformed base64 payload in checkpoint',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    if (rawBytes.byteLength !== checkpoint.byteLength) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        `Payload byte length mismatch: expected ${checkpoint.byteLength}, got ${rawBytes.byteLength}`,
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    // 6. SHA-256 checksum verification
    const computedChecksum = await computeSha256Hex(rawBytes);
    if (computedChecksum.toLowerCase() !== checkpoint.checksum.toLowerCase()) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        `Checksum mismatch: computed ${computedChecksum}, expected ${checkpoint.checksum}`,
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    // 7. Binary header validation (minimum 44 bytes for CGS2 format)
    if (rawBytes.byteLength < 44) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Checkpoint binary payload smaller than header length',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== 0x43475332) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        'Invalid checkpoint magic bytes (expected CGS2)',
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    const headerVersion = view.getUint32(4, true);
    if (headerVersion !== checkpoint.version) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        `Header version (${headerVersion}) does not match checkpoint version (${checkpoint.version})`,
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    const headerTick = view.getUint32(8, true);
    if (headerTick !== checkpoint.tick) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      return createErrorResponse(
        `Header tick (${headerTick}) does not match checkpoint tick (${checkpoint.tick})`,
        corsOrigin,
        400,
        undefined,
        isDevelopment,
        'INVALID_CHECKPOINT',
        requestId
      );
    }

    // 8. Commit canonical checkpoint atomically with write fencing & idempotency
    const commitResult = await commitCanonicalCheckpoint(
      env.DB,
      submission,
      {
        leaseId: activeLease.leaseId,
        curatorId: auth.curator.curatorId,
        nowMs: Date.now(),
      }
    );

    if (!commitResult.success || !commitResult.result) {
      recordApiMetric(env.DB, 'rejected_writes').catch(() => {});
      if (commitResult.staleCanonical) {
        return createErrorResponse(
          commitResult.error || 'Stale base canonical tick',
          corsOrigin,
          409,
          undefined,
          isDevelopment,
          'STALE_CANONICAL',
          requestId
        );
      }
      if (commitResult.conflict) {
        return createErrorResponse(
          commitResult.error || 'Checkpoint commit conflict',
          corsOrigin,
          409,
          undefined,
          isDevelopment,
          'LEASE_CONFLICT',
          requestId
        );
      }
      return createErrorResponse(
        commitResult.error || 'Failed to commit canonical checkpoint',
        corsOrigin,
        500,
        undefined,
        isDevelopment,
        'UNAVAILABLE',
        requestId
      );
    }

    // 9. Success response
    recordApiMetric(env.DB, 'checkpoint_commits').catch(() => {});
    const isIdempotent = commitResult.idempotent === true;
    const statusCode = isIdempotent ? 200 : 201;

    const responseData = {
      committed: true,
      tick: commitResult.result.tick,
      canonicalTick: commitResult.result.canonicalTick,
      checksum: commitResult.result.checksum,
      committedAt: commitResult.result.committedAt,
      chronicleEventIds: commitResult.result.chronicleEventIds,
    };

    await logger.info('api_checkpoint_saved', 'Canonical checkpoint committed successfully', {
      tick: checkpoint.tick,
      checksum: checkpoint.checksum,
      idempotent: isIdempotent,
    });

    return createSuccessResponse(responseData, corsOrigin, statusCode);
  } catch (error) {
    recordApiMetric(env.DB, 'server_errors').catch(() => {});
    return createErrorResponse(
      'Failed to process checkpoint submission',
      corsOrigin,
      500,
      error instanceof Error ? error.message : String(error),
      isDevelopment,
      'UNAVAILABLE',
      requestId
    );
  }
}

/**
 * Handle GET /api/health
 * Returns system health status (sanitized public operational metadata).
 */
async function handleGetHealth(env: Env, corsOrigin: string): Promise<Response> {
  const isDevelopment = env.ENVIRONMENT !== 'production';
  const logger = createApplicationLogger(env.DB, 'API', undefined, isDevelopment);

  try {
    const [gardenState, hasLease, checkpoint, anchor] = await Promise.all([
      getLatestGardenStateFromDatabase(env.DB),
      hasActiveCuratorLease(env.DB),
      getLatestEngineCheckpoint(env.DB),
      getCanonicalAnchor(env.DB),
    ]);

    const tick = anchor?.canonicalTick ?? checkpoint?.tick ?? gardenState?.tick ?? 0;

    const health: HealthStatus = {
      status: 'healthy',
      tick,
      timestamp: new Date().toISOString(),
      version: CURRENT_SCHEMA_VERSION,
      databaseReady: true,
      activeCuratorLease: hasLease,
      canonicalTick: tick,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      gardenState: gardenState ? {
        tick: gardenState.tick,
        timestamp: gardenState.timestamp,
      } : null,
      config: {
        tickIntervalMinutes: 15,
      },
    };

    await logger.debug('api_health', 'Health check performed', { status: health.status, tick: health.tick });

    return createSuccessResponse(health, corsOrigin, 200);
  } catch (error) {
    const logger = createApplicationLogger(env.DB, 'API');
    await logger.error('api_health_failed', 'Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Sanitized: no secret, stack trace, or DB error detail in public health
    return createErrorResponse(
      'System unhealthy',
      corsOrigin,
      503,
      undefined,
      false,
      'UNAVAILABLE'
    );
  }
}

/**
 * Handle GET /api/diagnostics/summary
 * Returns operational diagnostics summary with 60s edge cache.
 */
async function handleGetDiagnosticsSummary(env: Env, corsOrigin: string): Promise<Response> {
  try {
    const summary = await getDiagnosticsSummary(env.DB);
    return createSuccessResponse(summary, corsOrigin, 200, {
      'Cache-Control': 'public, max-age=60',
    });
  } catch (error) {
    return createErrorResponse(
      'Failed to retrieve diagnostics summary',
      corsOrigin,
      500,
      undefined,
      false,
      'UNAVAILABLE'
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

    if (path === '/api/diagnostics/summary' && request.method === 'GET') {
      return handleGetDiagnosticsSummary(env, corsOrigin);
    }

    // Handle root path
    if (path === '/' || path === '/api') {
      return new Response(JSON.stringify({
        name: 'Chaos Garden API',
        version: CURRENT_SCHEMA_VERSION,
        endpoints: [
          { path: '/api/garden', method: 'GET', description: 'Get canonical garden bootstrap state' },
          { path: '/api/garden/checkpoint', method: 'POST', description: 'Commit validated engine checkpoint (curator lease protected)' },
          { path: '/api/garden/lease', method: 'POST', description: 'Acquire or renew temporary curator lease' },
          { path: '/api/garden/stats', method: 'GET', description: 'Get historical garden analytics' },
          { path: '/api/health', method: 'GET', description: 'System health check' },
          { path: '/api/diagnostics/summary', method: 'GET', description: 'Aggregated operational diagnostics and metrics' }
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
