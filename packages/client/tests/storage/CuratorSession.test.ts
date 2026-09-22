import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CuratorSession } from '../../src/storage/CuratorSession.js';
import type { EncodedEngineCheckpoint } from '@chaos-garden/shared';

describe('CuratorSession Unit Tests', () => {
  let session: CuratorSession;

  beforeEach(() => {
    session = new CuratorSession();
  });

  it('keeps credentials strictly in memory', () => {
    expect(session.isAuthenticated).toBe(false);
    expect(session.currentCuratorId).toBeNull();

    session.setCredentials('mock-bearer-token', 'curator-123');

    expect(session.isAuthenticated).toBe(true);
    expect(session.currentCuratorId).toBe('curator-123');

    session.clearSession();
    expect(session.isAuthenticated).toBe(false);
    expect(session.currentCuratorId).toBeNull();
  });

  it('acquires and renews curator lease with valid bearer token', async () => {
    session.setCredentials('secret-token', 'curator-bob');

    const mockLease = {
      leaseId: 'lease-xyz',
      curatorId: 'curator-bob',
      grantedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60000,
      authorizedTick: 100,
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockLease }),
    })) as unknown as typeof fetch;

    const lease = await session.acquireOrRenewLease('/api/garden/lease');

    expect(lease).toEqual(mockLease);
    expect(session.currentLease).toEqual(mockLease);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/garden/lease',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
        },
      }),
    );
  });

  it('submits checkpoint with leaseId and authorization header', async () => {
    session.setCredentials('secret-token', 'curator-bob');

    const mockLease = {
      leaseId: 'lease-123',
      curatorId: 'curator-bob',
      grantedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60000,
      authorizedTick: 50,
    };

    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/lease')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockLease }),
        };
      }
      if (url.includes('/checkpoint')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true }),
        };
      }
      return { ok: false, status: 404 };
    }) as unknown as typeof fetch;

    await session.acquireOrRenewLease('/api/garden/lease');

    const checkpoint: EncodedEngineCheckpoint = {
      version: 1,
      tick: 55,
      seed: 42,
      byteLength: 64,
      checksum: 'sha-55',
      payload: 'data55',
    };

    const res = await session.submitCheckpoint(checkpoint, '/api/garden/checkpoint');

    expect(res.success).toBe(true);
    expect(res.status).toBe(201);
  });

  it('handles 409 stale tick conflict as terminal without modifying local simulation', async () => {
    session.setCredentials('secret-token', 'curator-bob');

    const mockLease = {
      leaseId: 'lease-conflict',
      curatorId: 'curator-bob',
      grantedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60000,
      authorizedTick: 50,
    };

    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/lease')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockLease }),
        };
      }
      if (url.includes('/checkpoint')) {
        return {
          ok: false,
          status: 409,
          text: async () => 'Stale tick conflict: server has advanced beyond tick 50',
        };
      }
      return { ok: false, status: 404 };
    }) as unknown as typeof fetch;

    await session.acquireOrRenewLease('/api/garden/lease');

    const staleCheckpoint: EncodedEngineCheckpoint = {
      version: 1,
      tick: 48,
      seed: 42,
      byteLength: 64,
      checksum: 'sha-48',
      payload: 'data48',
    };

    const res = await session.submitCheckpoint(staleCheckpoint, '/api/garden/checkpoint');

    expect(res.success).toBe(false);
    expect(res.status).toBe(409);
    expect(res.isStaleTickConflict).toBe(true);
  });
});

