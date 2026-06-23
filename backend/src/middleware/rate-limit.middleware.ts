import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

const noop = (_req: Request, _res: Response, next: NextFunction) => next();

function resolveKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createLimiter(
  max: number,
  windowMs: number,
  message: string,
  skipSuccessful = false
): (req: Request, res: Response, next: NextFunction) => void {
  if (max <= 0 || windowMs <= 0) return noop;
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: skipSuccessful,
    keyGenerator: resolveKey,
  }) as (req: Request, res: Response, next: NextFunction) => void;
}

export const apiLimiter = config.rateLimit.apiDisabled
  ? noop
  : createLimiter(
      config.rateLimit.apiMax,
      config.rateLimit.apiWindowMinutes * 60 * 1000,
      'Too many API requests. Please try again later.'
    );

/**
 * Auth-only limiters: only for login, register, forgot-password.
 * Enabled by default; AUTH_RATE_LIMIT_DISABLED=true disables.
 */
function createAuthLimiter(
  max: number,
  windowMs: number,
  message: string,
  skipSuccessful = false
): (req: Request, res: Response, next: NextFunction) => void {
  if (config.authRateLimit.disabled || max <= 0) return noop;
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: skipSuccessful,
  }) as (req: Request, res: Response, next: NextFunction) => void;
}

/** Limit on POST /api/auth/login (by IP). Successful attempts are not counted */
export const loginLimiter = createAuthLimiter(
  config.authRateLimit.login.max,
  config.authRateLimit.login.windowMs,
  'Too many login attempts. Please try again later.',
  true
);

/** Limit on POST /api/auth/register (by IP) */
export const registrationLimiter = createAuthLimiter(
  config.authRateLimit.register.max,
  config.authRateLimit.register.windowMs,
  'Too many registration attempts. Please try again later.'
);

/** Limit on POST /api/auth/forgot-password (by IP) */
export const forgotPasswordLimiter = createAuthLimiter(
  config.authRateLimit.forgotPassword.max,
  config.authRateLimit.forgotPassword.windowMs,
  'Too many password reset requests. Please try again later.'
);

/** Limit on POST /api/auth/verify-email (by IP) */
export const verifyEmailLimiter = createAuthLimiter(
  config.authRateLimit.verifyEmail.max,
  config.authRateLimit.verifyEmail.windowMs,
  'Too many verification attempts. Please try again later.'
);

export const checkoutLimiter = createLimiter(
  config.rateLimit.checkoutMax,
  config.rateLimit.checkoutWindowMinutes * 60 * 1000,
  'Too many checkout attempts. Please try again later.'
);

export const searchLimiter = createLimiter(
  config.rateLimit.searchMax,
  config.rateLimit.searchWindowMinutes * 60 * 1000,
  'Too many search requests. Please try again later.'
);

export const uploadLimiter = createLimiter(
  config.rateLimit.uploadMax,
  config.rateLimit.uploadWindowMinutes * 60 * 1000,
  'Too many upload requests. Please try again later.'
);

// Aliases for backward compatibility (for backward compatibility)
export const defaultAuthLimiter = loginLimiter;
export const defaultRegistrationLimiter = registrationLimiter;
