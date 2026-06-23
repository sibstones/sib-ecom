import { AuthenticationError } from '../errors/AuthenticationError';
import { RateLimitError } from '../errors/RateLimitError';
import { translateError, t } from '$lib/utils/i18n';

/**
 * Check if an error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Check if an error is an authentication error
 *
 * @example
 * ```svelte
 * <script>
 *   import { isAuthenticationError } from '$lib/utils/error-handler';
 *   import AuthError from '$lib/components/AuthError.svelte';
 *
 *   let error: Error | null = null;
 *
 *   try {
 *     await apiCall();
 *   } catch (e) {
 *     error = e instanceof Error ? e : new Error('Unknown error');
 *   }
 * </script>
 *
 * {#if error && isAuthenticationError(error)}
 *   <AuthError message={error.message} />
 * {:else if error}
 *   <p>Error: {error.message}</p>
 * {/if}
 * ```
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractErrorText(error: unknown): string | null {
  if (error == null) return null;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed || null;
  }
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed) return trimmed;
  }
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response)) {
      const data = response.data;
      if (isRecord(data) && typeof data.error === 'string') {
        const trimmed = data.error.trim();
        if (trimmed) return trimmed;
      }
    }
    if (typeof error.message === 'string') {
      const trimmed = error.message.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

/**
 * Resolve API or thrown errors to a localized message, with a fallback key when no text is available.
 */
export function resolveApiError(error: unknown, fallbackKey: string): string {
  const raw = extractErrorText(error);
  if (raw) return translateError(raw);
  return t(fallbackKey);
}

/**
 * Get error message from any error type
 */
export function getErrorMessage(error: unknown, fallbackKey = 'error.unknownError'): string {
  return resolveApiError(error, fallbackKey);
}
