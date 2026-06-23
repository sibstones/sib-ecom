import { Request, Response } from 'express';
import { settingsService } from '../services/settings.service';
import { emailService } from '../services/email.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { storageService } from '../services/storage.service';
import { setPublicStorefrontCache } from '../utils/response-cache';

export class SettingsController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const settings = await settingsService.getAllSettingsForApi();
      setPublicStorefrontCache(res);
      res.json({ settings });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Settings] getAll failed:', err.message, err.stack);
      res.status(500).json({
        error: err.message || 'Failed to get settings',
      });
    }
  }

  async getSetting(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const value = await settingsService.getSettingForApi(key);
      setPublicStorefrontCache(res);
      res.json({ key, value });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get setting',
      });
    }
  }

  async updateSetting(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      const updatedBy = req.user?.userId;

      const setting = await settingsService.updateSetting(key, value, description, updatedBy);
      res.json({ setting });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update setting',
      });
    }
  }

  async updateMultiple(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { settings } = req.body as { settings: Record<string, unknown> };
      const updatedBy = req.user?.userId;

      // Convert unknown to the expected type
      const typedSettings: Record<string, boolean | string | number | object> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number' || (typeof value === 'object' && value !== null)) {
          typedSettings[key] = value;
        }
      }

      await settingsService.updateMultipleSettings(typedSettings, updatedBy);
      const allSettings = await settingsService.getAllSettingsForApi();
      res.json({ settings: allSettings });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update settings',
      });
    }
  }

  async resetToDefaults(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updatedBy = req.user?.userId;
      await settingsService.resetToDefaults(updatedBy);
      const settings = await settingsService.getAllSettingsForApi();
      res.json({ settings, message: 'Settings reset to defaults' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to reset settings',
      });
    }
  }

  async testEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await settingsService.getAllSettings();
      if (!settings.emailEnabled) {
        res.status(400).json({ error: 'Email service is not enabled' });
        return;
      }

      const provider = settings.emailProvider || 'CONSOLE';
      if (provider === 'CONSOLE') {
        res.status(400).json({
          success: false,
          error:
            'Email provider is CONSOLE (log only, no real delivery). Save settings with Nodemailer/SMTP and try again.',
          provider,
        });
        return;
      }

      if (provider === 'NODEMAILER') {
        if (
          !settings.emailNodemailerHost ||
          !settings.emailNodemailerUser ||
          !settings.emailNodemailerPassword
        ) {
          res.status(400).json({
            success: false,
            error: 'SMTP is incomplete. Save host, username, and password, then test again.',
            provider,
          });
          return;
        }
      }

      const testEmail = (req.body?.email as string) || settings.emailFromEmail || 'test@example.com';

      let smtpMeta: { host?: string; port?: number; secure?: boolean; user?: string } | undefined;
      if (provider === 'NODEMAILER') {
        const verify = await emailService.verifySmtpConnection();
        if (!verify.ok) {
          res.status(500).json({
            success: false,
            error: verify.error || 'SMTP connection failed',
            provider,
            smtp: { host: verify.host, port: verify.port, secure: verify.secure, user: verify.user },
          });
          return;
        }
        smtpMeta = {
          host: verify.host,
          port: verify.port,
          secure: verify.secure,
          user: verify.user,
        };
      }

      const result = await emailService.sendEmail(
        testEmail,
        'Test Email from Fashion Store',
        '<p>This is a test email. Your email configuration is working correctly.</p>',
        'This is a test email. Your email configuration is working correctly.',
        'SYSTEM'
      );
      if (result.success) {
        res.json({
          success: true,
          message: `Test email sent via ${provider} to ${testEmail}${result.messageId ? ` (id: ${result.messageId})` : ''}`,
          provider,
          messageId: result.messageId,
          smtp: smtpMeta,
        });
      } else {
        res.status(500).json({ success: false, error: result.error || 'Failed to send email', provider, smtp: smtpMeta });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to send test email',
      });
    }
  }

  async uploadSiteFavicon(req: AuthRequest & { file?: Express.Multer.File }, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const fileUrl = await storageService.uploadFile(file, 'site');
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upload favicon',
      });
    }
  }

  async uploadSiteAppleTouchIcon(req: AuthRequest & { file?: Express.Multer.File }, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const fileUrl = await storageService.uploadFile(file, 'site/apple-touch');
      res.status(200).json({ url: fileUrl });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to upload Apple touch icon',
      });
    }
  }

  async testPinterestConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await settingsService.getAllSettings();
      if (!settings.pinterestEnabled || !settings.pinterestAccessToken) {
        res.status(400).json({ error: 'Pinterest is not enabled or access token is missing' });
        return;
      }
      const fetchRes = await fetch('https://api.pinterest.com/v5/user_account', {
        headers: { Authorization: `Bearer ${settings.pinterestAccessToken}` },
      });
      if (fetchRes.ok) {
        res.json({ success: true, message: 'Pinterest connection successful' });
      } else {
        const err = (await fetchRes.json().catch(() => ({}))) as { message?: string };
        res.status(400).json({ success: false, error: err.message || 'Invalid Pinterest token' });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to verify Pinterest connection',
      });
    }
  }
}

export const settingsController = new SettingsController();
