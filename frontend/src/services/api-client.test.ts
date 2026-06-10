import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './api-client';

describe('services/ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('normalizes base URL and performs GET requests', async () => {
    const payload = {
      success: true,
      data: { value: 123 },
      timestamp: '2026-01-01T00:00:00.000Z'
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => payload
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient('https://example.com///');
    const response = await client.get<{ value: number }>('api/garden');

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/garden');
    expect(response).toEqual(payload);
  });

  it('sends JSON payloads on POST requests', async () => {
    const payload = {
      success: true,
      data: { accepted: true },
      timestamp: '2026-01-01T00:00:00.000Z'
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => payload
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient('https://example.com');
    await client.post<{ accepted: boolean }>('/api/intervene', { action: 'rain_boost' });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/intervene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rain_boost' })
    });
  });

  it('returns a structured error response when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network down'))));

    const client = new ApiClient('https://example.com');
    const response = await client.get('/api/garden');

    expect(response.success).toBe(false);
    expect(response.error).toBe('network down');
    expect(response.timestamp).toBeTypeOf('string');
  });

  it('returns a structured error response for non-ok HTTP responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        success: false,
        error: 'Rate limit exceeded',
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    })));

    const client = new ApiClient('https://example.com');
    const response = await client.get('/api/garden');

    expect(response).toEqual({
      success: false,
      error: 'Rate limit exceeded',
      details: undefined,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(console.error).toHaveBeenCalled();
  });
});
