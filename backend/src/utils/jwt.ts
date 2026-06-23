import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface TokenPayload {
  id?: string;
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  if (!config.jwt.refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

const TWO_FA_PENDING_PURPOSE = '2fa_login_pending';

export function generateTwoFactorPendingToken(userId: string): string {
  if (!config.jwt.refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }
  return jwt.sign(
    { purpose: TWO_FA_PENDING_PURPOSE, userId },
    config.jwt.refreshSecret,
    { expiresIn: '10m' } as jwt.SignOptions
  );
}

export function verifyTwoFactorPendingToken(token: string): { userId: string } {
  try {
    const p = jwt.verify(token, config.jwt.refreshSecret) as jwt.JwtPayload;
    if (p.purpose !== TWO_FA_PENDING_PURPOSE || typeof p.userId !== 'string') {
      throw new Error('Invalid token');
    }
    return { userId: p.userId };
  } catch {
    throw new Error('Invalid or expired two-factor login token');
  }
}
