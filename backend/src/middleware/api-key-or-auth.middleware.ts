import { Response, NextFunction } from 'express';
import { AuthRequest, authenticate } from './auth.middleware';
import { apiKeyAuth } from './api-key.middleware';

/**
 * Middleware that allows either API key OR JWT authentication
 * Useful for endpoints that should be accessible via both methods
 */
export function apiKeyOrAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Check if API key is present
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  
  const hasApiKey = 
    (authHeader && authHeader.startsWith('Bearer ') && authHeader.substring(7).startsWith('sk_')) ||
    (apiKeyHeader && typeof apiKeyHeader === 'string' && apiKeyHeader.startsWith('sk_'));

  if (hasApiKey) {
    // Use API key authentication
    apiKeyAuth(req, res, next);
  } else {
    // Use JWT authentication
    authenticate(req, res, next);
  }
}
