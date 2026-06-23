import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken, TokenPayload } from '../utils/jwt';
import { settingsService } from './settings.service';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';

export type OAuthProvider = 'GOOGLE' | 'YANDEX' | 'VKONTAKTE' | 'FACEBOOK' | 'APPLE';

interface OAuthUserInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    isPartner: boolean;
    partnerStatus: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export class OAuthService {
  /**
   * Get OAuth authorization URL for a provider
   */
  async getAuthorizationUrl(provider: OAuthProvider, redirectUri: string, state: string): Promise<string> {
    const settings = await settingsService.getAllSettings();

    switch (provider) {
      case 'GOOGLE': {
        if (!settings.oauthGoogleEnabled || !settings.oauthGoogleClientId) {
          throw new Error('Google OAuth is not configured');
        }
        const googleParams = new URLSearchParams({
          client_id: settings.oauthGoogleClientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          state,
          access_type: 'offline',
          prompt: 'consent',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`;
      }

      case 'YANDEX': {
        if (!settings.oauthYandexEnabled || !settings.oauthYandexClientId) {
          throw new Error('Yandex OAuth is not configured');
        }
        const yandexParams = new URLSearchParams({
          client_id: settings.oauthYandexClientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'login:email login:info',
          state,
        });
        return `https://oauth.yandex.ru/authorize?${yandexParams.toString()}`;
      }

      case 'VKONTAKTE': {
        if (!settings.oauthVkontakteEnabled || !settings.oauthVkontakteClientId) {
          throw new Error('VKontakte OAuth is not configured');
        }
        const vkParams = new URLSearchParams({
          client_id: settings.oauthVkontakteClientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'email',
          state,
          v: '5.131',
        });
        return `https://oauth.vk.com/authorize?${vkParams.toString()}`;
      }

      case 'FACEBOOK': {
        if (!settings.oauthFacebookEnabled || !settings.oauthFacebookClientId) {
          throw new Error('Facebook OAuth is not configured');
        }
        const facebookParams = new URLSearchParams({
          client_id: settings.oauthFacebookClientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'email public_profile',
          state,
        });
        return `https://www.facebook.com/v18.0/dialog/oauth?${facebookParams.toString()}`;
      }

      case 'APPLE': {
        if (!settings.oauthAppleEnabled || !settings.oauthAppleClientId) {
          throw new Error('Apple OAuth is not configured');
        }
        // Apple uses a similar flow but with different endpoints
        const appleParams = new URLSearchParams({
          client_id: settings.oauthAppleClientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'name email',
          response_mode: 'form_post',
          state,
        });
        return `https://appleid.apple.com/auth/authorize?${appleParams.toString()}`;
      }

      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Exchange authorization code for access token and get user info
   */
  async handleCallback(
    provider: OAuthProvider,
    code: string,
    redirectUri: string
  ): Promise<AuthResponse> {
    const settings = await settingsService.getAllSettings();

    // Check if registration is enabled
    if (!settings.registrationEnabled) {
      throw new Error('Registration is currently disabled');
    }

    let userInfo: OAuthUserInfo;

    switch (provider) {
      case 'GOOGLE':
        userInfo = await this.handleGoogleCallback(code, redirectUri, settings);
        break;
      case 'YANDEX':
        userInfo = await this.handleYandexCallback(code, redirectUri, settings);
        break;
      case 'VKONTAKTE':
        userInfo = await this.handleVkontakteCallback(code, redirectUri, settings);
        break;
      case 'FACEBOOK':
        userInfo = await this.handleFacebookCallback(code, redirectUri, settings);
        break;
      case 'APPLE':
        userInfo = await this.handleAppleCallback(code, redirectUri, settings);
        break;
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    // Check if OAuth account exists
    const oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: userInfo.id,
        },
      },
    });

    if (oauthAccount) {
      // Update OAuth account
      await prisma.oAuthAccount.update({
        where: { id: oauthAccount.id },
        data: {
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          avatarUrl: userInfo.avatarUrl,
          updatedAt: new Date(),
        },
      });

      user = await prisma.user.findUnique({
        where: { id: oauthAccount.userId },
      });
    } else if (user) {
      // Link OAuth account to existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: provider as any,
          providerId: userInfo.id,
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          avatarUrl: userInfo.avatarUrl,
        },
      });
    } else {
      // Create new user with OAuth account
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          role: UserRole.CUSTOMER,
          emailVerified: true, // OAuth providers verify emails
          oauthAccounts: {
            create: {
              provider: provider as any,
              providerId: userInfo.id,
              email: userInfo.email,
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              avatarUrl: userInfo.avatarUrl,
            },
          },
        },
      });
    }

    if (!user || !user.isActive) {
      throw new Error('Account is deactivated. Please contact administrator.');
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Save refresh token in session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        role: user.role,
        isPartner: user.isPartner || false,
        partnerStatus: user.partnerStatus || null,
      },
      accessToken,
      refreshToken,
    };
  }

  private async handleGoogleCallback(
    code: string,
    redirectUri: string,
    settings: any
  ): Promise<OAuthUserInfo> {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: settings.oauthGoogleClientId,
      client_secret: settings.oauthGoogleClientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const { id, email, given_name, family_name, picture } = userResponse.data;

    return {
      id: id.toString(),
      email,
      firstName: given_name,
      lastName: family_name,
      avatarUrl: picture,
    };
  }

  private async handleYandexCallback(
    code: string,
    redirectUri: string,
    settings: any
  ): Promise<OAuthUserInfo> {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://oauth.yandex.ru/token', {
      grant_type: 'authorization_code',
      code,
      client_id: settings.oauthYandexClientId,
      client_secret: settings.oauthYandexClientSecret,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://login.yandex.ru/info', {
      headers: {
        Authorization: `OAuth ${access_token}`,
      },
      params: {
        format: 'json',
      },
    });

    const { id, default_email, first_name, last_name, default_avatar_id } = userResponse.data;

    return {
      id: id.toString(),
      email: default_email,
      firstName: first_name,
      lastName: last_name,
      avatarUrl: default_avatar_id ? `https://avatars.yandex.net/get-yapic/${default_avatar_id}/islands-200` : undefined,
    };
  }

  private async handleVkontakteCallback(
    code: string,
    redirectUri: string,
    settings: any
  ): Promise<OAuthUserInfo> {
    // Exchange code for access token
    const tokenResponse = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: settings.oauthVkontakteClientId,
        client_secret: settings.oauthVkontakteClientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const { access_token, user_id, email } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.vk.com/method/users.get', {
      params: {
        user_ids: user_id,
        fields: 'photo_200',
        access_token,
        v: '5.131',
      },
    });

    const user = userResponse.data.response[0];

    return {
      id: user_id.toString(),
      email: email || `${user_id}@vk.com`,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.photo_200,
    };
  }

  private async handleFacebookCallback(
    code: string,
    redirectUri: string,
    settings: any
  ): Promise<OAuthUserInfo> {
    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: settings.oauthFacebookClientId,
        client_secret: settings.oauthFacebookClientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        fields: 'id,email,first_name,last_name,picture',
        access_token,
      },
    });

    const { id, email, first_name, last_name, picture } = userResponse.data;

    return {
      id: id.toString(),
      email: email || `${id}@facebook.com`,
      firstName: first_name,
      lastName: last_name,
      avatarUrl: picture?.data?.url,
    };
  }

  private async handleAppleCallback(
    code: string,
    redirectUri: string,
    settings: any
  ): Promise<OAuthUserInfo> {
    // Apple Sign In requires JWT client secret
    const clientSecret = this.generateAppleClientSecret(settings);

    // Exchange code for access token
    const params = new URLSearchParams({
      client_id: settings.oauthAppleClientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const tokenResponse = await axios.post('https://appleid.apple.com/auth/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { id_token } = tokenResponse.data;

    // Decode ID token to get user info
    const decoded = jwt.decode(id_token) as any;

    if (!decoded || !decoded.sub) {
      throw new Error('Invalid Apple ID token');
    }

    return {
      id: decoded.sub,
      email: decoded.email || `${decoded.sub}@apple.com`,
      firstName: undefined, // Apple doesn't provide name in ID token
      lastName: undefined,
      avatarUrl: undefined,
    };
  }

  private generateAppleClientSecret(settings: any): string {
    const privateKey = Buffer.from(settings.oauthApplePrivateKey, 'base64').toString('utf-8');
    
    const token = jwt.sign(
      {
        iss: settings.oauthAppleTeamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'https://appleid.apple.com',
        sub: settings.oauthAppleClientId,
      },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: settings.oauthAppleKeyId,
      }
    );

    return token;
  }
}

export const oauthService = new OAuthService();
