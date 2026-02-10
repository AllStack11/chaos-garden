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
  details?: any;
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

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const startTime = performance.now();
    try {
      console.log(`[ApiClient] GET ${path} starting...`);
      const response = await fetch(this.buildUrl(path));
      const data = await response.json();
      const duration = (performance.now() - startTime).toFixed(2);
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
      const data = await response.json();
      const duration = (performance.now() - startTime).toFixed(2);
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
