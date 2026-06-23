import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/api-key.service';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { AuthRequest } from './auth.middleware';
import { hasScope } from '../utils/api-scopes';
/**
 * Extract API key from request headers
 * Supports: Authorization: Bearer <key> or X-API-Key header
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Check if it's an API key (starts with sk_)
    if (token.startsWith('sk_')) {
      return token;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Get origin domain from request
 */
function getOrigin(req: Request): string | undefined {
  return req.headers.origin || req.headers.referer;
}

/**
 * Middleware to validate API key
 * This should be used as an alternative to JWT authentication for API access
 */
export async function validateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key via Authorization: Bearer <key> or X-API-Key header',
    });
    return;
  }

  const ip = getClientIP(req);
  const origin = getOrigin(req);

  const validation = await apiKeyService.validateApiKey(apiKey, ip, origin);

  if (!validation.valid || !validation.apiKey) {
    res.status(401).json({
      error: 'Invalid API key',
      message: validation.error || 'API key validation failed',
    });
    return;
  }

  // Check scope permissions
  const scopes = validation.apiKey.scopes || [];
  const path = req.path;
  const method = req.method;

  if (!hasScope(scopes, path, method)) {
    res.status(403).json({
      error: 'Insufficient permissions',
      message: `API key does not have permission to ${method} ${path}`,
      requiredScopes: scopes.length > 0 ? scopes : ['full access'],
    });
    return;
  }

  // Attach API key info to request
  req.apiKey = validation.apiKey;
  req.apiKeyPlain = apiKey; // Store plain key for logging

  // Attach user from API key owner
  if (validation.apiKey.user) {
    req.user = {
      id: validation.apiKey.user.id,
      userId: validation.apiKey.user.id,
      email: validation.apiKey.user.email,
      role: validation.apiKey.user.role,
    };
  }

  next();
}

/**
 * Create rate limiter based on API key's rate limit.
 * Uses config.rateLimit.defaultMax (1e9) so limit is never below that.
 */
export function createApiKeyRateLimiter(rateLimitValue: number) {
  const max = Number.isFinite(rateLimitValue) && rateLimitValue > 0
    ? rateLimitValue
    : config.rateLimit.defaultMax;
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => {
      // Use API key ID as key for rate limiting
      return req.apiKey?.id || req.ip || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${max} requests per 15 minutes`,
        retryAfter: 15,
      });
    },
  });
}

/**
 * Middleware to log API key usage
 */
export async function logApiKeyUsage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const responseTime = Date.now() - startTime;

    // Log usage asynchronously (don't block response)
    if (req.apiKey) {
      apiKeyService
        .logUsage(
          req.apiKey.id,
          getClientIP(req),
          req.path,
          req.method,
          res.statusCode,
          responseTime
        )
        .catch((error) => {
          console.error('Failed to log API key usage:', error);
        });
    }

    return originalJson(body);
  };

  next();
}

/**
 * Combined middleware: validate API key + rate limit (if not apiDisabled) + log usage
 */
export function apiKeyAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  validateApiKey(req, res, () => {
    if (!req.apiKey) {
      next();
      return;
    }
    // API_RATE_LIMIT_DISABLED=true or API_RATE_LIMIT_MAX=0 → limit is not applied
    if (config.rateLimit.apiDisabled) {
      logApiKeyUsage(req, res, next);
      return;
    }
    const limiter = createApiKeyRateLimiter(req.apiKey.rateLimit);
    limiter(req, res, () => logApiKeyUsage(req, res, next));
  });
}
