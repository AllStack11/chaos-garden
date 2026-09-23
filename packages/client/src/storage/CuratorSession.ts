/**
 * Chaos Garden - In-Memory Curator Session & Lease Management
 *
 * Implements Section 4.3.1 of Phase 3 Architecture:
 * - Credentials and leases remain strictly in-memory (never persisted to localStorage or IndexedDB).
 * - Manages lease acquisition and renewal from POST /api/garden/lease.
 * - Handles checkpoint submission with Authorization header and leaseId.
 * - Handles 401, 403, and 409 as terminal errors; stops renewal on page hide.
 */

import type {
  CuratorLease,
  EncodedEngineCheckpoint,
  CheckpointSubmission,
  CanonicalCheckpointSubmission,
  ChronicleEvent,
} from '@chaos-garden/shared';

export interface CuratorSubmissionResult {
  success: boolean;
  status: number;
  error?: string;
  isStaleTickConflict?: boolean;
  code?: string;
}

export class CuratorSession {
  // Purely in-memory credentials. NEVER written to localStorage or IndexedDB.
  private token: string | null = null;
  private curatorId: string | null = null;
  private activeLease: CuratorLease | null = null;
  private renewalTimer: ReturnType<typeof setTimeout> | null = null;
  private isPageHidden = false;

  setCredentials(token: string, curatorId: string): void {
    this.token = token.trim();
    this.curatorId = curatorId.trim();
  }

  clearSession(): void {
    this.token = null;
    this.curatorId = null;
    this.activeLease = null;
    this.stopRenewal();
  }

  get isAuthenticated(): boolean {
    return this.token !== null && this.token.length > 0;
  }

  get currentCuratorId(): string | null {
    return this.curatorId;
  }

  get currentLease(): CuratorLease | null {
    if (this.activeLease && Date.now() < this.activeLease.expiresAtMs) {
      return this.activeLease;
    }
    return null;
  }

  setPageVisibility(hidden: boolean): void {
    this.isPageHidden = hidden;
    if (hidden) {
      this.stopRenewal();
    } else if (this.activeLease && this.isAuthenticated) {
      this.scheduleRenewal(this.activeLease);
    }
  }

  /**
   * Acquires or renews a lease from the server.
   */
  async acquireOrRenewLease(apiUrl: string = '/api/garden/lease'): Promise<CuratorLease | null> {
    if (!this.isAuthenticated || !this.token) {
      return null;
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ curatorId: this.curatorId }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('[CuratorSession] Authentication failed. Clearing session.');
          this.clearSession();
        }
        return null;
      }

      const json = await response.json();
      const rawData = json && typeof json === 'object' && 'data' in json ? json.data : json;
      const lease: CuratorLease =
        json && typeof json === 'object' && 'data' in json ? json.data : json;
        rawData && typeof rawData === 'object' && 'lease' in rawData
          ? (rawData.lease as CuratorLease)
          : (rawData as CuratorLease);

      if (lease && lease.leaseId) {
        this.activeLease = lease;
        this.scheduleRenewal(lease, apiUrl);
        return lease;
      }
      return null;
    } catch (err) {
      console.warn('[CuratorSession] Failed to acquire/renew lease:', err);
      return null;
    }
  }

  private scheduleRenewal(lease: CuratorLease, apiUrl: string = '/api/garden/lease'): void {
    this.stopRenewal();
    if (this.isPageHidden) return;

    // Renew 5 seconds before lease expiry
    const timeUntilRenewal = Math.max(1000, lease.expiresAtMs - Date.now() - 5000);
    this.renewalTimer = setTimeout(async () => {
      if (!this.isPageHidden && this.isAuthenticated) {
        await this.acquireOrRenewLease(apiUrl);
      }
    }, timeUntilRenewal);
  }

  private stopRenewal(): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  /**
   * Submits an encoded engine checkpoint to the server.
   */
  async submitCheckpoint(
    checkpoint: EncodedEngineCheckpoint,
    baseCanonicalTickOrApiUrl: number | string = 0,
    chronicleEvents?: ChronicleEvent[],
    apiUrl: string = '/api/garden/checkpoint',
  ): Promise<CuratorSubmissionResult> {
    const baseCanonicalTick = typeof baseCanonicalTickOrApiUrl === 'number' ? baseCanonicalTickOrApiUrl : 0;
    const effectiveApiUrl = typeof baseCanonicalTickOrApiUrl === 'string' ? baseCanonicalTickOrApiUrl : apiUrl;

    if (!this.isAuthenticated || !this.token) {
      return { success: false, status: 401, error: 'Unauthorized: No active curator credentials' };
    }

    const lease = this.currentLease;
    if (!lease) {
      return { success: false, status: 403, error: 'No active curator lease held' };
    }

    const submission: CanonicalCheckpointSubmission = {
      leaseId: lease.leaseId,
      baseCanonicalTick,
      checkpoint,
      chronicleEvents,
    };

    try {
      const response = await fetch(effectiveApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(submission),
      });

      if (response.status === 201 || response.status === 200) {
        return { success: true, status: response.status };
      }

      if (response.status === 409) {
        // Stale tick conflict: server has advanced beyond or equals this tick
        let errorMsg = 'Conflict: Checkpoint tick is stale or conflict with server state';
        let code: string | undefined;
        try {
          const json = await response.json();
          errorMsg = json.message || json.error || errorMsg;
          code = json.code;
        } catch {
          // ignore json parse error
        }
        return {
          success: false,
          status: 409,
          error: errorMsg,
          isStaleTickConflict: true,
          code,
        };
      }

      if (response.status === 401 || response.status === 403) {
        this.clearSession();
      }

      const errorText = await response.text();
      return { success: false, status: response.status, error: errorText };
    } catch (err) {
      return {
        success: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const curatorSession = new CuratorSession();

