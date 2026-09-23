// `npm run deploy` builds this workspace dependency before Wrangler bundles.
import { World } from '../../packages/engine/dist/index.js';
import { CANONICAL_TICKS_PER_SCHEDULE } from '@chaos-garden/shared';
import type { D1Database, ScheduledEvent } from './types/worker';
import { CURRENT_SCHEMA_VERSION } from './db/migrations';
import {
  acquireOrRenewCuratorLease,
  commitCanonicalCheckpoint,
  getCanonicalAnchor,
  getCanonicalWorldState,
  getChronicleEvents,
  getEngineCheckpointById,
  getLatestEngineCheckpoint,
  hasActiveCuratorLease,
} from './db/queries';

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  CORS_ORIGIN?: string;
}

const WORKER_CURATOR_ID = 'worker-curator';
const WORKER_LEASE_ID = 'worker-canonical-lease';
let databaseReadyPromise: Promise<void> | null = null;

export function resetDatabaseReadyForTesting(): void {
  databaseReadyPromise = null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

function resolveCorsOrigin(request: Request, configuredOrigin: string): string {
  if (configuredOrigin === '*') return '*';
  const origin = request.headers.get('Origin');
  return origin === configuredOrigin ? origin : configuredOrigin;
}

function json(data: unknown, origin: string, status = 200): Response {
  return new Response(JSON.stringify({ ok: status < 400, success: status < 400, apiVersion: 1, timestamp: new Date().toISOString(), data, ...(typeof data === 'object' && data !== null ? data : {}) }), { status, headers: corsHeaders(origin) });
}

function error(message: string, origin: string, status: number): Response {
  return json({ error: message, message }, origin, status);
}

async function ensureDatabaseReady(db: D1Database): Promise<void> {
  if (!databaseReadyPromise) {
    const readyPromise = (async () => {
      const [version, anchor] = await Promise.all([
        db.prepare("SELECT value FROM system_metadata WHERE key = 'schema_version'").first<{ value: string }>(),
        db.prepare('SELECT id FROM canonical_anchor WHERE id = 1').first<{ id: number }>(),
      ]);
      if (version?.value !== CURRENT_SCHEMA_VERSION || !anchor) {
        throw new Error(`Database is not initialized for canonical schema ${CURRENT_SCHEMA_VERSION}`);
      }
    })();
    databaseReadyPromise = readyPromise;
    try {
      await readyPromise;
    } catch (cause) {
      // A D1 outage must not poison this isolate after the service recovers.
      if (databaseReadyPromise === readyPromise) databaseReadyPromise = null;
      throw cause;
    }
    return;
  }
  await databaseReadyPromise;
}

async function handleGetGarden(db: D1Database, origin: string): Promise<Response> {
  const anchor = await getCanonicalAnchor(db);
  if (!anchor?.checkpointId) return error('No canonical checkpoint has been committed', origin, 404);
  const [checkpoint, canonicalState, events] = await Promise.all([
    getEngineCheckpointById(db, anchor.checkpointId),
    getCanonicalWorldState(db, anchor.checkpointId),
    getChronicleEvents(db),
  ]);
  const exactContinuation = !!(checkpoint && canonicalState && checkpoint.tick === anchor.canonicalTick && checkpoint.checksum === anchor.checksum && canonicalState.tick === anchor.canonicalTick);
  if (!exactContinuation || !checkpoint || !canonicalState) return json({ exactContinuation: false, events }, origin);
  return json({ canonicalState, checkpoint, events, exactContinuation: true }, origin);
}

async function handleHealth(db: D1Database, origin: string): Promise<Response> {
  const [anchor, checkpoint, activeCuratorLease] = await Promise.all([getCanonicalAnchor(db), getLatestEngineCheckpoint(db), hasActiveCuratorLease(db)]);
  return json({ status: 'healthy', tick: anchor?.canonicalTick ?? checkpoint?.tick ?? 0, canonicalTick: anchor?.canonicalTick ?? 0, activeCuratorLease, version: CURRENT_SCHEMA_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION }, origin);
}

/** The only code path allowed to advance the canonical garden. */
export async function advanceCanonicalGarden(db: D1Database): Promise<void> {
  const anchor = await getCanonicalAnchor(db);
  const baseCanonicalTick = anchor?.canonicalTick ?? 0;
  const lease = await acquireOrRenewCuratorLease(db, WORKER_CURATOR_ID, baseCanonicalTick, WORKER_LEASE_ID);
  if ('error' in lease) throw new Error(lease.error);

  let world: World;
  if (anchor?.checkpointId) {
    const checkpoint = await getEngineCheckpointById(db, anchor.checkpointId);
    if (!checkpoint) throw new Error('Canonical anchor references a missing checkpoint');
    world = new World({ seed: checkpoint.seed });
    if (!(await world.hydrateEngineCheckpoint(checkpoint))) throw new Error('Canonical checkpoint failed integrity validation');
  } else {
    world = new World();
    world.seedPrimordialEcosystem();
  }
  for (let tick = 0; tick < CANONICAL_TICKS_PER_SCHEDULE; tick += 1) world.step();
  const checkpoint = await world.exportEngineCheckpoint();
  const canonicalState = world.exportCanonicalState() as unknown as import('@chaos-garden/shared').CanonicalWorldState;
  canonicalState.checksum = checkpoint.checksum;
  const commit = await commitCanonicalCheckpoint(db, { leaseId: lease.lease.leaseId, baseCanonicalTick, checkpoint, canonicalState, chronicleEvents: [] }, WORKER_CURATOR_ID);
  if (!commit.success) throw new Error(commit.error ?? 'Canonical checkpoint commit failed');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveCorsOrigin(request, env.CORS_ORIGIN ?? '*');
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    try {
      await ensureDatabaseReady(env.DB);
      const path = new URL(request.url).pathname;
      if (request.method === 'GET' && path === '/api/garden') return await handleGetGarden(env.DB, origin);
      if (request.method === 'GET' && path === '/api/health') return await handleHealth(env.DB, origin);
      if (path === '/' || path === '/api') return json({ name: 'Chaos Garden API', version: CURRENT_SCHEMA_VERSION, endpoints: [{ path: '/api/garden', method: 'GET' }, { path: '/api/health', method: 'GET' }] }, origin);
      return error(`No route found for ${request.method} ${path}`, origin, 404);
    } catch (cause) {
      return error(cause instanceof Error ? cause.message : 'Service unavailable', origin, 503);
    }
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    try {
      await ensureDatabaseReady(env.DB);
      await advanceCanonicalGarden(env.DB);
    } catch (cause) {
      console.error('Scheduled canonical advance failed', { cron: event.cron, error: cause instanceof Error ? cause.message : String(cause) });
    }
  },
};
