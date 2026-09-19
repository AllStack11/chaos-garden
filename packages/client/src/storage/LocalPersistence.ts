/**
 * Chaos Garden - Local-First Offline Persistence
 *
 * Employs IndexedDB for offline-first resilience.
 * Implements the 3-tier bootloader: Cloudflare D1 API -> Local IndexedDB Cache -> Primordial Seed.
 * Runs 30-second periodic background autosaves.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { WorkerBridge } from '../worker/WorkerBridge.js';

const DB_NAME = 'chaos_garden_db';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const LATEST_KEY = 'latest_snapshot';

export type BootSource = 'API' | 'INDEXED_DB' | 'PRIMORDIAL';

export interface BootResult {
  source: BootSource;
  data: string | null;
}

export class LocalPersistence {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  private getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      });
    }
    return this.dbPromise;
  }

  async saveSnapshot(stateJson: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(STORE_NAME, stateJson, LATEST_KEY);
    } catch (err) {
      console.warn('[LocalPersistence] Failed to cache snapshot to IndexedDB:', err);
    }
  }

  async loadCachedSnapshot(): Promise<string | null> {
    try {
      const db = await this.getDB();
      const cached = await db.get(STORE_NAME, LATEST_KEY);
      return cached ?? null;
    } catch (err) {
      console.warn('[LocalPersistence] Failed to read snapshot from IndexedDB:', err);
      return null;
    }
  }

  /**
   * 3-tier offline-first bootloader:
   * 1. Cloudflare D1 API (with 3-second timeout)
   * 2. Local IndexedDB cache
   * 3. Primordial seeded genesis
   */
  async bootload(apiUrl: string = '/api/garden'): Promise<BootResult> {
    // 1. Try remote Cloudflare D1 API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

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
      }
    } catch {
      // Remote unavailable or timed out; fall through to IndexedDB
    }

    // 2. Try local IndexedDB
    const cached = await this.loadCachedSnapshot();
    if (cached) {
      return { source: 'INDEXED_DB', data: cached };
    }

    // 3. Fallback to primordial genesis
    return { source: 'PRIMORDIAL', data: null };
  }

  startAutosave(bridge: WorkerBridge, intervalMs: number = 30000): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(async () => {
      try {
        const snapshot = await bridge.requestSnapshot();
        await this.saveSnapshot(snapshot);
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

