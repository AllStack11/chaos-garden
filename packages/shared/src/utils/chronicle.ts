/**
 * Chaos Garden - Chronicle Event Hashing and Validation Utilities
 *
 * Implements Phase 4 deterministic chronicle hashing and bounds checking:
 * - Deterministic SHA-256 event checksums for idempotent deduplication.
 * - Strict limits: description <= 512 UTF-8 bytes, type <= 64 chars, <= 12 tags of <= 48 chars.
 * - Severity validation ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL').
 */

import { computeSha256Hex } from './codec.js';

export const MAX_CHRONICLE_EVENTS_PER_SUBMISSION = 10;
export const MAX_CHRONICLE_DESCRIPTION_BYTES = 512;
export const MAX_CHRONICLE_TYPE_LENGTH = 64;
export const MAX_CHRONICLE_TAGS_COUNT = 12;
export const MAX_CHRONICLE_TAG_LENGTH = 48;

export const CHRONICLE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ChronicleSeverity = typeof CHRONICLE_SEVERITIES[number];

export interface RawChronicleInput {
  id?: string;
  canonicalTick?: number;
  tick?: number;
  occurredAt?: string;
  timestamp?: string;
  type: string;
  severity: string;
  description: string;
  tags?: string[];
}

export interface ValidatedChronicleEvent {
  id: string;
  canonicalTick: number;
  occurredAt: string;
  type: string;
  severity: ChronicleSeverity;
  description: string;
  tags: string[];
  checksum: string;
}

/**
 * Validates a single chronicle event against bounds.
 */
export function validateChronicleEvent(input: RawChronicleInput): { valid: boolean; error?: string } {
  const tick = input.canonicalTick ?? input.tick;
  if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
    return { valid: false, error: 'Chronicle event tick must be a non-negative integer' };
  }

  if (typeof input.type !== 'string' || input.type.trim().length === 0) {
    return { valid: false, error: 'Chronicle event type must be a non-empty string' };
  }
  if (input.type.length > MAX_CHRONICLE_TYPE_LENGTH) {
    return { valid: false, error: `Chronicle event type exceeds ${MAX_CHRONICLE_TYPE_LENGTH} characters` };
  }

  if (typeof input.description !== 'string' || input.description.trim().length === 0) {
    return { valid: false, error: 'Chronicle event description must be a non-empty string' };
  }
  const descBytes = new TextEncoder().encode(input.description).byteLength;
  if (descBytes > MAX_CHRONICLE_DESCRIPTION_BYTES) {
    return { valid: false, error: `Chronicle event description exceeds ${MAX_CHRONICLE_DESCRIPTION_BYTES} UTF-8 bytes` };
  }

  if (!CHRONICLE_SEVERITIES.includes(input.severity as ChronicleSeverity)) {
    return { valid: false, error: `Chronicle event severity must be one of: ${CHRONICLE_SEVERITIES.join(', ')}` };
  }

  const tags = input.tags ?? [];
  if (!Array.isArray(tags)) {
    return { valid: false, error: 'Chronicle event tags must be an array of strings' };
  }
  if (tags.length > MAX_CHRONICLE_TAGS_COUNT) {
    return { valid: false, error: `Chronicle event tags exceed maximum count of ${MAX_CHRONICLE_TAGS_COUNT}` };
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length > MAX_CHRONICLE_TAG_LENGTH) {
      return { valid: false, error: `Chronicle event tag must be a string <= ${MAX_CHRONICLE_TAG_LENGTH} characters` };
    }
  }

  return { valid: true };
}

/**
 * Computes a deterministic SHA-256 hex checksum for a chronicle event.
 * Keys and tag array items are canonically sorted before hashing.
 */
export async function computeChronicleEventChecksum(event: {
  canonicalTick: number;
  occurredAt: string;
  type: string;
  severity: string;
  description: string;
  tags: string[];
}): Promise<string> {
  const canonicalObj = {
    canonicalTick: event.canonicalTick,
    description: event.description.trim(),
    occurredAt: event.occurredAt,
    severity: event.severity,
    tags: [...event.tags].sort(),
    type: event.type.trim(),
  };

  const jsonStr = JSON.stringify(canonicalObj);
  const bytes = new TextEncoder().encode(jsonStr);
  return computeSha256Hex(bytes);
}

