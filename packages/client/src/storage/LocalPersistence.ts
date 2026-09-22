/**
 * Chaos Garden - Local-First Offline Persistence
 *
 * Employs IndexedDB for offline-first resilience.
 * Implements the 3-tier bootloader: Cloudflare D1 API -> Local IndexedDB Cache -> Primordial Seed.
 * Runs 30-second periodic background autosaves.
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
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const LATEST_KEY = 'latest_snapshot';
const DB_VERSION = 2;
const STORE_CANONICAL = 'canonical';
const STORE_LOCAL_BRANCH = 'localBranch';
const CANONICAL_KEY = 'current';
const MAX_LOCAL_BRANCHES = 3;

export type BootSource = 'API' | 'INDEXED_DB' | 'PRIMORDIAL';
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
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            // Initial legacy store
            if (!db.objectStoreNames.contains('snapshots')) {
              db.createObjectStore('snapshots');
            }
          }
          if (oldVersion < 2) {
            // Version 2: Dual store separation
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

  async saveSnapshot(stateJson: string): Promise<void> {
  /**
   * Replaces ONLY the canonical record. Never touches local branches.
   */
  async saveCanonical(envelope: GardenBootstrapResponse): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(STORE_NAME, stateJson, LATEST_KEY);
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
      console.warn('[LocalPersistence] Failed to cache snapshot to IndexedDB:', err);
      console.warn('[LocalPersistence] Failed to save canonical record to IndexedDB:', err);
    }
  }

  async loadCachedSnapshot(): Promise<string | null> {
  async loadCanonical(): Promise<CanonicalPersistenceRecord | null> {
    try {
      const db = await this.getDB();
      const cached = await db.get(STORE_NAME, LATEST_KEY);
      return cached ?? null;
      const record = await db.get(STORE_CANONICAL, CANONICAL_KEY);
      return record ?? null;
    } catch (err) {
      console.warn('[LocalPersistence] Failed to read snapshot from IndexedDB:', err);
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
   * 3-tier offline-first bootloader:
   * 1. Cloudflare D1 API (with 3-second timeout)
   * 2. Local IndexedDB cache
   * 1. Cloudflare D1 API (with timeout)
   * 2. Local IndexedDB Cache (canonical by default, or explicit branch if selected)
   * 3. Primordial seeded genesis
   */
  async bootload(apiUrl: string = '/api/garden'): Promise<BootResult> {
    // 1. Try remote Cloudflare D1 API
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
            checkpoint: branch.checkpoint,
            canonicalState: branch.canonicalState,
            branchId: branch.branchId,
            label: branch.label,
          },
        };
      }
    }

    // 2. Try remote Cloudflare D1 API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const payload = await response.text();
        // Cache to local IndexedDB
        await this.saveSnapshot(payload);
        return { source: 'API', data: payload };
        const json = await response.json();
        // Handle standard success envelope { success: true, data: GardenBootstrapResponse }
        const envelope: GardenBootstrapResponse =
          json && typeof json === 'object' && 'data' in json ? json.data : json;

        if (envelope && envelope.canonicalState) {
          // Cache to canonical IndexedDB store
          await this.saveCanonical(envelope);
          return {
            source: 'API',
            envelope,
            candidate: {
              kind: 'canonical',
              checkpoint: envelope.checkpoint,
              canonicalState: envelope.canonicalState,
            },
          };
        }
      }
    } catch {
      // Remote unavailable or timed out; fall through to IndexedDB
    }

    // 2. Try local IndexedDB
    const cached = await this.loadCachedSnapshot();
    if (cached) {
      return { source: 'INDEXED_DB', data: cached };
    // 3. Try local IndexedDB canonical cache
    const canonicalRecord = await this.loadCanonical();
    if (canonicalRecord && canonicalRecord.bootstrapEnvelope) {
      const env = canonicalRecord.bootstrapEnvelope;
      return {
        source: 'INDEXED_DB_CANONICAL',
        envelope: env,
        candidate: {
          kind: 'canonical',
          checkpoint: env.checkpoint,
          canonicalState: env.canonicalState,
        },
      };
    }

    // 3. Fallback to primordial genesis
    return { source: 'PRIMORDIAL', data: null };
    // 4. Fallback to primordial genesis
    return { source: 'PRIMORDIAL' };
  }

  startAutosave(bridge: WorkerBridge, intervalMs: number = 30000): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(async () => {
      try {
        const snapshot = await bridge.requestSnapshot();
        await this.saveSnapshot(snapshot);
        const { checkpoint, canonicalState } = await bridge.requestSnapshot();
        // Autosave writes exclusively to localBranch store
        await this.saveLocalBranch(
          this.activeBranchId,
          this.activeBranchLabel,
          checkpoint,
          canonicalState,
        );
      } catch (err) {
        console.warn('[LocalPersistence] Autosave failed:', err);
      }
    }, intervalMs);
  }

  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }
}

export const localPersistence = new LocalPersistence();

