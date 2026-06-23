import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

const CSRF_COOKIE_NAME = config.csrf.cookieName;
const COOKIE_MAX_AGE_MS = config.csrf.cookieMaxAgeMs;

/**
 * Generate a cryptographically secure CSRF token.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res: Response, token: string): void {
  const isProduction = config.nodeEnv === 'production';
  const sameSite = config.csrf.sameSite;
  // SameSite=None requires Secure; browsers allow Secure cookies on localhost in dev.
  const secure = sameSite === 'none' ? true : isProduction;

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

/**
 * GET /api/auth/csrf-token handler.
 * Sets a SameSite cookie and returns the same token in JSON (double-submit pattern).
 * No authentication required — used before login/register.
 */
export function getCsrfToken(_req: Request, res: Response): void {
  const existingToken = _req.cookies?.[CSRF_COOKIE_NAME];
  const token =
    typeof existingToken === 'string' && existingToken.trim() !== ''
      ? existingToken.trim()
      : generateToken();

  // Re-issue the same cookie to refresh maxAge without rotating the token.
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
}

/**
 * Verify CSRF token for state-changing requests.
 * Skips GET, HEAD, OPTIONS and payment webhook paths.
 * Compares X-CSRF-Token header to the cookie value (double-submit).
 */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  if (req.path.includes('/webhook')) {
    return next();
  }

  const headerToken = (req.headers['x-csrf-token'] as string)?.trim();
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;

  if (!headerToken || !cookieToken) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }
  if (headerToken !== cookieToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }
  next();
}
