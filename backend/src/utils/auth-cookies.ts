import { Request, Response } from 'express';
import { config } from '../config/env';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const baseCookie = {
    httpOnly: true as const,
    secure: config.authCookies.secure,
    sameSite: config.authCookies.sameSite,
    domain: config.authCookies.domain,
    path: config.authCookies.path,
  };

  res.cookie(config.authCookies.accessName, accessToken, {
    ...baseCookie,
    maxAge: config.authCookies.accessMaxAgeMs,
  });
  res.cookie(config.authCookies.refreshName, refreshToken, {
    ...baseCookie,
    maxAge: config.authCookies.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(res: Response): void {
  const clearOpts = {
    httpOnly: true as const,
    secure: config.authCookies.secure,
    sameSite: config.authCookies.sameSite,
    domain: config.authCookies.domain,
    path: config.authCookies.path,
  };
  res.clearCookie(config.authCookies.accessName, clearOpts);
  res.clearCookie(config.authCookies.refreshName, clearOpts);
}

export function getAccessTokenFromRequest(req: Request): string | null {
  const fromCookie = req.cookies?.[config.authCookies.accessName];
  if (typeof fromCookie === 'string' && fromCookie.trim() !== '') {
    return fromCookie.trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  const fromCookie = req.cookies?.[config.authCookies.refreshName];
  if (typeof fromCookie === 'string' && fromCookie.trim() !== '') {
    return fromCookie.trim();
  }
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  if (typeof bodyToken === 'string' && bodyToken.trim() !== '') {
    return bodyToken.trim();
  }
  return null;
}
