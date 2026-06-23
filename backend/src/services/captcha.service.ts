import axios from 'axios';
import { config } from '../config/env';
import { settingsService } from './settings.service';

export interface CaptchaVerificationResult {
  success: boolean;
  score?: number; // For reCAPTCHA v3
  error?: string;
}

export class CaptchaService {
  private isProductionFailClosed(): boolean {
    return config.nodeEnv === 'production' && config.botProtection.failClosedInProduction;
  }

  private getEffectiveCaptchaSettings(settings: any) {
    const useProductionEnvCaptcha =
      config.nodeEnv === 'production' && config.botProtection.captcha.enabledInProduction;

    return {
      captchaEnabled: useProductionEnvCaptcha ? true : !!settings?.captchaEnabled,
      captchaProvider: settings?.captchaProvider || config.botProtection.captcha.provider,
      captchaSiteKey: settings?.captchaSiteKey || config.botProtection.captcha.siteKey,
      captchaSecretKey: settings?.captchaSecretKey || config.botProtection.captcha.secretKey,
      captchaThreshold: settings?.captchaThreshold ?? config.botProtection.captcha.threshold,
      captchaRequiredForRegistration: useProductionEnvCaptcha
        ? config.botProtection.captcha.requireForRegistrationInProduction
        : !!settings?.captchaRequiredForRegistration,
      captchaRequiredForLogin: useProductionEnvCaptcha
        ? config.botProtection.captcha.requireForLoginInProduction
        : !!settings?.captchaRequiredForLogin,
    };
  }

  /**
   * Verify CAPTCHA token
   */
  async verifyCaptcha(token: string, remoteip?: string): Promise<CaptchaVerificationResult> {
    let settings;
    try {
      settings = await settingsService.getAllSettings();
    } catch (error) {
      console.error('Error loading CAPTCHA settings:', error);
      return this.isProductionFailClosed()
        ? { success: false, error: 'CAPTCHA settings unavailable' }
        : { success: true };
    }

    const effectiveSettings = this.getEffectiveCaptchaSettings(settings);

    if (!effectiveSettings.captchaEnabled) {
      return { success: true };
    }
    if (!token) {
      return { success: false, error: 'CAPTCHA token is required' };
    }
    if (!effectiveSettings.captchaSiteKey || !effectiveSettings.captchaSecretKey) {
      return this.isProductionFailClosed()
        ? { success: false, error: 'CAPTCHA is enabled but not fully configured' }
        : { success: true };
    }

    try {
      const provider = effectiveSettings.captchaProvider || 'GOOGLE_RECAPTCHA_V3';
      switch (provider) {
        case 'GOOGLE_RECAPTCHA_V2':
        case 'GOOGLE_RECAPTCHA_V3':
          return await this.verifyGoogleRecaptcha(token, remoteip, effectiveSettings);
        
        case 'HCAPTCHA':
          return await this.verifyHCaptcha(token, remoteip, effectiveSettings);
        
        case 'CLOUDFLARE_TURNSTILE':
          return await this.verifyCloudflareTurnstile(token, remoteip, effectiveSettings);
        
        default:
          return { success: false, error: 'Unknown CAPTCHA provider' };
      }
    } catch (error) {
      console.error('CAPTCHA verification error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'CAPTCHA verification failed' 
      };
    }
  }

  /**
   * Verify Google reCAPTCHA v2 or v3
   */
  private async verifyGoogleRecaptcha(
    token: string,
    remoteip: string | undefined,
    settings: any
  ): Promise<CaptchaVerificationResult> {
    if (!settings.captchaSecretKey) {
      return { success: false, error: 'CAPTCHA secret key not configured' };
    }

    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: settings.captchaSecretKey,
      response: token,
      ...(remoteip && { remoteip }),
    });

    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'reCAPTCHA verification failed',
      };
    }

    // For reCAPTCHA v3, check score threshold
    if (settings.captchaProvider === 'GOOGLE_RECAPTCHA_V3') {
      const score = data.score || 0;
      const threshold = settings.captchaThreshold || 0.5;

      if (score < threshold) {
        return {
          success: false,
          score,
          error: `reCAPTCHA score ${score} is below threshold ${threshold}`,
        };
      }

      return { success: true, score };
    }

    return { success: true };
  }

  /**
   * Verify hCaptcha
   */
  private async verifyHCaptcha(
    token: string,
    remoteip: string | undefined,
    settings: any
  ): Promise<CaptchaVerificationResult> {
    if (!settings.captchaSecretKey) {
      return { success: false, error: 'CAPTCHA secret key not configured' };
    }

    const url = 'https://hcaptcha.com/siteverify';
    const params = new URLSearchParams({
      secret: settings.captchaSecretKey,
      response: token,
      ...(remoteip && { remoteip }),
    });

    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'hCaptcha verification failed',
      };
    }

    return { success: true };
  }

  /**
   * Verify Cloudflare Turnstile
   */
  private async verifyCloudflareTurnstile(
    token: string,
    remoteip: string | undefined,
    settings: any
  ): Promise<CaptchaVerificationResult> {
    if (!settings.captchaSecretKey) {
      return { success: false, error: 'CAPTCHA secret key not configured' };
    }

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const params = new URLSearchParams({
      secret: settings.captchaSecretKey,
      response: token,
      ...(remoteip && { remoteip }),
    });

    const response = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Turnstile verification failed',
      };
    }

    return { success: true };
  }

  /**
   * Check if CAPTCHA is required for registration
   */
  async isRequiredForRegistration(): Promise<boolean> {
    try {
      const settings = await settingsService.getAllSettings();
      const effectiveSettings = this.getEffectiveCaptchaSettings(settings);
      return !!(effectiveSettings.captchaEnabled && effectiveSettings.captchaRequiredForRegistration);
    } catch (error) {
      console.error('Error checking CAPTCHA requirement for registration:', error);
      return this.isProductionFailClosed()
        ? config.botProtection.captcha.requireForRegistrationInProduction
        : false;
    }
  }

  /**
   * Check if CAPTCHA is required for login
   */
  async isRequiredForLogin(): Promise<boolean> {
    try {
      const settings = await settingsService.getAllSettings();
      const effectiveSettings = this.getEffectiveCaptchaSettings(settings);
      return !!(effectiveSettings.captchaEnabled && effectiveSettings.captchaRequiredForLogin);
    } catch (error) {
      console.error('Error checking CAPTCHA requirement for login:', error);
      return this.isProductionFailClosed()
        ? config.botProtection.captcha.requireForLoginInProduction
        : false;
    }
  }
}

export const captchaService = new CaptchaService();
