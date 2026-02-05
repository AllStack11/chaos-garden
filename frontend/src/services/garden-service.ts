/**
 * Garden Service
 * 
 * The primary service for data ingestion and interaction with the Chaos Garden.
 * Extracts simulation state and orchestrates interventions.
 */

import { ApiClient } from './api-client';
import type { GardenState, Entity, SimulationEvent } from '../env.d.ts';

export interface GardenData {
  gardenState: GardenState;
  entities: Entity[];
  events: SimulationEvent[];
}

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

  /**
   * Fetch the complete current state of the garden.
   */
  async fetchGardenData(): Promise<GardenData | null> {
    const response = await this.client.get<GardenData>('/api/garden');
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }
}
