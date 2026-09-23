/**
 * Chaos Garden - Local-First Offline Persistence
 *
 * Implements Phase 3 Dual-Store IndexedDB architecture:
 * - 'canonical' store holds exactly 1 canonical API snapshot.
 * - 'localBranch' store holds up to 3 local user branches, evicting oldest on quota limit.
 * - Strict isolation: API responses replace ONLY canonical; autosaves replace ONLY active localBranch.
 * - 3-tier offline bootloader: Cloudflare D1 API -> Local IndexedDB -> Primordial Genesis.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type {
  GardenBootstrapResponse,
  EncodedEngineCheckpoint,
  CanonicalWorldState,
} from '@chaos-garden/shared';
import type { BootstrapCandidate } from '../worker/types.js';
import type { WorkerBridge } from '../worker/WorkerBridge.js';

const DB_NAME = 'chaos_garden_db';
const DB_VERSION = 2;
const STORE_CANONICAL = 'canonical';
const STORE_LOCAL_BRANCH = 'localBranch';
const CANONICAL_KEY = 'current';
const MAX_LOCAL_BRANCHES = 3;

export interface CanonicalPersistenceRecord {
  kind: 'canonical';
  capturedAtMs: number;
  baseCheckpointTick: number;
  baseCheckpointChecksum: string;
  codecVersion: number;
  bootstrapEnvelope: GardenBootstrapResponse;
  byteSize: number;
}

export interface LocalBranchPersistenceRecord {
  kind: 'localBranch';
  branchId: string;
  label: string;
  capturedAtMs: number;
  baseCheckpointTick: number;
  baseCheckpointChecksum: string;
  codecVersion: number;
  checkpoint: EncodedEngineCheckpoint;
  canonicalState?: CanonicalWorldState;
  byteSize: number;
}

export type BootSource =
  | 'API'
  | 'INDEXED_DB_CANONICAL'
  | 'INDEXED_DB_BRANCH'
  | 'PRIMORDIAL';

export interface BootResult {
  source: BootSource;
  data: string | null;
  candidate?: BootstrapCandidate;
  envelope?: GardenBootstrapResponse;
  canonicalRecord?: CanonicalPersistenceRecord;
  branchRecord?: LocalBranchPersistenceRecord;
}

export class LocalPersistence {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private activeBranchId: string;
  private activeBranchLabel: string;

  constructor() {
    this.activeBranchId = 'branch_' + Date.now().toString(36);
    this.activeBranchLabel = 'Local Session (' + new Date().toLocaleTimeString() + ')';
  }

  getActiveBranchId(): string {
    return this.activeBranchId;
  }

  setActiveBranch(branchId: string, label: string): void {
    this.activeBranchId = branchId;
    this.activeBranchLabel = label;
  }

  private getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            if (!db.objectStoreNames.contains('snapshots')) {
              db.createObjectStore('snapshots');
            }
          }
          if (oldVersion < 2) {
            if (!db.objectStoreNames.contains(STORE_CANONICAL)) {
              db.createObjectStore(STORE_CANONICAL);
            }
            if (!db.objectStoreNames.contains(STORE_LOCAL_BRANCH)) {
              const store = db.createObjectStore(STORE_LOCAL_BRANCH, {
                keyPath: 'branchId',
              });
              store.createIndex('capturedAtMs', 'capturedAtMs');
            }
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Replaces ONLY the canonical record. Never touches local branches.
   */
  async saveCanonical(envelope: GardenBootstrapResponse): Promise<void> {
    if (!this.isExactCanonicalEnvelope(envelope)) return;
    try {
      const db = await this.getDB();
      const tick = envelope.checkpoint?.tick ?? envelope.canonicalState.tick;
      const checksum = envelope.checkpoint?.checksum ?? envelope.canonicalState.checksum;
      const codecVersion = envelope.checkpoint?.version ?? 1;
      const serialized = JSON.stringify(envelope);

      const record: CanonicalPersistenceRecord = {
        kind: 'canonical',
        capturedAtMs: Date.now(),
        baseCheckpointTick: tick,
        baseCheckpointChecksum: checksum,
        codecVersion,
        bootstrapEnvelope: envelope,
        byteSize: serialized.length,
      };

      await db.put(STORE_CANONICAL, record, CANONICAL_KEY);
    } catch (err) {
      console.warn('[LocalPersistence] Failed to save canonical record to IndexedDB:', err);
    }
  }

  /** Rejects partial or stale bootstrap data before it reaches observer cache. */
  private isExactCanonicalEnvelope(envelope: GardenBootstrapResponse | null | undefined): envelope is GardenBootstrapResponse & { checkpoint: EncodedEngineCheckpoint } {
    const checkpoint = envelope?.checkpoint;
    const canonicalState = envelope?.canonicalState;
    return Boolean(envelope?.exactContinuation === true && checkpoint && canonicalState && checkpoint.tick === canonicalState.tick && checkpoint.checksum === canonicalState.checksum && checkpoint.payload.length > 0);
  }

  async loadCanonical(): Promise<CanonicalPersistenceRecord | null> {
    try {
      const db = await this.getDB();
      const record = await db.get(STORE_CANONICAL, CANONICAL_KEY);
      return record ?? null;
    } catch (err) {
      console.warn('[LocalPersistence] Failed to load canonical record from IndexedDB:', err);
      return null;
    }
  }

  /**
   * Saves or replaces ONLY the active local branch record. Never overwrites canonical.
   * Enforces retention policy of at most 3 branches.
   */
  async saveLocalBranch(
    branchId: string,
    label: string,
    checkpoint: EncodedEngineCheckpoint,
    canonicalState?: CanonicalWorldState,
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_LOCAL_BRANCH, 'readwrite');
      const store = tx.objectStore(STORE_LOCAL_BRANCH);

      // Enforce max 3 local branches retention
      const allRecords: LocalBranchPersistenceRecord[] = await store.getAll();
      const existingIndex = allRecords.findIndex((r) => r.branchId === branchId);

      if (existingIndex === -1 && allRecords.length >= MAX_LOCAL_BRANCHES) {
        // Sort oldest first and evict
        allRecords.sort((a, b) => a.capturedAtMs - b.capturedAtMs);
        const toEvictCount = allRecords.length - MAX_LOCAL_BRANCHES + 1;
        for (let i = 0; i < toEvictCount; i++) {
          await store.delete(allRecords[i].branchId);
        }
      }

      const byteSize = (checkpoint.payload?.length || 0) + (canonicalState ? JSON.stringify(canonicalState).length : 0);

      const record: LocalBranchPersistenceRecord = {
        kind: 'localBranch',
        branchId,
        label,
        capturedAtMs: Date.now(),
        baseCheckpointTick: checkpoint.tick,
        baseCheckpointChecksum: checkpoint.checksum,
        codecVersion: checkpoint.version,
        checkpoint,
        canonicalState,
        byteSize,
      };

      await store.put(record);
      await tx.done;
    } catch (err) {
      console.warn('[LocalPersistence] Failed to save local branch to IndexedDB:', err);
    }
  }

  async loadLocalBranches(): Promise<LocalBranchPersistenceRecord[]> {
    try {
      const db = await this.getDB();
      return await db.getAll(STORE_LOCAL_BRANCH);
    } catch (err) {
      console.warn('[LocalPersistence] Failed to load local branches:', err);
      return [];
    }
  }

  async loadLocalBranch(branchId: string): Promise<LocalBranchPersistenceRecord | null> {
    try {
      const db = await this.getDB();
      const record = await db.get(STORE_LOCAL_BRANCH, branchId);
      return record ?? null;
    } catch (err) {
      console.warn('[LocalPersistence] Failed to load local branch ' + branchId + ':', err);
      return null;
    }
  }

  /**
   * Returns the local continuation furthest ahead in simulated time. When two
   * branches share a tick, prefer the most recently captured one.
   */
  async loadMostAdvancedLocalBranch(): Promise<LocalBranchPersistenceRecord | null> {
    const branches = await this.loadLocalBranches();
    if (branches.length === 0) return null;

    let mostAdvanced = branches[0];
    for (let index = 1; index < branches.length; index += 1) {
      const candidate = branches[index];
      if (
        candidate.baseCheckpointTick > mostAdvanced.baseCheckpointTick ||
        (candidate.baseCheckpointTick === mostAdvanced.baseCheckpointTick &&
          candidate.capturedAtMs > mostAdvanced.capturedAtMs)
      ) {
        mostAdvanced = candidate;
      }
    }
    return mostAdvanced;
  }

  async deleteLocalBranch(branchId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(STORE_LOCAL_BRANCH, branchId);
    } catch (err) {
      console.warn('[LocalPersistence] Failed to delete local branch ' + branchId + ':', err);
    }
  }

  /**
   * 3-tier offline-first bootloader:
   * 1. Cloudflare D1 API (with timeout)
   * 2. Local IndexedDB Cache (canonical by default, or explicit branch if selected)
   * 3. Primordial seeded genesis
   */
  async bootload(
    apiUrl: string = '/api/garden',
    selectedBranchId?: string,
    timeoutMs = 3000,
  ): Promise<BootResult> {
    // 1. If explicit local branch requested, load it directly
    if (selectedBranchId) {
      const branch = await this.loadLocalBranch(selectedBranchId);
      if (branch) {
        return {
          source: 'INDEXED_DB_BRANCH',
          branchRecord: branch,
          candidate: {
            kind: 'localBranch',
            branchId: branch.branchId,
            label: branch.label,
            checkpoint: branch.checkpoint,
            canonicalState: branch.canonicalState,
          },
          data: branch.canonicalState ? JSON.stringify(branch.canonicalState) : null,
        };
      }
    }

    // 2. Try remote Cloudflare D1 API. A server snapshot remains the shared
    // baseline, but a browser must not move its own local timeline backwards
    // on refresh while that baseline is behind its autosaved branch.
    let remoteEnvelope: GardenBootstrapResponse | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const body = await response.json();
        // Handle standard API success envelope { success: true, data: GardenBootstrapResponse }
        const envelope: GardenBootstrapResponse =
          body && typeof body === 'object' && 'data' in body && body.data
            ? body.data
            : body;

        if (this.isExactCanonicalEnvelope(envelope)) {
          await this.saveCanonical(envelope);
          remoteEnvelope = envelope;
        }
      }
    } catch (err) {
      console.warn('[LocalPersistence] Remote API unreachable, falling back to local storage:', err);
    }

    // 3. Resume a locally autosaved branch when it is ahead of the latest
    // canonical snapshot. This is the normal refresh path for a local sandbox.
    const mostAdvancedLocalBranch = await this.loadMostAdvancedLocalBranch();
    const remoteTick = remoteEnvelope?.checkpoint?.tick ?? -1;
    if (mostAdvancedLocalBranch && mostAdvancedLocalBranch.baseCheckpointTick >= remoteTick) {
      this.setActiveBranch(mostAdvancedLocalBranch.branchId, mostAdvancedLocalBranch.label);
      return {
        source: 'INDEXED_DB_BRANCH',
        branchRecord: mostAdvancedLocalBranch,
        candidate: {
          kind: 'localBranch',
          branchId: mostAdvancedLocalBranch.branchId,
          label: mostAdvancedLocalBranch.label,
          checkpoint: mostAdvancedLocalBranch.checkpoint,
          canonicalState: mostAdvancedLocalBranch.canonicalState,
        },
        data: mostAdvancedLocalBranch.canonicalState
          ? JSON.stringify(mostAdvancedLocalBranch.canonicalState)
          : null,
      };
    }

    if (remoteEnvelope) {
      return {
        source: 'API',
        envelope: remoteEnvelope,
        candidate: {
          kind: 'canonical',
          checkpoint: remoteEnvelope.checkpoint,
          canonicalState: remoteEnvelope.canonicalState,
        },
        data: JSON.stringify(remoteEnvelope),
      };
    }

    // 4. Fall back to local canonical IndexedDB cache
    const cachedCanonical = await this.loadCanonical();
    if (cachedCanonical && this.isExactCanonicalEnvelope(cachedCanonical.bootstrapEnvelope)) {
      const envelope = cachedCanonical.bootstrapEnvelope;
      return {
        source: 'INDEXED_DB_CANONICAL',
        canonicalRecord: cachedCanonical,
        envelope,
        candidate: {
          kind: 'canonical',
          checkpoint: envelope.checkpoint,
          canonicalState: envelope.canonicalState,
        },
        data: JSON.stringify(envelope),
      };
    }

    // 5. Primordial fallback
    return {
      source: 'PRIMORDIAL',
      data: null,
    };
  }

  /**
   * Starts periodic background autosaving to the active local branch.
   */
  startAutosave(
    bridge: WorkerBridge,
    intervalMs: number = 30000,
  ): () => void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }

    const saveActiveBranch = async (): Promise<void> => {
      try {
        const { checkpoint, canonicalState } = await bridge.requestSnapshot();
        await this.saveLocalBranch(
          this.activeBranchId,
          this.activeBranchLabel,
          checkpoint,
          canonicalState,
        );
      } catch (err) {
        console.warn('[LocalPersistence] Autosave tick failed:', err);
      }
    };

    // Create a recovery point as soon as the simulation has booted, rather
    // than leaving a new session unprotected until its first interval fires.
    void saveActiveBranch();
    this.autosaveTimer = setInterval(() => {
      void saveActiveBranch();
    }, intervalMs);

    return () => {
      if (this.autosaveTimer) {
        clearInterval(this.autosaveTimer);
        this.autosaveTimer = null;
      }
    };
  }

  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }
}

export const localPersistence = new LocalPersistence();
