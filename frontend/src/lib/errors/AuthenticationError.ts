/**
 * Custom error class for authentication errors
 * Used to identify token expiration and invalid token errors
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Invalid or expired token') {
    super(message);
    this.name = 'AuthenticationError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationError);
    }
  }
}
