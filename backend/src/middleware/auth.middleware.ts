import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { getAccessTokenFromRequest } from '../utils/auth-cookies';
import type { Prisma } from '@prisma/client';

type ApiKey = Prisma.ApiKeyGetPayload<{
  include: {
    user?: {
      select: {
        id: true;
        email: true;
        role: true;
      };
    };
  };
}>;

export interface AuthRequest extends Request {
  user?: TokenPayload;
  apiKey?: ApiKey;
  apiKeyPlain?: string;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional auth: if valid Bearer token is present, sets req.user; otherwise continues without user.
 * Use on public routes that behave differently for admins (e.g. products list shows all for admin).
 */
export const optionalAuthenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = getAccessTokenFromRequest(req);
    if (!token) {
      next();
      return;
    }
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    next();
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
};
