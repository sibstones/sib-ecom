import { Request, Response } from 'express';
import crypto from 'crypto';
import { oauthService, OAuthProvider } from '../services/oauth.service';
import { config } from '../config/env';
import { setAuthCookies } from '../utils/auth-cookies';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export class OAuthController {
  /**
   * Initiate OAuth flow - redirect to provider
   */
  async initiate(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const { redirectUri } = req.query;

      if (!redirectUri || typeof redirectUri !== 'string') {
        res.status(400).json({ error: 'redirectUri is required' });
        return;
      }

      const validProviders: OAuthProvider[] = ['GOOGLE', 'YANDEX', 'VKONTAKTE', 'FACEBOOK', 'APPLE'];
      if (!validProviders.includes(provider as OAuthProvider)) {
        res.status(400).json({ error: 'Invalid OAuth provider' });
        return;
      }

      const state = crypto.randomBytes(32).toString('hex');
      const isProduction = config.nodeEnv === 'production';
      res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_TTL_MS,
        path: '/api/auth/oauth',
      });

      const authUrl = await oauthService.getAuthorizationUrl(
        provider as OAuthProvider,
        redirectUri,
        state
      );

      res.json({ authUrl });
    } catch (error) {
      console.error('OAuth initiate error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to initiate OAuth flow',
      });
    }
  }

  /**
   * Handle OAuth callback
   */
  async callback(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const { code, redirectUri, state } = req.query;

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Authorization code is required' });
        return;
      }

      if (!redirectUri || typeof redirectUri !== 'string') {
        res.status(400).json({ error: 'redirectUri is required' });
        return;
      }
      if (!state || typeof state !== 'string') {
        res.status(400).json({ error: 'OAuth state is required' });
        return;
      }

      const validProviders: OAuthProvider[] = ['GOOGLE', 'YANDEX', 'VKONTAKTE', 'FACEBOOK', 'APPLE'];
      if (!validProviders.includes(provider as OAuthProvider)) {
        res.status(400).json({ error: 'Invalid OAuth provider' });
        return;
      }

      const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
      if (!cookieState || typeof cookieState !== 'string' || !timingSafeEqualString(cookieState, state)) {
        res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/oauth' });
        res.status(400).json({ error: 'Invalid OAuth state' });
        return;
      }
      res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/oauth' });

      const result = await oauthService.handleCallback(
        provider as OAuthProvider,
        code,
        redirectUri
      );

      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.json({ user: result.user });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'OAuth authentication failed',
      });
    }
  }
}

export const oauthController = new OAuthController();
