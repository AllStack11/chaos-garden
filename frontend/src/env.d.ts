/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { HealthStatus as SharedHealthStatus } from '@chaos-garden/shared';

/**
 * Environment variables available in the frontend.
 * These are prefixed with PUBLIC_ and are exposed to the client.
 */
interface ImportMetaEnv {
  /**
   * The URL of the Chaos Garden API.
   * In development: http://localhost:8787
   * In production: https://chaos-garden-api.YOUR_SUBDOMAIN.workers.dev
   */
  readonly PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Re-export the API health type used by the canonical data service.
export type HealthStatus = SharedHealthStatus;
