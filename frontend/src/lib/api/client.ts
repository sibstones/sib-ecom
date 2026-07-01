import { AuthenticationError } from '../errors/AuthenticationError';
import { RateLimitError } from '../errors/RateLimitError';
import { authStore } from '../stores/auth.store';
import { rateLimitStore } from '../stores/rate-limit.store';
import { t } from '$lib/utils/i18n';

type QueryParams = Record<string, string | number | boolean | null | undefined>;
type ApiRequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit;
  params?: QueryParams;
  refreshOnMissingToken?: boolean;
};

// Use relative path to leverage Vite proxy in development
// Set VITE_API_URL env var for production or custom backend URL
// Normalize: backend expects /api prefix; if full URL given without /api, append it (fixes "Route not found")
function normalizeApiBaseUrl(url: string | undefined): string {
  const base = (url || '/api').replace(/\/+$/, '');
  if (base === '/api' || base.endsWith('/api')) return base;
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return `${base}/api`;
  }
  return base;
}
const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

/** Max concurrent requests to avoid burst 429 from rate limiters (proxy/backend). */
const MAX_CONCURRENT_REQUESTS = 6;

/** Debug API calls (request/response logs). Set VITE_DEBUG_API=true to enable. */
const DEBUG_API = import.meta.env.VITE_DEBUG_API === 'true' || import.meta.env.DEV;

/**
 * Semaphore: run at most MAX_CONCURRENT_REQUESTS at a time to reduce 429 on parallel SPA loads.
 */
function createRequestSemaphore() {
  let running = 0;
  const waiters: Array<() => void> = [];
  return {
    async acquire(): Promise<void> {
      if (running < MAX_CONCURRENT_REQUESTS) {
        running += 1;
        return;
      }
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
      running += 1;
    },
    release(): void {
      running = Math.max(0, running - 1);
      const next = waiters.shift();
      if (next) next();
    },
  };
}

const requestSemaphore = typeof window !== 'undefined' ? createRequestSemaphore() : null;

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (!requestSemaphore) return fn();
  await requestSemaphore.acquire();
  try {
    return await fn();
  } finally {
    requestSemaphore.release();
  }
}

export class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;
  /** CSRF token for double-submit (cleared on 403 CSRF to refetch). */
  private csrfToken: string | null = null;
  /** Serialize concurrent CSRF fetches so cookie + in-memory token stay in sync. */
  private csrfFetchInFlight: Promise<string> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Warm the CSRF httpOnly cookie + in-memory token before any POST (e.g. admin layout onMount).
   * Safe to call multiple times.
   */
  async prefetchCsrfToken(): Promise<void> {
    await this.fetchCsrfToken();
  }

  /** Message when API is unreachable (404/502 or connection refused). */
  private static apiUnavailableMessage(): string {
    return t('error.apiUnavailable');
  }

  /**
   * Fetch CSRF token (sets cookie on backend; we send same value in X-CSRF-Token header).
   * Uses raw fetch to avoid recursion. Call with credentials so cookie is stored.
   * Tries /api/csrf-token first, then /api/auth/csrf-token as fallback.
   */
  private async fetchCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    if (this.csrfFetchInFlight) {
      return this.csrfFetchInFlight;
    }

    this.csrfFetchInFlight = (async () => {
      const urls = [`${this.baseUrl}/csrf-token`, `${this.baseUrl}/auth/csrf-token`];
      let lastError: Error | null = null;
      try {
        for (const url of urls) {
          try {
            const res = await fetch(url, { method: 'GET', credentials: 'include' });
            if (res.ok) {
              const data = (await res.json()) as { csrfToken?: string };
              const token = data.csrfToken;
              if (typeof token === 'string' && token.length > 0) {
                this.csrfToken = token;
                return token;
              }
              lastError = new Error(`CSRF token missing in response from ${url}`);
              continue;
            }
            if (res.status === 404) continue;
            if (res.status === 502) {
              lastError = new Error(ApiClient.apiUnavailableMessage());
              break;
            }
            lastError = new Error(`CSRF token failed: ${res.status}`);
            continue;
          } catch (err) {
            if (err instanceof Error && err.message === ApiClient.apiUnavailableMessage())
              throw err;
            lastError =
              err instanceof TypeError
                ? new Error(ApiClient.apiUnavailableMessage())
                : (err as Error);
            continue;
          }
        }
        throw lastError ?? new Error(ApiClient.apiUnavailableMessage());
      } finally {
        this.csrfFetchInFlight = null;
      }
    })();

    return this.csrfFetchInFlight;
  }

  private static headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) return Object.fromEntries(headers.entries());
    if (Array.isArray(headers)) return Object.fromEntries(headers);
    return { ...(headers as Record<string, string>) };
  }

  private static appendParams(url: string, params: QueryParams | undefined): string {
    if (!params) return url;
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      qs.set(key, String(value));
    }
    const query = qs.toString();
    if (!query) return url;
    return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
    retryCount: number = 0
  ): Promise<T> {
    const url = ApiClient.appendParams(`${this.baseUrl}${endpoint}`, options.params);

    // Skip token validation for auth endpoints (login, register, refresh, logout)
    // These endpoints don't require or use the access token
    const isAuthEndpoint = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
    ].includes(endpoint);

    // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
    const isFormData = options.body instanceof FormData;

    const headers = ApiClient.headersToRecord(options.headers);

    // Only set Content-Type for non-FormData requests
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // CSRF: for state-changing methods, send double-submit token
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = this.csrfToken ?? (await this.fetchCsrfToken());
      headers['X-CSRF-Token'] = csrf;
    }

    try {
      if (DEBUG_API) {
        console.log(`apiClient.request: ${options.method || 'GET'} ${url}`, {
          headers: Object.keys(headers),
          hasBody: !!options.body,
          hasToken: false,
        });
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for CORS
      });

      if (DEBUG_API) {
        console.log(`apiClient.request: Response status ${response.status} for ${url}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP error! status: ${response.status}`,
        }));
        // Backend returns { error: "message" }, so check both error.error and error.message
        // Also check for validation details
        let errorMessage =
          errorData.error || errorData.message || `HTTP error! status: ${response.status}`;
        if (response.status === 404 && errorData.path) {
          errorMessage = `${errorMessage}: ${errorData.path}`;
        }
        if (errorData.details && Array.isArray(errorData.details)) {
          // Format validation errors
          const validationErrors = errorData.details
            .map((err: any) => `${err.path?.join('.') || 'field'}: ${err.message}`)
            .join(', ');
          if (validationErrors) {
            errorMessage = `${errorMessage} (${validationErrors})`;
          }
        } else if (errorData.message && errorData.message !== errorData.error) {
          // Use detailed message if available
          errorMessage = errorData.message;
        }

        // Handle rate limiting errors (429) - retry with exponential backoff + jitter
        if (response.status === 429 && retryCount < 3 && !isAuthEndpoint) {
          const retryAfterSec =
            errorData.retryAfter ?? parseInt(response.headers.get('Retry-After') || '15', 10);
          const baseMs = Math.min(retryAfterSec * 1000 * Math.pow(2, retryCount), 12000);
          const jitter = baseMs * 0.25 * (Math.random() * 2 - 1);
          const delay = Math.max(500, Math.round(baseMs + jitter));

          if (DEBUG_API) {
            console.warn(
              `Rate limit exceeded, retrying after ${delay}ms (attempt ${retryCount + 1}/3)`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        // Handle CSRF errors (403) - refetch token and retry once
        if (
          response.status === 403 &&
          (errorMessage.includes('CSRF') || errorMessage.includes('csrf')) &&
          retryCount === 0
        ) {
          this.csrfToken = null;
          try {
            await this.fetchCsrfToken();
            return this.request<T>(endpoint, options, retryCount + 1);
          } catch {
            // fall through to throw below
          }
        }

        // Handle authentication errors (401) - try to refresh token once
        // Skip retry logic for auth endpoints to prevent infinite recursion
        if (response.status === 401 && retryCount === 0 && !isAuthEndpoint) {
          const authErrorMessages = [
            'Invalid or expired token',
            'Invalid or expired access token',
            'No token provided',
          ];
          const shouldRefresh =
            authErrorMessages.some((msg) => errorMessage.includes(msg)) &&
            (options.refreshOnMissingToken !== false || !errorMessage.includes('No token provided'));

          if (shouldRefresh) {
            // Try to refresh token and retry the request
            const newToken = await this.refreshTokenIfNeeded();
            if (newToken) {
              // Retry the request with new token
              return this.request<T>(endpoint, options, retryCount + 1);
            }
          }

          // If refresh token is expired or refresh failed, throw authentication error
          if (errorMessage.includes('Invalid or expired refresh token')) {
            throw new AuthenticationError(errorMessage);
          }

          // For other auth errors, throw after retry attempt
          throw new AuthenticationError(errorMessage);
        }

        // For 429 errors that couldn't be retried: show global banner and throw RateLimitError
        if (response.status === 429) {
          const retryAfter =
            errorData.retryAfter ?? parseInt(response.headers.get('Retry-After') || '60', 10);
          if (typeof window !== 'undefined') {
            rateLimitStore.show(retryAfter);
          }
          throw new RateLimitError(
            errorMessage || 'Too many requests. Please try again later.',
            retryAfter
          );
        }

        // Retry on server errors (5xx) — transient cold start / overload; max 2 retries with backoff
        if (response.status >= 500 && response.status < 600 && retryCount < 2 && !isAuthEndpoint) {
          const baseMs = [800, 2000][retryCount];
          const jitter = baseMs * 0.3 * (Math.random() * 2 - 1);
          const delay = Math.round(baseMs + jitter);
          if (DEBUG_API) {
            console.warn(
              `Server error ${response.status}, retrying after ${delay}ms (attempt ${retryCount + 1}/2)`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw new Error(errorMessage);
      }

      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      // Read response as text first to check if it's empty
      const responseText = await response.text();

      // If no content or empty content, return success message for DELETE requests
      if (!responseText || responseText.trim() === '' || contentLength === '0') {
        // For DELETE requests, return success message if no content
        if (options.method === 'DELETE') {
          return { message: 'Deleted successfully' } as T;
        }
        return {} as T;
      }

      // Try to parse as JSON
      try {
        return JSON.parse(responseText) as T;
      } catch (parseError) {
        // If parsing fails but we have content, return text as message
        console.warn('Failed to parse response as JSON:', parseError);
        return { message: responseText } as T;
      }
    } catch (error) {
      // Handle network errors (CORS, connection refused, etc.)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(ApiClient.apiUnavailableMessage());
      }
      throw error;
    }
  }

  /**
   * Refresh token if needed (with debouncing to prevent multiple simultaneous refreshes)
   */
  private async refreshTokenIfNeeded(): Promise<string | null> {
    // If already refreshing, wait for the existing refresh promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (typeof window === 'undefined') return null;

    try {
      // Start refresh process
      this.isRefreshing = true;
      this.refreshPromise = authStore.refreshAccessToken().catch(() => null);

      const newToken = await this.refreshPromise;

      this.isRefreshing = false;
      this.refreshPromise = null;

      return newToken || null;
    } catch {
      this.isRefreshing = false;
      this.refreshPromise = null;
      return null;
    }
  }

  get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return withConcurrencyLimit(() => this.request<T>(endpoint, { ...options, method: 'GET' }));
  }

  post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    if (DEBUG_API && endpoint === '/cart' && data) {
      console.log('apiClient.post - /cart endpoint, data:', data);
    }
    if (DEBUG_API && endpoint === '/customer/returns' && data) {
      console.log('apiClient.post - /customer/returns endpoint, data:', data);
    }
    const body = data instanceof FormData ? data : data ? JSON.stringify(data) : undefined;
    return withConcurrencyLimit(() =>
      this.request<T>(endpoint, { ...options, method: 'POST', body })
    );
  }

  put<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const body = data instanceof FormData ? data : data ? JSON.stringify(data) : undefined;
    return withConcurrencyLimit(() =>
      this.request<T>(endpoint, { ...options, method: 'PUT', body })
    );
  }

  patch<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const body = data instanceof FormData ? data : data ? JSON.stringify(data) : undefined;
    return withConcurrencyLimit(() =>
      this.request<T>(endpoint, { ...options, method: 'PATCH', body })
    );
  }

  delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return withConcurrencyLimit(() => this.request<T>(endpoint, { ...options, method: 'DELETE' }));
  }
}

export const apiClient = new ApiClient();
