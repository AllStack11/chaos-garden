/**
 * API Client
 * 
 * A standardized client for communicating with the Chaos Garden API.
 * Provides consistent error handling and response parsing.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  timestamp: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    console.log(`[ApiClient] Initialized with base URL: ${this.baseUrl}`);
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  private async parseResponseBody<T>(response: Response): Promise<ApiResponse<T> | null> {
    try {
      return await response.json() as ApiResponse<T>;
    } catch {
      return null;
    }
  }

  private buildHttpErrorResponse<T>(
    path: string,
    method: 'GET' | 'POST',
    response: Response,
    durationMs: string,
    parsedBody: ApiResponse<T> | null,
  ): ApiResponse<T> {
    const errorMessage = parsedBody?.error ?? `HTTP ${response.status} ${response.statusText}`.trim();

    console.error(
      `[ApiClient] ${method} ${path} failed with ${response.status} after ${durationMs}ms: ${errorMessage}`
    );

    return {
      success: false,
      error: errorMessage,
      details: parsedBody?.details,
      timestamp: parsedBody?.timestamp ?? new Date().toISOString(),
    };
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    try {
      console.log(`[ApiClient] GET ${path} starting...`);
      const response = await fetch(this.buildUrl(path));
      const data = await this.parseResponseBody<T>(response);
      const duration = (performance.now() - startTime).toFixed(2);

      if (!response.ok) {
        return this.buildHttpErrorResponse(path, 'GET', response, duration, data);
      }

      if (!data) {
        throw new Error(`GET ${path} returned an unreadable response body`);
      }

      if (!data.success) {
        console.error(
          `[ApiClient] GET ${path} returned an application error after ${duration}ms: ${data.error ?? 'Unknown error'}`
        );
        return data;
      }

      console.log(`[ApiClient] GET ${path} completed in ${duration}ms`);
      return data;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.error(`[ApiClient] GET ${path} failed after ${duration}ms:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  async post<T>(path: string, body?: any): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    try {
      console.log(`[ApiClient] POST ${path} starting...`, body);
      const response = await fetch(this.buildUrl(path), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await this.parseResponseBody<T>(response);
      const duration = (performance.now() - startTime).toFixed(2);

      if (!response.ok) {
        return this.buildHttpErrorResponse(path, 'POST', response, duration, data);
      }

      if (!data) {
        throw new Error(`POST ${path} returned an unreadable response body`);
      }

      if (!data.success) {
        console.error(
          `[ApiClient] POST ${path} returned an application error after ${duration}ms: ${data.error ?? 'Unknown error'}`
        );
        return data;
      }

      console.log(`[ApiClient] POST ${path} completed in ${duration}ms`);
      return data;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.error(`[ApiClient] POST ${path} failed after ${duration}ms:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
}
