import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LocalPersistence,
  type CanonicalPersistenceRecord,
  type LocalBranchPersistenceRecord,
} from '../../src/storage/LocalPersistence.js';
import {
  type GardenBootstrapResponse,
  type EncodedEngineCheckpoint,
  DEFAULT_ATMOSPHERIC_STATE,
} from '@chaos-garden/shared';

describe('LocalPersistence Unit Tests (Phase 3 Dual-Store)', () => {
  let persistence: LocalPersistence;

  beforeEach(() => {
    persistence = new LocalPersistence();
  });

  it('boots from API when remote endpoint returns valid envelope and saves to canonical store', async () => {
    const mockEnvelope: GardenBootstrapResponse = {
      canonicalState: {
        id: 1,
        tick: 450,
        epoch: 1,
        timestamp: '2026-09-22T00:00:00Z',
        seed: 42,
        atmospheric: { ...DEFAULT_ATMOSPHERIC_STATE, sunlight: 1 },
        populationSummary: { plants: 10, herbivores: 5, carnivores: 2, fungi: 3, deadMatterCount: 0, totalLiving: 20, totalBiomass: 1500, allTimeBirths: 0, allTimeDeaths: 0 },
        entities: [],
        deadMatter: [],
        soil: { cols: 10, rows: 10, cellSize: 16, moisture: [], nitrates: [] },
        checksum: 'snap-450-20',
      },
      checkpoint: {
        version: 1,
        tick: 450,
        seed: 42,
        byteLength: 64,
        checksum: 'sha-450',
        payload: 'payload450',
      },
      events: [],
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: mockEnvelope }),
    })) as unknown as typeof fetch;

    persistence.saveCanonical = vi.fn(async () => {});

    const result = await persistence.bootload('/api/garden');

    expect(result.source).toBe('API');
    expect(result.candidate?.kind).toBe('canonical');
    expect(result.candidate?.checkpoint).toEqual(mockEnvelope.checkpoint);
    expect(persistence.saveCanonical).toHaveBeenCalledWith(mockEnvelope);
  });

  it('falls back to IndexedDB canonical cache when API is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    }) as unknown as typeof fetch;

    const cachedEnvelope: GardenBootstrapResponse = {
      canonicalState: {
        id: 1,
        tick: 300,
        epoch: 1,
        timestamp: '2026-09-22T00:00:00Z',
        seed: 99,
        atmospheric: { ...DEFAULT_ATMOSPHERIC_STATE, sunlight: 0.8 },
        populationSummary: { plants: 5, herbivores: 2, carnivores: 1, fungi: 1, deadMatterCount: 0, totalLiving: 9, totalBiomass: 600, allTimeBirths: 0, allTimeDeaths: 0 },
        entities: [],
        deadMatter: [],
        soil: { cols: 10, rows: 10, cellSize: 16, moisture: [], nitrates: [] },
        checksum: 'snap-300-9',
      },
      events: [],
    };

    const cachedRecord: CanonicalPersistenceRecord = {
      kind: 'canonical',
      capturedAtMs: Date.now() - 10000,
      baseCheckpointTick: 300,
      baseCheckpointChecksum: 'snap-300-9',
      codecVersion: 1,
      bootstrapEnvelope: cachedEnvelope,
      byteSize: 500,
    };

    persistence.loadCanonical = vi.fn(async () => cachedRecord);

    const result = await persistence.bootload('/api/garden');

    expect(result.source).toBe('INDEXED_DB_CANONICAL');
    expect(result.candidate?.kind).toBe('canonical');
    expect(result.candidate?.canonicalState?.tick).toBe(300);
  });

  it('loads explicit local branch when selectedBranchId is passed', async () => {
    const branchCheckpoint: EncodedEngineCheckpoint = {
      version: 1,
      tick: 777,
      seed: 42,
      byteLength: 100,
      checksum: 'sha-777',
      payload: 'branchPayload',
    };

    const mockBranchRecord: LocalBranchPersistenceRecord = {
      kind: 'localBranch',
      branchId: 'my_branch_1',
      label: 'Experimental Branch 1',
      capturedAtMs: 1000,
      baseCheckpointTick: 777,
      baseCheckpointChecksum: 'sha-777',
      codecVersion: 1,
      checkpoint: branchCheckpoint,
      byteSize: 200,
    };

    persistence.loadLocalBranch = vi.fn(async (id: string) => {
      if (id === 'my_branch_1') return mockBranchRecord;
      return null;
    });

    const result = await persistence.bootload('/api/garden', 'my_branch_1');

    expect(result.source).toBe('INDEXED_DB_BRANCH');
    expect(result.candidate?.kind).toBe('localBranch');
    expect(result.candidate?.checkpoint?.tick).toBe(777);
  });

  it('falls back to PRIMORDIAL when both API and IndexedDB are empty', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network offline');
    }) as unknown as typeof fetch;

    persistence.loadCanonical = vi.fn(async () => null);

    const result = await persistence.bootload('/api/garden');

    expect(result.source).toBe('PRIMORDIAL');
    expect(result.data).toBeNull();
    expect(result.candidate).toBeUndefined();
  });
});
