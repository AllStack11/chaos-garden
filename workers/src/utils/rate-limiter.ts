/**
 * Simple In-Memory Rate Limiter
 *
 * Tracks request counts per IP address using a sliding window approach.
 * Designed for Cloudflare Workers edge deployment.
 *
 * NOTE: This is per-worker-instance rate limiting, not global.
 * For production-scale global rate limiting, consider using Cloudflare's
 * Rate Limiting API or Durable Objects.
 */

interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequestsPerWindow: number;
  /** Time window in milliseconds */
  windowSizeMs: number;
}

interface RequestRecord {
  /** Timestamps of requests made within the current window */
  timestamps: number[];
}

/** Default rate limit configurations per endpoint pattern */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Read-only endpoints: More permissive
  'GET:/api/garden': {
    maxRequestsPerWindow: 60,  // 60 requests per minute
    windowSizeMs: 60_000,
  },
  'GET:/api/health': {
    maxRequestsPerWindow: 120, // 120 requests per minute
    windowSizeMs: 60_000,
  },
  // Write endpoints: More restrictive
  'POST:/api/tick': {
    maxRequestsPerWindow: 10,  // 10 requests per minute
    windowSizeMs: 60_000,
  },
  // Default fallback
  'DEFAULT': {
    maxRequestsPerWindow: 30,  // 30 requests per minute
    windowSizeMs: 60_000,
  },
};

/** In-memory storage of request records per IP address */
const requestRecordsByIpAddress = new Map<string, Map<string, RequestRecord>>();

/** Timestamp of last cleanup to prevent memory bloat */
let lastCleanupTimestamp = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000; // Clean up every 5 minutes

/**
 * Remove expired request records to prevent memory leaks
 */
function cleanupExpiredRequestRecords(): void {
  const currentTimestamp = Date.now();

  // Only run cleanup periodically
  if (currentTimestamp - lastCleanupTimestamp < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupTimestamp = currentTimestamp;
  const oldestRelevantTimestamp = currentTimestamp - (60_000 * 2); // Keep 2 minutes of data

  for (const [ipAddress, endpointRecords] of requestRecordsByIpAddress.entries()) {
    for (const [endpoint, record] of endpointRecords.entries()) {
      // Remove timestamps older than our window
      record.timestamps = record.timestamps.filter(ts => ts > oldestRelevantTimestamp);

      // Remove empty records
      if (record.timestamps.length === 0) {
        endpointRecords.delete(endpoint);
      }
    }

    // Remove IPs with no active records
    if (endpointRecords.size === 0) {
      requestRecordsByIpAddress.delete(ipAddress);
    }
  }
}

/**
 * Get the rate limit configuration for a specific endpoint
 */
function getRateLimitConfigForEndpoint(method: string, path: string): RateLimitConfig {
  const endpointKey = `${method}:${path}`;
  return RATE_LIMIT_CONFIGS[endpointKey] ?? RATE_LIMIT_CONFIGS.DEFAULT;
}

/**
 * Extract IP address from request
 */
function getClientIpAddressFromRequest(request: Request): string {
  // Cloudflare sets CF-Connecting-IP header with the real client IP
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]
    ?? 'unknown';
}

/**
 * Check if a request should be rate limited
 *
 * @returns true if request should be allowed, false if rate limited
 */
export function checkRateLimitForRequest(request: Request): boolean {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const ipAddress = getClientIpAddressFromRequest(request);
  const currentTimestamp = Date.now();
  const config = getRateLimitConfigForEndpoint(method, path);

  // Periodically cleanup old records
  cleanupExpiredRequestRecords();

  // Initialize IP record storage if needed
  if (!requestRecordsByIpAddress.has(ipAddress)) {
    requestRecordsByIpAddress.set(ipAddress, new Map());
  }

  const endpointRecords = requestRecordsByIpAddress.get(ipAddress)!;
  const endpointKey = `${method}:${path}`;

  // Initialize endpoint record if needed
  if (!endpointRecords.has(endpointKey)) {
    endpointRecords.set(endpointKey, { timestamps: [] });
  }

  const record = endpointRecords.get(endpointKey)!;

  // Remove timestamps outside the current window
  const windowStartTimestamp = currentTimestamp - config.windowSizeMs;
  record.timestamps = record.timestamps.filter(ts => ts > windowStartTimestamp);

  // Check if rate limit exceeded
  if (record.timestamps.length >= config.maxRequestsPerWindow) {
    return false; // Rate limit exceeded
  }

  // Record this request
  record.timestamps.push(currentTimestamp);

  return true; // Request allowed
}

/**
 * Calculate when the rate limit will reset for a client
 */
export function getRateLimitResetTimeForRequest(request: Request): number {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const ipAddress = getClientIpAddressFromRequest(request);
  const config = getRateLimitConfigForEndpoint(method, path);

  const endpointRecords = requestRecordsByIpAddress.get(ipAddress);
  if (!endpointRecords) {
    return Date.now();
  }

  const endpointKey = `${method}:${path}`;
  const record = endpointRecords.get(endpointKey);
  if (!record || record.timestamps.length === 0) {
    return Date.now();
  }

  // Return timestamp when the oldest request in the window will expire
  const oldestTimestamp = Math.min(...record.timestamps);
  return oldestTimestamp + config.windowSizeMs;
}
