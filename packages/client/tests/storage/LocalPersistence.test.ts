import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LocalPersistence,
  type CanonicalPersistenceRecord,
  type LocalBranchPersistenceRecord,
} from "../../src/storage/LocalPersistence.js";
import {
  type GardenBootstrapResponse,
  type EncodedEngineCheckpoint,
  DEFAULT_ATMOSPHERIC_STATE,
} from "@chaos-garden/shared";

class InMemoryIDB {
  canonical = new Map<string, any>();
  branches = new Map<string, any>();

  async put(store: string, value: any, key?: string) {
    if (store === "canonical") {
      this.canonical.set(key ?? "active_canonical", value);
    } else {
      this.branches.set(value.branchId, value);
    }
  }

  async get(store: string, key: string) {
    if (store === "canonical") {
      return this.canonical.get(key) ?? undefined;
    }
    return this.branches.get(key) ?? undefined;
  }

  async getAll(store: string) {
    if (store === "canonical") {
      return Array.from(this.canonical.values());
    }
    return Array.from(this.branches.values());
  }

  async delete(store: string, key: string) {
    if (store === "canonical") {
      this.canonical.delete(key);
    } else {
      this.branches.delete(key);
    }
  }

  transaction(_storeName: string, _mode: string) {
    const self = this;
    const store = {
      getAll: async () => Array.from(self.branches.values()),
      delete: async (key: string) => {
        self.branches.delete(key);
      },
      put: async (val: any) => {
        self.branches.set(val.branchId, val);
      },
    };
    return {
      objectStore: () => store,
      done: Promise.resolve(),
    };
  }
}

describe("LocalPersistence Unit Tests (Phase 3 Dual-Store)", () => {
  let persistence: LocalPersistence;
  let mockDb: InMemoryIDB;

  beforeEach(() => {
    persistence = new LocalPersistence();
    mockDb = new InMemoryIDB();
    vi.spyOn(persistence as any, "getDB").mockResolvedValue(mockDb as any);
  });

  it("boots from API when remote endpoint returns valid envelope and saves to canonical store", async () => {
    const mockEnvelope: GardenBootstrapResponse = {
      canonicalState: {
        id: 1,
        tick: 450,
        epoch: 1,
        timestamp: "2026-09-22T00:00:00Z",
        seed: 42,
        atmospheric: { ...DEFAULT_ATMOSPHERIC_STATE, sunlight: 1 },
        populationSummary: {
          plants: 10,
          herbivores: 5,
          carnivores: 2,
          fungi: 3,
          deadMatterCount: 0,
          totalLiving: 20,
          totalBiomass: 1500,
          allTimeBirths: 0,
          allTimeDeaths: 0,
        },
        entities: [],
        deadMatter: [],
        soil: { cols: 10, rows: 10, cellSize: 16, moisture: [], nitrates: [] },
        checksum: "snap-450-20",
      },
      checkpoint: {
        version: 1,
        tick: 450,
        seed: 42,
        byteLength: 64,
        checksum: "sha-450",
        payload: "payload450",
      },
      events: [],
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: mockEnvelope }),
    })) as unknown as typeof fetch;

    persistence.saveCanonical = vi.fn(async () => {});

    const result = await persistence.bootload("/api/garden");

    expect(result.source).toBe("API");
    expect(result.candidate?.kind).toBe("canonical");
    expect(result.candidate?.checkpoint).toEqual(mockEnvelope.checkpoint);
    expect(persistence.saveCanonical).toHaveBeenCalledWith(mockEnvelope);
  });

  it("falls back to IndexedDB canonical cache when API is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network error");
    }) as unknown as typeof fetch;

    const cachedEnvelope: GardenBootstrapResponse = {
      canonicalState: {
        id: 1,
        tick: 300,
        epoch: 1,
        timestamp: "2026-09-22T00:00:00Z",
        seed: 99,
        atmospheric: { ...DEFAULT_ATMOSPHERIC_STATE, sunlight: 0.8 },
        populationSummary: {
          plants: 5,
          herbivores: 2,
          carnivores: 1,
          fungi: 1,
          deadMatterCount: 0,
          totalLiving: 9,
          totalBiomass: 600,
          allTimeBirths: 0,
          allTimeDeaths: 0,
        },
        entities: [],
        deadMatter: [],
        soil: { cols: 10, rows: 10, cellSize: 16, moisture: [], nitrates: [] },
        checksum: "snap-300-9",
      },
      events: [],
    };

    const cachedRecord: CanonicalPersistenceRecord = {
      kind: "canonical",
      capturedAtMs: Date.now() - 10000,
      baseCheckpointTick: 300,
      baseCheckpointChecksum: "snap-300-9",
      codecVersion: 1,
      bootstrapEnvelope: cachedEnvelope,
      byteSize: 500,
    };

    persistence.loadCanonical = vi.fn(async () => cachedRecord);

    const result = await persistence.bootload("/api/garden");

    expect(result.source).toBe("INDEXED_DB_CANONICAL");
    expect(result.candidate?.kind).toBe("canonical");
    expect(result.candidate?.canonicalState?.tick).toBe(300);
  });

  it("loads explicit local branch when selectedBranchId is passed", async () => {
    const branchCheckpoint: EncodedEngineCheckpoint = {
      version: 1,
      tick: 777,
      seed: 42,
      byteLength: 100,
      checksum: "sha-777",
      payload: "branchPayload",
    };

    const mockBranchRecord: LocalBranchPersistenceRecord = {
      kind: "localBranch",
      branchId: "my_branch_1",
      label: "Experimental Branch 1",
      capturedAtMs: 1000,
      baseCheckpointTick: 777,
      baseCheckpointChecksum: "sha-777",
      codecVersion: 1,
      checkpoint: branchCheckpoint,
      byteSize: 200,
    };

    persistence.loadLocalBranch = vi.fn(async (id: string) => {
      if (id === "my_branch_1") return mockBranchRecord;
      return null;
    });

    const result = await persistence.bootload("/api/garden", "my_branch_1");

    expect(result.source).toBe("INDEXED_DB_BRANCH");
    expect(result.candidate?.kind).toBe("localBranch");
    expect(result.candidate?.checkpoint?.tick).toBe(777);
  });

  it("falls back to PRIMORDIAL when both API and IndexedDB are empty", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network offline");
    }) as unknown as typeof fetch;

    persistence.loadCanonical = vi.fn(async () => null);

    const result = await persistence.bootload("/api/garden");

    expect(result.source).toBe("PRIMORDIAL");
    expect(result.data).toBeNull();
    expect(result.candidate).toBeUndefined();
  });

  it("saves and loads canonical records in IndexedDB", async () => {
    const envelope: GardenBootstrapResponse = {
      canonicalState: {
        id: 1,
        tick: 200,
        epoch: 1,
        timestamp: "2026-09-22T00:00:00Z",
        seed: 42,
        atmospheric: { ...DEFAULT_ATMOSPHERIC_STATE },
        populationSummary: {
          plants: 0,
          herbivores: 0,
          carnivores: 0,
          fungi: 0,
          deadMatterCount: 0,
          totalLiving: 0,
          totalBiomass: 0,
          allTimeBirths: 0,
          allTimeDeaths: 0,
        },
        entities: [],
        deadMatter: [],
        soil: { cols: 10, rows: 10, cellSize: 16, moisture: [], nitrates: [] },
        checksum: "snap-200",
      },
      events: [],
    };

    await persistence.saveCanonical(envelope);
    const loaded = await persistence.loadCanonical();

    expect(loaded).toBeDefined();
    expect(loaded?.kind).toBe("canonical");
    expect(loaded?.baseCheckpointTick).toBe(200);
    expect(loaded?.baseCheckpointChecksum).toBe("snap-200");
  });

  it("saves, loads, and deletes local branches with retention policy of max 3 branches", async () => {
    const makeCheckpoint = (tick: number): EncodedEngineCheckpoint => ({
      version: 1,
      tick,
      seed: 42,
      byteLength: 64,
      checksum: `sha-${tick}`,
      payload: `payload-${tick}`,
    });

    // Save 3 branches
    await persistence.saveLocalBranch(
      "branch_1",
      "Branch 1",
      makeCheckpoint(100),
    );
    // Simulate slight time delay so timestamps differ
    mockDb.branches.get("branch_1").capturedAtMs = 1000;

    await persistence.saveLocalBranch(
      "branch_2",
      "Branch 2",
      makeCheckpoint(200),
    );
    mockDb.branches.get("branch_2").capturedAtMs = 2000;

    await persistence.saveLocalBranch(
      "branch_3",
      "Branch 3",
      makeCheckpoint(300),
    );
    mockDb.branches.get("branch_3").capturedAtMs = 3000;

    let branches = await persistence.loadLocalBranches();
    expect(branches.length).toBe(3);

    const b2 = await persistence.loadLocalBranch("branch_2");
    expect(b2?.label).toBe("Branch 2");

    // Saving 4th branch should evict oldest (branch_1)
    await persistence.saveLocalBranch(
      "branch_4",
      "Branch 4",
      makeCheckpoint(400),
    );
    mockDb.branches.get("branch_4").capturedAtMs = 4000;

    branches = await persistence.loadLocalBranches();
    expect(branches.length).toBe(3);
    expect(branches.find((b) => b.branchId === "branch_1")).toBeUndefined();
    expect(branches.find((b) => b.branchId === "branch_4")).toBeDefined();

    // Updating existing branch does not evict
    await persistence.saveLocalBranch(
      "branch_2",
      "Branch 2 Updated",
      makeCheckpoint(250),
    );
    branches = await persistence.loadLocalBranches();
    expect(branches.length).toBe(3);

    // Deleting branch
    await persistence.deleteLocalBranch("branch_2");
    branches = await persistence.loadLocalBranches();
    expect(branches.length).toBe(2);
    expect(branches.find((b) => b.branchId === "branch_2")).toBeUndefined();
  });

  it("handles active branch configuration and autosave loop", async () => {
    persistence.setActiveBranch("custom_branch", "Custom Branch Label");
    expect((persistence as any).activeBranchId).toBe("custom_branch");
    expect((persistence as any).activeBranchLabel).toBe("Custom Branch Label");

    const mockBridge = {
      requestSnapshot: vi.fn(async () => ({
        checkpoint: {
          version: 1,
          tick: 999,
          seed: 42,
          byteLength: 32,
          checksum: "sha-999",
          payload: "data",
        },
        canonicalState: undefined,
      })),
    };

    vi.spyOn(persistence, "saveLocalBranch").mockResolvedValue(undefined);

    vi.useFakeTimers();
    const stopFn = persistence.startAutosave(mockBridge as any, 1000);

    // Advance timer to trigger autosave
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockBridge.requestSnapshot).toHaveBeenCalled();
    expect(persistence.saveLocalBranch).toHaveBeenCalledWith(
      "custom_branch",
      "Custom Branch Label",
      expect.objectContaining({ tick: 999 }),
      undefined,
    );

    stopFn();
    persistence.stopAutosave();
    vi.useRealTimers();
  });

  it("unpacks Phase 4 v1 API envelope and preserves exactContinuation flag", async () => {
    const mockEnvelope: GardenBootstrapResponse = {
      canonicalState: {
        id: 1,
        tick: 600,
        epoch: 1,
        timestamp: "2026-09-22T00:00:00Z",
        seed: 42,
        atmospheric: { ...DEFAULT_ATMOSPHERIC_STATE },
        populationSummary: {
          plants: 10,
          herbivores: 5,
          carnivores: 2,
          fungi: 3,
          deadMatterCount: 0,
          totalLiving: 20,
          totalBiomass: 1500,
          allTimeBirths: 0,
          allTimeDeaths: 0,
        },
        entities: [],
        deadMatter: [],
        soil: { cols: 10, rows: 10, cellSize: 16, moisture: [], nitrates: [] },
        checksum: "snap-600",
      },
      checkpoint: {
        version: 2,
        tick: 600,
        seed: 42,
        byteLength: 64,
        checksum: "sha-600",
        payload: "payload600",
      },
      events: [],
      exactContinuation: true,
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        apiVersion: 1,
        serverTime: "2026-09-22T00:00:00Z",
        data: mockEnvelope,
      }),
    })) as unknown as typeof fetch;

    persistence.saveCanonical = vi.fn(async () => {});

    const result = await persistence.bootload("/api/garden");

    expect(result.source).toBe("API");
    expect(result.envelope?.exactContinuation).toBe(true);
    expect(result.candidate?.checkpoint?.tick).toBe(600);
    expect(persistence.saveCanonical).toHaveBeenCalledWith(mockEnvelope);
  });
});
