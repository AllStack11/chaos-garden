import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalPersistence } from '../../src/storage/LocalPersistence.js';

describe('LocalPersistence Unit Tests', () => {
  let persistence: LocalPersistence;

  beforeEach(() => {
    persistence = new LocalPersistence();
  });

  it('boots from API when remote endpoint returns valid response', async () => {
    const mockPayload = JSON.stringify({ tick: 450, seed: 42 });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => mockPayload,
    })) as any;

    persistence.saveSnapshot = vi.fn(async () => {});

    const result = await persistence.bootload('/api/garden');

    expect(result.source).toBe('API');
    expect(result.data).toBe(mockPayload);
    expect(persistence.saveSnapshot).toHaveBeenCalledWith(mockPayload);
  });

  it('falls back to IndexedDB cache when API is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    }) as any;

    const cachedPayload = JSON.stringify({ tick: 300, seed: 99 });
    persistence.loadCachedSnapshot = vi.fn(async () => cachedPayload);

    const result = await persistence.bootload('/api/garden');

    expect(result.source).toBe('INDEXED_DB');
    expect(result.data).toBe(cachedPayload);
  });

  it('falls back to PRIMORDIAL when both API and IndexedDB are unavailable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    }) as any;

    persistence.loadCachedSnapshot = vi.fn(async () => null);

    const result = await persistence.bootload('/api/garden');

    expect(result.source).toBe('PRIMORDIAL');
    expect(result.data).toBeNull();
  });
});

