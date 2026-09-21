import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../../../src/index';
import {
  uint8ArrayToBase64,
  computeSha256Hex,
  type EncodedEngineCheckpoint,
  type CheckpointSubmission,
} from '@chaos-garden/shared';

describe('Workers API - Checkpoints and Curator Leases', () => {
  let mockDb: any;
  let env: Env;
  let checkpointsTable: Array<{
    id: number;
    tick: number;
    engine_version: number;
    seed: number;
    checksum: string;
    payload: any;
    created_at: string;
  }>;
  let leasesTable: Array<{
    lease_id: string;
    curator_id: string;
    granted_at_ms: number;
    expires_at_ms: number;
    authorized_tick: number;
    created_at: string;
  }>;

  const validCuratorHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-curator-secret',
    'X-Curator-Id': 'curator-alice',
  };

  let expireLeaseAfterRead = false;

  beforeEach(() => {
    checkpointsTable = [];
    leasesTable = [];
    expireLeaseAfterRead = false;

    mockDb = {
      prepare: vi.fn((rawQuery: string) => {
        const query = rawQuery.replace(/\s+/g, ' ');
        const createExecutionObj = (params: any[] = []) => ({
          first: vi.fn(async () => {
            if (query.includes("WHERE key = 'schema_version'")) {
              return { value: '1.9.0' };
            }
            if (query.includes('FROM garden_state WHERE tick = 0')) {
              return { id: 1 };
            }
            if (query.includes('SELECT MAX(tick) as max_tick FROM engine_checkpoints')) {
              if (checkpointsTable.length === 0) return { max_tick: null };
              const max = Math.max(...checkpointsTable.map((c) => c.tick));
              return { max_tick: max };
            }
            if (query.includes('FROM curator_leases') && query.includes('lease_id = ?')) {
              const [leaseId, now] = params;
              const found = leasesTable.find(
                (l) => l.lease_id === leaseId && l.expires_at_ms > now
              );
              if (found && expireLeaseAfterRead) {
                found.expires_at_ms = 0;
              }
              return found ?? null;
            }
            if (query.includes('FROM curator_leases') && query.includes('expires_at_ms > ?')) {
              const [now] = params;
              const active = leasesTable
                .filter((l) => l.expires_at_ms > now)
                .sort((a, b) => b.expires_at_ms - a.expires_at_ms);
              return active[0] ?? null;
            }
            if (query.includes('FROM engine_checkpoints ORDER BY tick DESC LIMIT 1')) {
              if (checkpointsTable.length === 0) return null;
              const sorted = [...checkpointsTable].sort((a, b) => b.tick - a.tick);
              return sorted[0];
            }
            if (query.includes('FROM garden_state')) {
              return {
                id: 1,
                tick: 100,
                timestamp: new Date().toISOString(),
                environment: {
                  temperature: 20,
                  sunlight: 0.5,
                  moisture: 0.5,
                  weatherState: null,
                },
                populationSummary: {
                  plants: 10,
                  herbivores: 5,
                  carnivores: 2,
                  fungi: 1,
                  totalLiving: 18,
                  totalDead: 0,
                  allTimeDead: 0,
                },
              };
            }
            if (query.includes('SELECT COUNT(*) as count FROM curator_leases')) {
              const [now] = params;
              const count = leasesTable.filter((l) => l.expires_at_ms > now).length;
              return { count };
            }
            return null;
          }),
          all: vi.fn(async () => {
            if (query.includes('FROM entities')) {
              return { results: [] };
            }
            if (query.includes('FROM dead_matter')) {
              return { results: [] };
            }
            if (query.includes('FROM simulation_events')) {
              return { results: [] };
            }
            return { results: [] };
          }),
          run: vi.fn(async () => {
            if (query.includes('INSERT OR IGNORE INTO curator_leases') || query.includes('INSERT INTO curator_leases')) {
              if (leasesTable.length === 0) {
                leasesTable.push({
                  id: 1,
                  lease_id: 'initial',
                  curator_id: 'none',
                  granted_at_ms: 0,
                  expires_at_ms: 0,
                  authorized_tick: 0,
                  created_at: new Date().toISOString(),
                });
              }
              return { success: true, meta: { changes: 1 } };
            }
            if (query.includes('UPDATE curator_leases SET authorized_tick = ?')) {
              const [authTick, leaseId] = params;
              const target = leasesTable.find((l) => l.lease_id === leaseId);
              if (target) {
                target.authorized_tick = authTick;
              }
              return { success: true, meta: { changes: 1 } };
            }
            if (query.includes('UPDATE curator_leases')) {
              const [leaseId, curatorId, grantedAt, expiresAt, authorizedTick, now, checkCuratorId, requestedLeaseId] = params;
              if (leasesTable.length === 0) {
                leasesTable.push({
                  id: 1,
                  lease_id: leaseId,
                  curator_id: curatorId,
                  granted_at_ms: grantedAt,
                  expires_at_ms: expiresAt,
                  authorized_tick: authorizedTick,
                  created_at: new Date().toISOString(),
                });
                return { success: true, meta: { changes: 1 } };
              }
              const current = leasesTable[0];
              const canClaim =
                current.expires_at_ms <= now ||
                current.curator_id === checkCuratorId ||
                (requestedLeaseId && current.lease_id === requestedLeaseId);

              if (canClaim) {
                current.lease_id = leaseId;
                current.curator_id = curatorId;
                current.granted_at_ms = grantedAt;
                current.expires_at_ms = expiresAt;
                current.authorized_tick = authorizedTick;
                return { success: true, meta: { changes: 1 } };
              } else {
                return { success: true, meta: { changes: 0 } };
              }
            }
            if (query.includes('INSERT INTO engine_checkpoints')) {
              if (query.includes('WHERE EXISTS')) {
                const [tick, engine_version, seed, checksum, payload, leaseId, curatorId, nowMs, reqTick] = params;
                const currentLease = leasesTable.find((l) => l.lease_id === leaseId);
                const isValid =
                  currentLease &&
                  currentLease.curator_id === curatorId &&
                  currentLease.expires_at_ms > nowMs &&
                  currentLease.authorized_tick < reqTick;

                if (!isValid) {
                  return { success: true, meta: { changes: 0 } };
                }

                checkpointsTable.push({
                  id: checkpointsTable.length + 1,
                  tick,
                  engine_version,
                  seed,
                  checksum,
                  payload,
                  created_at: new Date().toISOString(),
                });
                return { success: true, meta: { changes: 1 } };
              }

              const [tick, engine_version, seed, checksum, payload] = params;
              checkpointsTable.push({
                id: checkpointsTable.length + 1,
                tick,
                engine_version,
                seed,
                checksum,
                payload,
                created_at: new Date().toISOString(),
              });
              return { success: true };
              return { success: true, meta: { changes: 1 } };
            }
            if (query.includes('DELETE FROM engine_checkpoints')) {
              return { success: true };
            }
            return { success: true };
          }),
        });

        const statement: any = createExecutionObj([]);
        statement.bind = vi.fn((...params: any[]) => createExecutionObj(params));
        return statement;
      }),
    };

    env = {
      DB: mockDb,
      ENVIRONMENT: 'test',
      CORS_ORIGIN: '*',
      CURATOR_SECRET: 'test-curator-secret',
    };
  });

  async function createValidBinaryPayload(tick: number, version: number = 2): Promise<{
    rawBytes: Uint8Array;
    base64: string;
    checksum: string;
    byteLength: number;
  }> {
    const rawBytes = new Uint8Array(64);
    const view = new DataView(rawBytes.buffer);
    view.setUint32(0, 0x43475332, true); // 'CGS2'
    view.setUint32(4, version, true);     // version 2
    view.setUint32(8, tick, true);        // tick
    view.setUint32(12, 42, true);         // seed

    const checksum = await computeSha256Hex(rawBytes);
    const base64 = uint8ArrayToBase64(rawBytes);
    return { rawBytes, base64, checksum, byteLength: rawBytes.byteLength };
  }

  describe('Curator Leases (POST /api/garden/lease)', () => {
    it('rejects anonymous lease acquisition with 401', async () => {
      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curatorId: 'curator-alice', authorizedTick: 100 }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(401);

      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
    });

    it('rejects lease acquisition with invalid curator secret with 401', async () => {
      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-secret',
        },
        body: JSON.stringify({ curatorId: 'curator-alice', authorizedTick: 100 }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(401);
    });

    it('grants a new curator lease with valid credentials', async () => {
      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify({ curatorId: 'curator-alice', authorizedTick: 100 }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.curatorId).toBe('curator-alice');
      expect(json.data.authorizedTick).toBe(100);
      expect(json.data.expiresAtMs).toBeGreaterThan(Date.now());
      expect(leasesTable).toHaveLength(1);
    });

    it('renews an existing lease for the same curator', async () => {
      leasesTable.push({
        lease_id: 'existing-lease-1',
        curator_id: 'curator-alice',
        granted_at_ms: Date.now() - 10000,
        expires_at_ms: Date.now() + 60000,
        authorized_tick: 50,
        created_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify({ curatorId: 'curator-alice', authorizedTick: 120, leaseId: 'existing-lease-1' }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.leaseId).toBe('existing-lease-1');
      expect(json.data.authorizedTick).toBe(120);
      expect(leasesTable).toHaveLength(1);
    });

    it('rejects lease acquisition when active lease is held by another curator', async () => {
      leasesTable.push({
        lease_id: 'existing-lease-1',
        curator_id: 'curator-bob',
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 50,
        created_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify({ curatorId: 'curator-alice' }),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(409);

      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('held by another curator');
    });

    it('concurrent lease requests result in exactly one grant and one conflict (CAS invariant)', async () => {
      const reqAlice = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-curator-secret',
          'X-Curator-Id': 'curator-alice',
        },
        body: JSON.stringify({ curatorId: 'curator-alice', authorizedTick: 100 }),
      });

      const reqBob = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-curator-secret',
          'X-Curator-Id': 'curator-bob',
        },
        body: JSON.stringify({ curatorId: 'curator-bob', authorizedTick: 100 }),
      });

      // Fire both concurrently
      const [resAlice, resBob] = await Promise.all([
        worker.fetch(reqAlice, env),
        worker.fetch(reqBob, env),
      ]);

      const statuses = [resAlice.status, resBob.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Exactly 1 active lease row in singleton storage
      expect(leasesTable).toHaveLength(1);
    });
  });

  describe('Engine Checkpoints (POST /api/garden/checkpoint)', () => {
    it('rejects anonymous checkpoint submission with 401', async () => {
      const payloadInfo = await createValidBinaryPayload(150);
      const submission: CheckpointSubmission = {
        leaseId: 'some-lease',
        tick: 150,
        checkpoint: {
          version: 2,
          tick: 150,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(401);
    });

    it('rejects checkpoint submission from different curator than the lease holder with 403', async () => {
      leasesTable.push({
        lease_id: 'valid-lease',
        curator_id: 'curator-bob', // held by Bob
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 100,
        created_at: new Date().toISOString(),
      });

      const payloadInfo = await createValidBinaryPayload(150);
      const submission: CheckpointSubmission = {
        leaseId: 'valid-lease',
        tick: 150,
        checkpoint: {
          version: 2,
          tick: 150,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders, // Alice is authenticating
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(403);

      const json = await res.json() as any;
      expect(json.error).toContain('does not match active lease holder');
    });

    it('rejects checkpoint submission without valid curator lease', async () => {
      const payloadInfo = await createValidBinaryPayload(150);
      const submission: CheckpointSubmission = {
        leaseId: 'non-existent-lease',
        tick: 150,
        checkpoint: {
          version: 2,
          tick: 150,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(403);

      const json = await res.json() as any;
      expect(json.error).toContain('Invalid or expired curator lease');
    });

    it('rejects checkpoint submission when tick is not strictly monotonic', async () => {
      leasesTable.push({
        lease_id: 'valid-lease',
        curator_id: 'curator-alice',
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 200,
        created_at: new Date().toISOString(),
      });

      checkpointsTable.push({
        id: 1,
        tick: 200,
        engine_version: 2,
        seed: 42,
        checksum: 'abc',
        payload: new Uint8Array(64),
        created_at: new Date().toISOString(),
      });

      const payloadInfo = await createValidBinaryPayload(200);
      const submission: CheckpointSubmission = {
        leaseId: 'valid-lease',
        tick: 200,
        checkpoint: {
          version: 2,
          tick: 200,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(409);

      const json = await res.json() as any;
      expect(json.error).toContain('strictly greater');
    });

    it('rejects checkpoint submission when SHA-256 checksum mismatches', async () => {
      leasesTable.push({
        lease_id: 'valid-lease',
        curator_id: 'curator-alice',
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 200,
        created_at: new Date().toISOString(),
      });

      const payloadInfo = await createValidBinaryPayload(300);
      const submission: CheckpointSubmission = {
        leaseId: 'valid-lease',
        tick: 300,
        checkpoint: {
          version: 2,
          tick: 300,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: '0000000000000000000000000000000000000000000000000000000000000000',
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(400);

      const json = await res.json() as any;
      expect(json.error).toContain('Checksum mismatch');
    });

    it('rejects checkpoint submission when magic bytes are invalid', async () => {
      leasesTable.push({
        lease_id: 'valid-lease',
        curator_id: 'curator-alice',
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 200,
        created_at: new Date().toISOString(),
      });

      const rawBytes = new Uint8Array(64);
      const view = new DataView(rawBytes.buffer);
      view.setUint32(0, 0x11111111, true); // Invalid magic
      view.setUint32(4, 2, true);
      view.setUint32(8, 300, true);

      const checksum = await computeSha256Hex(rawBytes);
      const base64 = uint8ArrayToBase64(rawBytes);

      const submission: CheckpointSubmission = {
        leaseId: 'valid-lease',
        tick: 300,
        checkpoint: {
          version: 2,
          tick: 300,
          seed: 42,
          byteLength: rawBytes.byteLength,
          checksum,
          payload: base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(400);

      const json = await res.json() as any;
      expect(json.error).toContain('Invalid checkpoint magic bytes');
    });

    it('successfully persists valid checkpoint and returns 201', async () => {
      leasesTable.push({
        lease_id: 'valid-lease',
        curator_id: 'curator-alice',
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 200,
        created_at: new Date().toISOString(),
      });

      const payloadInfo = await createValidBinaryPayload(300);
      const submission: CheckpointSubmission = {
        leaseId: 'valid-lease',
        tick: 300,
        checkpoint: {
          version: 2,
          tick: 300,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(201);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.tick).toBe(300);
      expect(json.data.checksum).toBe(payloadInfo.checksum);
      expect(checkpointsTable).toHaveLength(1);
    });

    it('rejects checkpoint persistence if lease expires or hands off to new curator prior to commit (handoff race)', async () => {
      // Bob took over the singleton row
      leasesTable.push({
        id: 1,
        lease_id: 'bob-lease',
        curator_id: 'curator-bob',
        granted_at_ms: Date.now(),
        expires_at_ms: Date.now() + 100000,
        authorized_tick: 100,
        created_at: new Date().toISOString(),
      });

      const payloadInfo = await createValidBinaryPayload(300);
      const submission: CheckpointSubmission = {
        leaseId: 'alice-stale-lease',
        tick: 300,
        checkpoint: {
          version: 2,
          tick: 300,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders, // Alice attempts to commit
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect([403, 409]).toContain(res.status);

      // Invariant: zero checkpoints written by Alice
      expect(checkpointsTable).toHaveLength(0);
      // Invariant: Bob's lease on the singleton row remains uncorrupted
      expect(leasesTable[0].curator_id).toBe('curator-bob');
      expect(leasesTable[0].authorized_tick).toBe(100);
    });

    it('atomically rejects checkpoint insert when lease expires between pre-validation and persistence', async () => {
      expireLeaseAfterRead = true;
      const now = Date.now();
      leasesTable.push({
        id: 1,
        lease_id: 'valid-lease',
        curator_id: 'curator-alice',
        granted_at_ms: now - 50000,
        expires_at_ms: now + 50000,
        authorized_tick: 100,
        created_at: new Date().toISOString(),
      });

      const payloadInfo = await createValidBinaryPayload(300);
      const submission: CheckpointSubmission = {
        leaseId: 'valid-lease',
        tick: 300,
        checkpoint: {
          version: 2,
          tick: 300,
          seed: 42,
          byteLength: payloadInfo.byteLength,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
        },
      };

      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: validCuratorHeaders,
        body: JSON.stringify(submission),
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(409);

      const json = await res.json() as any;
      expect(json.error).toContain('Curator lease has expired or was superseded prior to checkpoint persistence');

      // Zero rows added to engine_checkpoints
      expect(checkpointsTable).toHaveLength(0);
    });
  });

  describe('Garden Bootstrap (GET /api/garden)', () => {
    it('returns GardenBootstrapResponse containing canonicalState, checkpoint, and events', async () => {
      const payloadInfo = await createValidBinaryPayload(500);
      checkpointsTable.push({
        id: 1,
        tick: 500,
        engine_version: 2,
        seed: 42,
        checksum: payloadInfo.checksum,
        payload: payloadInfo.rawBytes,
        created_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost/api/garden', {
        method: 'GET',
      });

      const res = await worker.fetch(req, env);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.canonicalState).toBeDefined();
      expect(json.data.canonicalState.tick).toBe(500);
      expect(json.data.checkpoint).toBeDefined();
      expect(json.data.checkpoint.tick).toBe(500);
      expect(json.data.checkpoint.checksum).toBe(payloadInfo.checksum);
      expect(Array.isArray(json.data.events)).toBe(true);
    });
  });

  describe('Production Environment without Secret (Fail-Closed Safety)', () => {
    it('fails closed with 500 when CURATOR_SECRET is absent in production for lease request', async () => {
      const prodEnv: Env = {
        DB: mockDb,
        ENVIRONMENT: 'production',
        CORS_ORIGIN: '*',
      };

      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer arbitrary-curator-token',
        },
        body: JSON.stringify({ curatorId: 'curator-attacker', authorizedTick: 100 }),
      });

      const res = await worker.fetch(req, prodEnv);
      expect(res.status).toBe(500);

      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('CURATOR_SECRET');
      expect(leasesTable).toHaveLength(0);
    });

    it('fails closed with 500 when CURATOR_SECRET is absent in production for checkpoint submission', async () => {
      const prodEnv: Env = {
        DB: mockDb,
        ENVIRONMENT: 'production',
        CORS_ORIGIN: '*',
      };

      const payloadInfo = await createValidBinaryPayload(100);
      const req = new Request('http://localhost/api/garden/checkpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer arbitrary-curator-token',
        },
        body: JSON.stringify({
          tick: 100,
          checksum: payloadInfo.checksum,
          payload: payloadInfo.base64,
          leaseToken: 'some-fake-lease',
        }),
      });

      const res = await worker.fetch(req, prodEnv);
      expect(res.status).toBe(500);

      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('CURATOR_SECRET');
      expect(checkpointsTable).toHaveLength(0);
    });

    it('fails closed with 500 by default when ENVIRONMENT is unconfigured and secret is absent', async () => {
      const unconfiguredEnv: Env = {
        DB: mockDb,
      };

      const req = new Request('http://localhost/api/garden/lease', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer arbitrary-curator-token',
        },
        body: JSON.stringify({ curatorId: 'curator-attacker', authorizedTick: 100 }),
      });

      const res = await worker.fetch(req, unconfiguredEnv);
      expect(res.status).toBe(500);

      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('CURATOR_SECRET');
    });
  });
});

