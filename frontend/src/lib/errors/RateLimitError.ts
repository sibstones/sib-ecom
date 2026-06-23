/**
 * Error thrown when API returns 429 (rate limit exceeded).
 * Used to show global banner and avoid replacing entire page with generic error.
 */
export class RateLimitError extends Error {
  /** Seconds after which the user can retry (from Retry-After or backend) */
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}
