/**
 * Garden Service
 * 
 * The primary service for data ingestion and interaction with the Chaos Garden.
 * Extracts simulation state and orchestrates interventions.
 */

import { ApiClient } from './api-client';
import type {
  HealthStatus,
} from '../env.d.ts';
import type { GardenBootstrapData } from '@chaos-garden/shared';

export type GardenData = GardenBootstrapData;

export class GardenService {
  private client: ApiClient;
  private static instance: GardenService;

  private constructor(apiUrl: string) {
    this.client = new ApiClient(apiUrl);
    console.log('[GardenService] Singleton instance created');
  }

  public static getInstance(apiUrl: string): GardenService {
    if (!GardenService.instance) {
      GardenService.instance = new GardenService(apiUrl);
    }
    return GardenService.instance;
  }

  private unwrapResponse<T>(resourceName: string, response: { success: boolean; data?: T; error?: string }): T {
    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error ?? `Failed to fetch ${resourceName}`);
  }

  /**
   * Fetch the complete current state of the garden.
   */
  async fetchGardenData(): Promise<GardenData> {
    const response = await this.client.get<GardenData>('/api/garden');
    const data = this.unwrapResponse('garden data', response);
    if (data.exactContinuation !== true || !data.checkpoint || !data.canonicalState) {
      throw new Error('Canonical bootstrap is not an exact continuation; refusing to hydrate cached state');
    }
    return data;
  }

  /**
   * Check the health of the API.
   */
  async checkHealth(): Promise<HealthStatus> {
    const response = await this.client.get<HealthStatus>('/api/health');
    return this.unwrapResponse('health status', response);
  }

}
