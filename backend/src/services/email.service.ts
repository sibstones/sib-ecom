import prisma from '../config/database';
import { settingsService } from './settings.service';
import { emailTemplateService } from './email-template.service';
import {
  getDeliveryEmailCopy,
  getEmailVerificationEmailCopy,
  getOrderConfirmationEmailCopy,
  getPasswordResetEmailCopy,
  getPaymentRequestEmailCopy,
  getShippingEmailCopy,
  getWelcomeEmailCopy,
} from '../config/email-i18n';
import { resolveFrontendBaseUrl } from '../utils/frontend-url';

export type EmailProvider = 'NODEMAILER' | 'SENDGRID' | 'AWS_SES' | 'RESEND' | 'MAILGUN' | 'BREVO' | 'CONSOLE';

export interface EmailSettings {
  enabled: boolean;
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  // Nodemailer settings
  nodemailerHost?: string;
  nodemailerPort?: number;
  nodemailerSecure?: boolean;
  nodemailerUser?: string;
  nodemailerPassword?: string;
  // SendGrid settings
  sendgridApiKey?: string;
  // AWS SES settings
  awsSesRegion?: string;
  awsSesAccessKeyId?: string;
  awsSesSecretAccessKey?: string;
  // Resend settings
  resendApiKey?: string;
  // Mailgun settings
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunRegion?: string; // 'us' or 'eu'
  // Brevo (Sendinblue) settings
  brevoApiKey?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailStyles {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: string;
  buttonColor: string;
  buttonTextColor: string;
}

type SmtpErrorDetails = {
  message?: string;
  response?: string;
  responseCode?: number;
  code?: string;
  command?: string;
};

export class EmailService {
  private async getSettings(): Promise<EmailSettings> {
    try {
      const enabled = (await settingsService.getSetting('emailEnabled')) as boolean;
      const provider = (await settingsService.getSetting('emailProvider')) as EmailProvider;
      const fromEmail = (await settingsService.getSetting('emailFromEmail')) as string;
      const fromName = (await settingsService.getSetting('emailFromName')) as string;

      return {
        enabled: enabled || false,
        provider: provider || 'CONSOLE',
        fromEmail: fromEmail || 'noreply@example.com',
        fromName: fromName || 'Fashion Store',
        nodemailerHost: (await settingsService.getSetting('emailNodemailerHost')) as string | undefined,
        nodemailerPort: (await settingsService.getSetting('emailNodemailerPort')) as number | undefined,
        nodemailerSecure: (await settingsService.getSetting('emailNodemailerSecure')) as boolean | undefined,
        nodemailerUser: (await settingsService.getSetting('emailNodemailerUser')) as string | undefined,
        nodemailerPassword: (await settingsService.getSetting('emailNodemailerPassword')) as string | undefined,
        sendgridApiKey: (await settingsService.getSetting('emailSendgridApiKey')) as string | undefined,
        awsSesRegion: (await settingsService.getSetting('emailAwsSesRegion')) as string | undefined,
        awsSesAccessKeyId: (await settingsService.getSetting('emailAwsSesAccessKeyId')) as string | undefined,
        awsSesSecretAccessKey: (await settingsService.getSetting('emailAwsSesSecretAccessKey')) as string | undefined,
        resendApiKey: (await settingsService.getSetting('emailResendApiKey')) as string | undefined,
        mailgunApiKey: (await settingsService.getSetting('emailMailgunApiKey')) as string | undefined,
        mailgunDomain: (await settingsService.getSetting('emailMailgunDomain')) as string | undefined,
        mailgunRegion: (await settingsService.getSetting('emailMailgunRegion')) as string | undefined,
        brevoApiKey: (await settingsService.getSetting('emailBrevoApiKey')) as string | undefined,
      };
    } catch (error) {
      console.error('Failed to load email settings:', error);
      // Fallback to environment variables
      return {
        enabled: process.env.EMAIL_ENABLED === 'true',
        provider: (process.env.EMAIL_PROVIDER as EmailProvider) || 'CONSOLE',
        fromEmail: process.env.EMAIL_FROM_EMAIL || 'noreply@example.com',
        fromName: process.env.EMAIL_FROM_NAME || 'Fashion Store',
        nodemailerHost: process.env.EMAIL_NODEMAILER_HOST,
        nodemailerPort: process.env.EMAIL_NODEMAILER_PORT ? parseInt(process.env.EMAIL_NODEMAILER_PORT) : undefined,
        nodemailerSecure: process.env.EMAIL_NODEMAILER_SECURE === 'true',
        nodemailerUser: process.env.EMAIL_NODEMAILER_USER,
        nodemailerPassword: process.env.EMAIL_NODEMAILER_PASSWORD,
        sendgridApiKey: process.env.EMAIL_SENDGRID_API_KEY,
        awsSesRegion: process.env.EMAIL_AWS_SES_REGION,
        awsSesAccessKeyId: process.env.EMAIL_AWS_SES_ACCESS_KEY_ID,
        awsSesSecretAccessKey: process.env.EMAIL_AWS_SES_SECRET_ACCESS_KEY,
        resendApiKey: process.env.EMAIL_RESEND_API_KEY,
        mailgunApiKey: process.env.EMAIL_MAILGUN_API_KEY,
        mailgunDomain: process.env.EMAIL_MAILGUN_DOMAIN,
        mailgunRegion: process.env.EMAIL_MAILGUN_REGION,
        brevoApiKey: process.env.EMAIL_BREVO_API_KEY,
      };
    }
  }

  private async getEmailStyles(): Promise<EmailStyles> {
    try {
      return {
        primaryColor: ((await settingsService.getSetting('emailPrimaryColor')) as string) || '#111111',
        secondaryColor: ((await settingsService.getSetting('emailSecondaryColor')) as string) || '#737373',
        backgroundColor: ((await settingsService.getSetting('emailBackgroundColor')) as string) || '#ffffff',
        textColor: ((await settingsService.getSetting('emailTextColor')) as string) || '#171717',
        fontFamily:
          ((await settingsService.getSetting('emailFontFamily')) as string) ||
          "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: ((await settingsService.getSetting('emailFontSize')) as string) || '16px',
        buttonColor: ((await settingsService.getSetting('emailButtonColor')) as string) || '#111111',
        buttonTextColor: ((await settingsService.getSetting('emailButtonTextColor')) as string) || '#ffffff',
      };
    } catch (error) {
      console.error('Failed to load email styles:', error);
      return {
        primaryColor: '#111111',
        secondaryColor: '#737373',
        backgroundColor: '#ffffff',
        textColor: '#171717',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: '16px',
        buttonColor: '#111111',
        buttonTextColor: '#ffffff',
      };
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /** Build absolute URL for logo and links (relative paths use storefront base). */
  private resolveAbsoluteUrl(baseNoTrailingSlash: string, ref: string | null | undefined): string | null {
    if (!ref || !String(ref).trim()) return null;
    const t = String(ref).trim();
    if (/^https?:\/\//i.test(t)) return t;
    const b = baseNoTrailingSlash.replace(/\/$/, '');
    const path = t.startsWith('/') ? t : `/${t}`;
    return `${b}${path}`;
  }

  /**
   * Logo from Header settings (image or text); name from email "from" name. Minimal fallback if header unavailable.
   */
  private async getEmailBranding(styles: EmailStyles): Promise<{
    brandEscaped: string;
    siteUrl: string;
    logoHtml: string;
  }> {
    const mailSettings = await this.getSettings();
    const siteUrl = await resolveFrontendBaseUrl();
    const brandName = (mailSettings.fromName || 'Store').trim() || 'Store';
    const brandEscaped = this.escapeHtml(brandName);

    let logoInner = `<span style="font-size:19px;font-weight:600;letter-spacing:-0.02em;color:${this.escapeAttr(styles.textColor)};">${brandEscaped}</span>`;

    try {
      const { headerService } = await import('./header.service');
      const h = await headerService.getSettings();
      const logoLinkRaw = typeof h.logoLink === 'string' && h.logoLink.trim() ? h.logoLink.trim() : '/';
      const logoHref =
        this.resolveAbsoluteUrl(siteUrl, logoLinkRaw) ||
        `${siteUrl}/`;

      if (h.logoType === 'IMAGE' && h.logoImageUrl && String(h.logoImageUrl).trim()) {
        const imgSrc = this.resolveAbsoluteUrl(siteUrl, h.logoImageUrl);
        if (imgSrc) {
          const alt = this.escapeHtml((h.logoText || brandName).trim() || brandName);
          logoInner = `<img src="${this.escapeAttr(imgSrc)}" alt="${alt}" width="180" style="max-width:180px;height:auto;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />`;
        }
      } else if (h.logoType === 'TEXT' && h.logoText && String(h.logoText).trim()) {
        const hex = typeof h.logoColor === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(h.logoColor.trim())
          ? h.logoColor.trim()
          : styles.textColor;
        logoInner = `<span style="font-size:20px;font-weight:600;letter-spacing:-0.03em;color:${this.escapeAttr(hex)};">${this.escapeHtml(String(h.logoText).trim())}</span>`;
      } else if (h.logoType === 'SVG') {
        const t = (h.logoText && String(h.logoText).trim()) || brandName;
        const hex = typeof h.logoColor === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(h.logoColor.trim())
          ? h.logoColor.trim()
          : styles.textColor;
        logoInner = `<span style="font-size:20px;font-weight:600;letter-spacing:-0.03em;color:${this.escapeAttr(hex)};">${this.escapeHtml(t)}</span>`;
      }

      const logoHtml = `<a href="${this.escapeAttr(logoHref)}" style="color:inherit;text-decoration:none;display:inline-block;">${logoInner}</a>`;
      return { brandEscaped, siteUrl, logoHtml };
    } catch (e) {
      console.warn('[Email] Header branding unavailable, using text name:', e instanceof Error ? e.message : e);
    }

    const logoHtml = `<a href="${this.escapeAttr(siteUrl + '/')}" style="color:inherit;text-decoration:none;display:inline-block;">${logoInner}</a>`;
    return { brandEscaped, siteUrl, logoHtml };
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    type: string = 'GENERAL',
    userId?: string,
    orderId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const settings = await this.getSettings();

    if (!settings.enabled) {
      console.log(`Email sending is disabled. Would send to ${to}: ${subject}`);
      return { success: false, error: 'Email sending is disabled' };
    }

    // Log email notification
    let notificationId: string | undefined;
    try {
      const notification = await prisma.emailNotification.create({
        data: {
          userId,
          orderId,
          type,
          subject,
          body: html,
          status: 'PENDING',
        },
      });
      notificationId = notification.id;
    } catch (error) {
      console.error('Failed to log email notification:', error);
    }

    try {
      let result: { success: boolean; messageId?: string; error?: string };

      switch (settings.provider) {
        case 'NODEMAILER':
          result = await this.sendViaNodemailer(to, subject, html, text, settings);
          break;
        case 'SENDGRID':
          result = await this.sendViaSendGrid(to, subject, html, text, settings);
          break;
        case 'AWS_SES':
          result = await this.sendViaAwsSes(to, subject, html, text, settings);
          break;
        case 'RESEND':
          result = await this.sendViaResend(to, subject, html, text, settings);
          break;
        case 'MAILGUN':
          result = await this.sendViaMailgun(to, subject, html, text, settings);
          break;
        case 'BREVO':
          result = await this.sendViaBrevo(to, subject, html, text, settings);
          break;
        case 'CONSOLE':
        default:
          result = await this.sendViaConsole(to, subject, html, text);
          break;
      }

      // Update notification status
      if (notificationId) {
        await prisma.emailNotification.update({
          where: { id: notificationId },
          data: {
            status: result.success ? 'SENT' : 'FAILED',
            sentAt: result.success ? new Date() : undefined,
          },
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send email:', errorMessage);

      // Update notification status
      if (notificationId) {
        await prisma.emailNotification.update({
          where: { id: notificationId },
          data: {
            status: 'FAILED',
          },
        });
      }

      return { success: false, error: errorMessage };
    }
  }

  private async sendViaConsole(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log('='.repeat(60));
    console.log('EMAIL (CONSOLE MODE)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text || 'HTML only'}`);
    console.log('HTML Preview:', html.substring(0, 200) + '...');
    console.log('='.repeat(60));

    return { success: true, messageId: `console-${Date.now()}` };
  }

  private resolveSmtpPort(settings: EmailSettings): number {
    const raw = settings.nodemailerPort;
    const port = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(port) && port > 0 ? port : 587;
  }

  private resolveSmtpSecure(settings: EmailSettings, port: number): boolean {
    const raw = settings.nodemailerSecure as boolean | string | undefined;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return port === 465;
    return port === 465;
  }

  private normalizeEmailSettings(settings: EmailSettings): EmailSettings {
    return {
      ...settings,
      fromEmail: settings.fromEmail?.trim() || '',
      fromName: settings.fromName?.trim() || '',
      nodemailerHost: settings.nodemailerHost?.trim(),
      nodemailerUser: settings.nodemailerUser?.trim(),
    };
  }

  private formatSmtpError(error: unknown, settings: EmailSettings, port?: number, secure?: boolean): string {
    const smtpError = (error && typeof error === 'object' ? error : {}) as SmtpErrorDetails;
    const responseCode = smtpError.responseCode;
    const response = typeof smtpError.response === 'string' ? smtpError.response.trim() : '';
    const command = typeof smtpError.command === 'string' ? smtpError.command : '';
    const baseMessage =
      typeof smtpError.message === 'string' && smtpError.message.trim()
        ? smtpError.message.trim()
        : 'Unknown SMTP error';

    if (responseCode === 535 || /\b535\b/.test(response) || /\bauthentication\b/i.test(baseMessage)) {
      const hints = [
        `SMTP authentication failed for "${settings.nodemailerUser || 'unknown user'}" on ${settings.nodemailerHost || 'unknown host'}:${port ?? 'n/a'}.`,
        'Server rejected the login credentials (SMTP 535).',
        'Check that SMTP User is the full mailbox login, not the site/admin account username.',
        'If this is Gmail, Yandex, Outlook, Zoho, or similar, use an app password instead of the regular account password.',
        `Confirm the port/security pair with your provider: port 465 expects secure=true, port 587 usually expects secure=false.`,
      ];

      if (command) {
        hints.push(`SMTP command: ${command}.`);
      }
      if (response) {
        hints.push(`Server response: ${response}.`);
      }

      return hints.join(' ');
    }

    const parts = [baseMessage];
    if (response) parts.push(`SMTP response: ${response}`);
    if (typeof responseCode === 'number') parts.push(`responseCode=${responseCode}`);
    if (command) parts.push(`command=${command}`);
    if (settings.nodemailerHost) {
      parts.push(`host=${settings.nodemailerHost}`);
    }
    if (typeof port === 'number') {
      parts.push(`port=${port}`);
    }
    if (typeof secure === 'boolean') {
      parts.push(`secure=${secure}`);
    }
    return parts.join(' | ');
  }

  private async createNodemailerTransporter(settings: EmailSettings) {
    const nodemailer = await import('nodemailer');
    const normalized = this.normalizeEmailSettings(settings);

    if (!normalized.nodemailerHost || !normalized.nodemailerUser || !normalized.nodemailerPassword) {
      throw new Error('Nodemailer settings not configured');
    }

    const port = this.resolveSmtpPort(normalized);
    const secure = this.resolveSmtpSecure(normalized, port);

    const transporter = nodemailer.createTransport({
      host: normalized.nodemailerHost,
      port,
      secure,
      auth: {
        user: normalized.nodemailerUser,
        pass: normalized.nodemailerPassword,
      },
    });

    return { transporter, port, secure, host: normalized.nodemailerHost, settings: normalized };
  }

  /** Verify SMTP credentials (used before admin test send). */
  async verifySmtpConnection(): Promise<{
    ok: boolean;
    error?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
  }> {
    try {
      const settings = await this.getSettings();
      const { transporter, port, secure, host, settings: normalized } = await this.createNodemailerTransporter(settings);
      await transporter.verify();
      return {
        ok: true,
        host,
        port,
        secure,
        user: normalized.nodemailerUser,
      };
    } catch (error) {
      const settings = this.normalizeEmailSettings(await this.getSettings());
      const port = this.resolveSmtpPort(settings);
      const secure = this.resolveSmtpSecure(settings, port);
      const errorMessage = this.formatSmtpError(error, settings, port, secure);
      return { ok: false, error: errorMessage };
    }
  }

  private async sendViaNodemailer(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
    settings: EmailSettings
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { transporter, port, secure, host, settings: normalized } = await this.createNodemailerTransporter(settings);

      // Security check: if using Gmail SMTP, validate that From email matches SMTP user domain
      if (normalized.nodemailerHost?.includes('gmail.com') || normalized.nodemailerHost?.includes('googlemail.com')) {
        const smtpDomain = normalized.nodemailerUser?.split('@')[1]?.toLowerCase();
        const fromDomain = normalized.fromEmail.split('@')[1]?.toLowerCase();
        
        if (smtpDomain && fromDomain && smtpDomain !== fromDomain && !fromDomain.includes('gmail.com') && !fromDomain.includes('googlemail.com')) {
          console.warn(`⚠️ SECURITY WARNING: Using Gmail SMTP with different domain in From address (${normalized.fromEmail}). This may cause delivery issues and emails may be marked as spam. Consider using Gmail address in From or use a dedicated email service like Resend/Mailgun.`);
        }
      }

      const info = await transporter.sendMail({
        from: `"${normalized.fromName}" <${normalized.fromEmail}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html,
      });

      console.log(
        `[email] SMTP sent host=${host} port=${port} secure=${secure} from=${normalized.fromEmail} to=${to} messageId=${info.messageId ?? 'n/a'}`
      );

      return { success: true, messageId: info.messageId };
    } catch (error) {
      const normalized = this.normalizeEmailSettings(settings);
      const port = this.resolveSmtpPort(normalized);
      const secure = this.resolveSmtpSecure(normalized, port);
      const errorMessage = this.formatSmtpError(error, normalized, port, secure);
      console.error(`[email] SMTP failed to=${to}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private async sendViaSendGrid(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
    settings: EmailSettings
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!settings.sendgridApiKey) {
        return { success: false, error: 'SendGrid API key not configured' };
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to }],
              subject,
            },
          ],
          from: {
            email: settings.fromEmail,
            name: settings.fromName,
          },
          content: [
            {
              type: 'text/plain',
              value: text || html.replace(/<[^>]*>/g, ''),
            },
            {
              type: 'text/html',
              value: html,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `SendGrid API error: ${errorText}` };
      }

      const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`;
      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  private async sendViaAwsSes(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
    settings: EmailSettings
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!settings.awsSesRegion || !settings.awsSesAccessKeyId || !settings.awsSesSecretAccessKey) {
        return { success: false, error: 'AWS SES settings not configured' };
      }

      // Dynamic import to avoid requiring AWS SDK if not used
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');

      const sesClient = new SESClient({
        region: settings.awsSesRegion,
        credentials: {
          accessKeyId: settings.awsSesAccessKeyId,
          secretAccessKey: settings.awsSesSecretAccessKey,
        },
      });

      const command = new SendEmailCommand({
        Source: `"${settings.fromName}" <${settings.fromEmail}>`,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: text || html.replace(/<[^>]*>/g, ''),
              Charset: 'UTF-8',
            },
          },
        },
      });

      const response = await sesClient.send(command);
      return { success: true, messageId: response.MessageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  private async sendViaResend(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
    settings: EmailSettings
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!settings.resendApiKey) {
        return { success: false, error: 'Resend API key not configured' };
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${settings.fromName} <${settings.fromEmail}>`,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` })) as { message?: string };
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
      }

      const result = await response.json() as { id?: string };
      return { success: true, messageId: result.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  private async sendViaMailgun(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
    settings: EmailSettings
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!settings.mailgunApiKey || !settings.mailgunDomain) {
        return { success: false, error: 'Mailgun API key and domain are required' };
      }

      const region = settings.mailgunRegion === 'eu' ? 'eu' : 'us';
      const apiUrl = `https://api.${region === 'eu' ? 'eu' : 'api'}.mailgun.net/v3/${settings.mailgunDomain}/messages`;

      const formData = new URLSearchParams();
      formData.append('from', `${settings.fromName} <${settings.fromEmail}>`);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('html', html);
      if (text) {
        formData.append('text', text);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${settings.mailgunApiKey}`).toString('base64')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` })) as { message?: string };
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
      }

      const result = await response.json() as { id?: string };
      return { success: true, messageId: result.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  private async sendViaBrevo(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
    settings: EmailSettings
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!settings.brevoApiKey) {
        return { success: false, error: 'Brevo API key not configured' };
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': settings.brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: settings.fromName,
            email: settings.fromEmail,
          },
          to: [
            {
              email: to,
            },
          ],
          subject,
          htmlContent: html,
          textContent: text || html.replace(/<[^>]*>/g, ''),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` })) as { message?: string };
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
      }

      const result = await response.json() as { messageId?: string };
      return { success: true, messageId: result.messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  // Template methods — minimal card layout, logo from header / from-name
  private async getBaseTemplate(content: string, styles?: EmailStyles): Promise<string> {
    const emailStyles = styles || await this.getEmailStyles();
    const branding = await this.getEmailBranding(emailStyles);
    const year = new Date().getFullYear();
    const outerBg = '#f4f4f5';
    const cardBorder = '#e8e8e8';
    const divider = '#f0f0f0';
    const footerMuted = '#737373';
    const siteHref = this.escapeAttr(`${branding.siteUrl}/`);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>Email</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;background-color:${outerBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:${outerBg};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;background-color:${emailStyles.backgroundColor};border:1px solid ${cardBorder};">
          <tr>
            <td align="center" style="padding:22px 24px 18px;border-bottom:1px solid ${divider};">
              ${branding.logoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px 8px;color:${emailStyles.textColor};font-family:${emailStyles.fontFamily};font-size:${emailStyles.fontSize};line-height:1.55;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 22px;border-top:1px solid ${divider};text-align:center;font-family:${emailStyles.fontFamily};font-size:12px;line-height:1.5;color:${footerMuted};">
              <p style="margin:0 0 6px 0;">© ${year} ${branding.brandEscaped}</p>
              <p style="margin:0;">
                <a href="${siteHref}" style="color:${footerMuted};text-decoration:underline;">Visit our website</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private createButton(text: string, url: string, styles: EmailStyles): string {
    const href = this.escapeAttr(url);
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;border-collapse:collapse;">
        <tr>
          <td align="center">
            <a href="${href}" style="display:inline-block;padding:12px 28px;background-color:${styles.buttonColor};color:${styles.buttonTextColor};text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;font-family:${styles.fontFamily};">
              ${text}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  // Public methods
  async sendPasswordReset(userEmail: string, resetToken: string, userName?: string, preferredLanguage?: string): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const resetLink = `${frontendBaseUrl}/reset-password?token=${resetToken}`;
    const copy = getPasswordResetEmailCopy(preferredLanguage);

    // Try to use template from DB (locale = user's preferred language when provided)
    const template = await emailTemplateService.renderTemplate(
      'PASSWORD_RESET',
      {
        userName,
        resetToken,
        resetLink,
        passwordResetSubject: copy.subject,
        passwordResetTitle: copy.title,
        passwordResetGreetingPrefix: copy.greetingPrefix,
        passwordResetIntro: copy.intro,
        passwordResetButtonLabel: copy.buttonLabel,
        passwordResetExpiryNote: copy.expiryNote,
        passwordResetLinkFallbackPrefix: copy.linkFallbackPrefix,
        passwordResetTextIntro: copy.textIntro,
        passwordResetTextIgnoreNote: copy.textIgnoreNote,
        primaryColor: styles.primaryColor,
        secondaryColor: styles.secondaryColor,
        buttonColor: styles.buttonColor,
        buttonTextColor: styles.buttonTextColor,
      },
      preferredLanguage
    );

    if (template) {
      // Wrap template content in base template
      const html = await this.getBaseTemplate(template.html, styles);
      return this.sendEmail(userEmail, template.subject, html, template.text, 'PASSWORD_RESET');
    }

    // Fallback to default implementation
    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(copy.title)}</h2>
      <p>${this.escapeHtml(copy.greetingPrefix)}${userName ? ` ${this.escapeHtml(userName)}` : ''},</p>
      <p>${this.escapeHtml(copy.intro)}</p>
      ${this.createButton(copy.buttonLabel, resetLink, styles)}
      <p style="color: ${styles.secondaryColor}; font-size: 14px;">
        ${this.escapeHtml(copy.expiryNote)}
      </p>
      <p style="color: ${styles.secondaryColor}; font-size: 14px;">
        ${this.escapeHtml(copy.linkFallbackPrefix)}<br>
        <a href="${resetLink}" style="color: ${styles.primaryColor}; word-break: break-all;">${resetLink}</a>
      </p>
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${copy.title}\n\n${copy.greetingPrefix}${userName ? ` ${userName}` : ''},\n\n${copy.textIntro}\n${resetLink}\n\n${copy.textIgnoreNote}`;

    return this.sendEmail(userEmail, copy.subject, html, text, 'PASSWORD_RESET');
  }

  async sendEmailVerification(
    userEmail: string,
    verifyToken: string,
    userName?: string,
    preferredLanguage?: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const verifyLink = `${frontendBaseUrl}/verify-email?token=${verifyToken}`;
    const copy = getEmailVerificationEmailCopy(preferredLanguage);

    const template = await emailTemplateService.renderTemplate(
      'EMAIL_VERIFICATION',
      {
        userName,
        verifyLink,
        emailVerificationSubject: copy.subject,
        emailVerificationTitle: copy.title,
        emailVerificationGreetingPrefix: copy.greetingPrefix,
        emailVerificationIntro: copy.intro,
        emailVerificationButtonLabel: copy.buttonLabel,
        emailVerificationExpiryNote: copy.expiryNote,
        emailVerificationLinkFallbackPrefix: copy.linkFallbackPrefix,
        emailVerificationTextIntro: copy.textIntro,
        emailVerificationTextExpiryNote: copy.textExpiryNote,
        primaryColor: styles.primaryColor,
        secondaryColor: styles.secondaryColor,
        buttonColor: styles.buttonColor,
        buttonTextColor: styles.buttonTextColor,
      },
      preferredLanguage
    );

    if (template) {
      const html = await this.getBaseTemplate(template.html, styles);
      return this.sendEmail(
        userEmail,
        template.subject,
        html,
        template.text,
        'EMAIL_VERIFICATION',
        userId
      );
    }

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(copy.title)}</h2>
      <p>${this.escapeHtml(copy.greetingPrefix)}${userName ? ` ${this.escapeHtml(userName)}` : ''},</p>
      <p>${this.escapeHtml(copy.intro)}</p>
      ${this.createButton(copy.buttonLabel, verifyLink, styles)}
      <p style="color: ${styles.secondaryColor}; font-size: 14px;">
        ${this.escapeHtml(copy.expiryNote)}
      </p>
      <p style="color: ${styles.secondaryColor}; font-size: 14px;">
        ${this.escapeHtml(copy.linkFallbackPrefix)}<br>
        <a href="${verifyLink}" style="color: ${styles.primaryColor}; word-break: break-all;">${verifyLink}</a>
      </p>
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${copy.title}\n\n${copy.greetingPrefix}${userName ? ` ${userName}` : ''},\n\n${copy.textIntro}\n${verifyLink}\n\n${copy.textExpiryNote}`;

    return this.sendEmail(userEmail, copy.subject, html, text, 'EMAIL_VERIFICATION', userId);
  }

  async sendWelcomeEmail(userEmail: string, userName: string, preferredLanguage?: string): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const shopUrl = `${frontendBaseUrl}/shop`;
    const copy = getWelcomeEmailCopy(preferredLanguage);

    // Try to use template from DB (locale = user's preferred language when provided)
    const template = await emailTemplateService.renderTemplate(
      'WELCOME',
      {
        userName,
        shopUrl,
        welcomeSubject: copy.subject,
        welcomeTitle: copy.title,
        welcomeGreetingPrefix: copy.greetingPrefix,
        welcomeIntro: copy.intro,
        welcomeShopIntro: copy.shopIntro,
        welcomeButtonLabel: copy.buttonLabel,
        welcomeSupportNote: copy.supportNote,
        welcomeTextIntro: copy.textIntro,
        welcomeTextShopPrefix: copy.textShopPrefix,
        primaryColor: styles.primaryColor,
        buttonColor: styles.buttonColor,
        buttonTextColor: styles.buttonTextColor,
      },
      preferredLanguage
    );

    if (template) {
      const html = await this.getBaseTemplate(template.html, styles);
      return this.sendEmail(userEmail, template.subject, html, template.text, 'WELCOME');
    }

    // Fallback to default implementation
    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(copy.title)}</h2>
      <p>${this.escapeHtml(copy.greetingPrefix)} ${this.escapeHtml(userName)},</p>
      <p>${this.escapeHtml(copy.intro)}</p>
      <p>${this.escapeHtml(copy.shopIntro)}</p>
      ${this.createButton(copy.buttonLabel, shopUrl, styles)}
      <p>${this.escapeHtml(copy.supportNote)}</p>
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${copy.title}\n\n${copy.greetingPrefix} ${userName},\n\n${copy.textIntro}\n${copy.textShopPrefix}: ${shopUrl}`;

    return this.sendEmail(userEmail, copy.subject, html, text, 'WELCOME');
  }

  async sendOrderConfirmation(orderId: string, userEmail: string, orderNumber: string, orderDetails?: any, preferredLanguage?: string): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const orderUrl = `${frontendBaseUrl}/account/orders/${orderId}`;
    const orderCopy = getOrderConfirmationEmailCopy(preferredLanguage);
    const hasPriceOnRequestItems = !!orderDetails?.hasPriceOnRequestItems;

    // Prepare order items for template
    let orderItemsHtml = '';
    if (orderDetails?.items) {
      orderItemsHtml = `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;"><thead><tr style="background-color: #f5f5f5;"><th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">${this.escapeHtml(orderCopy.itemLabel)}</th><th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">${this.escapeHtml(orderCopy.priceLabel)}</th></tr></thead><tbody>`;
      orderDetails.items.forEach((item: any) => {
        const safeName = this.escapeHtml(String(item.name || ''));
        const safeSize = item.size ? this.escapeHtml(String(item.size)) : '';
        const priceLabel = item.isPriceOnRequest ? orderCopy.priceOnRequestLabel : `$${item.price}`;
        orderItemsHtml += `<tr><td style="padding: 10px; border-bottom: 1px solid #eee;">${safeName}${safeSize ? ` (${this.escapeHtml(orderCopy.sizeLabel)}: ${safeSize})` : ''} x ${item.quantity}</td><td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">${this.escapeHtml(priceLabel)}</td></tr>`;
      });
      orderItemsHtml += '</tbody></table>';
    }

    // Try to use template from DB (locale = user's preferred language when provided)
    const template = await emailTemplateService.renderTemplate(
      'ORDER_CONFIRMATION',
      {
        orderNumber,
        orderId,
        orderUrl,
        orderTotal: orderDetails?.total,
        orderItems: orderItemsHtml ? { items: orderDetails!.items } : undefined,
        orderConfirmationSubjectPrefix: orderCopy.subjectPrefix,
        orderConfirmationTitle: orderCopy.title,
        orderConfirmationThankYou: orderCopy.thankYou,
        orderNumberLabel: orderCopy.orderNumberLabel,
        itemLabel: orderCopy.itemLabel,
        priceLabel: orderCopy.priceLabel,
        sizeLabel: orderCopy.sizeLabel,
        totalLabel: orderCopy.totalLabel,
        orderShippedFollowUp: orderCopy.shippedFollowUp,
        viewOrderLabel: orderCopy.viewOrderLabel,
        priceOnRequestTotalsNote: hasPriceOnRequestItems ? orderCopy.priceOnRequestTotalsNote : '',
        textViewOrder: orderCopy.textViewOrder,
        primaryColor: styles.primaryColor,
        buttonColor: styles.buttonColor,
        buttonTextColor: styles.buttonTextColor,
      } as any,
      preferredLanguage
    );

    if (template) {
      // Replace orderItems placeholder if exists
      let htmlContent = template.html;
      if (orderItemsHtml) {
        htmlContent = htmlContent.replace('{{#orderItems}}', orderItemsHtml);
        htmlContent = htmlContent.replace('{{/orderItems}}', '');
      } else {
        htmlContent = htmlContent.replace(/\{\{#orderItems\}\}[\s\S]*?\{\{\/orderItems\}\}/g, '');
      }
      
      const html = await this.getBaseTemplate(htmlContent, styles);
      return this.sendEmail(userEmail, template.subject, html, template.text, 'ORDER_CONFIRMATION', undefined, orderId);
    }

    // Fallback to default implementation
    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(orderCopy.title)}</h2>
      <p>${this.escapeHtml(orderCopy.thankYou)}</p>
      <p><strong>${this.escapeHtml(orderCopy.orderNumberLabel)}:</strong> ${this.escapeHtml(orderNumber)}</p>
      ${orderItemsHtml}
      ${orderDetails?.total ? `<p style="font-size: 18px; font-weight: bold; margin-top: 20px;">${this.escapeHtml(orderCopy.totalLabel)}: $${orderDetails.total}</p>` : ''}
      ${hasPriceOnRequestItems ? `<p style="margin-top: 20px; color: ${this.escapeAttr(styles.secondaryColor)}; line-height: 1.6;">${this.escapeHtml(orderCopy.priceOnRequestTotalsNote)}</p>` : ''}
      <p>${this.escapeHtml(orderCopy.shippedFollowUp)}</p>
      ${this.createButton(orderCopy.viewOrderLabel, orderUrl, styles)}
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${orderCopy.title}\n\n${orderCopy.orderNumberLabel}: ${orderNumber}\n\n${orderCopy.textIntro}${hasPriceOnRequestItems ? `\n${orderCopy.priceOnRequestTotalsNote}` : ''}\n${orderCopy.textViewOrder}: ${orderUrl}`;

    return this.sendEmail(userEmail, `${orderCopy.subjectPrefix} - ${orderNumber}`, html, text, 'ORDER_CONFIRMATION', undefined, orderId);
  }

  async sendOrderShipped(
    orderId: string,
    userEmail: string,
    orderNumber: string,
    trackingNumber?: string,
    carrier?: string,
    preferredLanguage?: string
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const copy = getShippingEmailCopy(preferredLanguage);
    const orderUrl = `${frontendBaseUrl}/account/orders/${orderId}`;

    const trackingInfo = trackingNumber
      ? `<p><strong>${this.escapeHtml(copy.trackingNumberLabel)}:</strong> ${this.escapeHtml(trackingNumber)}${carrier ? ` (${this.escapeHtml(carrier)})` : ''}</p>`
      : '';

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(copy.title)}</h2>
      <p>${this.escapeHtml(copy.intro.replace('{{orderNumber}}', orderNumber))}</p>
      ${trackingInfo}
      <p>${this.escapeHtml(copy.trackOrderIntro)}</p>
      ${this.createButton(copy.buttonLabel, orderUrl, styles)}
      <p>${this.escapeHtml(copy.followUp)}</p>
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${copy.title}\n\n${copy.orderNumberLabel}: ${orderNumber}${trackingNumber ? `\n${copy.trackingPrefix}: ${trackingNumber}` : ''}\n\n${copy.textTrackPrefix}: ${orderUrl}`;

    return this.sendEmail(userEmail, `${copy.subjectPrefix} ${orderNumber}!`, html, text, 'SHIPPING', undefined, orderId);
  }

  async sendOrderDelivered(
    orderId: string,
    userEmail: string,
    orderNumber: string,
    preferredLanguage?: string
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const copy = getDeliveryEmailCopy(preferredLanguage);
    const orderUrl = `${frontendBaseUrl}/account/orders/${orderId}`;

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(copy.title)}</h2>
      <p>${this.escapeHtml(copy.intro.replace('{{orderNumber}}', orderNumber))}</p>
      <p>${this.escapeHtml(copy.supportNote)}</p>
      ${this.createButton(copy.buttonLabel, orderUrl, styles)}
      <p>${this.escapeHtml(copy.thanksNote)}</p>
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${copy.title}\n\n${copy.orderNumberLabel}: ${orderNumber}\n\n${copy.textViewOrderPrefix}: ${orderUrl}`;

    return this.sendEmail(userEmail, `${copy.subjectPrefix} ${orderNumber}!`, html, text, 'DELIVERY', undefined, orderId);
  }

  /**
   * Sending a notification about the delivery of the order through Yandex Delivery
   */
  async sendOrderDeliveredEmail(
    userEmail: string,
    data: {
      orderNumber: string;
      trackingUrl?: string;
      pickupPoint?: {
        name?: string;
        address?: string;
        workingHours?: string;
        phone?: string;
      };
    }
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();

    let pickupPointHtml = '';
    if (data.pickupPoint) {
      pickupPointHtml = `
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">Pickup point</h3>
          ${data.pickupPoint.name ? `<p><strong>Name:</strong> ${data.pickupPoint.name}</p>` : ''}
          ${data.pickupPoint.address ? `<p><strong>Address:</strong> ${data.pickupPoint.address}</p>` : ''}
          ${data.pickupPoint.workingHours ? `<p><strong>Working hours:</strong> ${data.pickupPoint.workingHours}</p>` : ''}
          ${data.pickupPoint.phone ? `<p><strong>Phone:</strong> ${data.pickupPoint.phone}</p>` : ''}
        </div>
      `;
    }

    const trackingInfo = data.trackingUrl
      ? `<p><strong>Tracking:</strong> <a href="${data.trackingUrl}" style="color: ${styles.primaryColor};">${data.trackingUrl}</a></p>`
      : '';

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">Your order has been delivered!</h2>
      <p>Great news! Your order ${data.orderNumber} has been delivered.</p>
      ${pickupPointHtml}
      ${trackingInfo}
      <p>We hope you are happy with your purchase. If you have any questions or comments, please contact us.</p>
      <p>Thank you for your purchase!</p>
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `Your order has been delivered!\n\nOrder №${data.orderNumber}\n\n${data.pickupPoint ? `Pickup point: ${data.pickupPoint.name || ''} ${data.pickupPoint.address || ''}` : ''}${data.trackingUrl ? `\nTracking: ${data.trackingUrl}` : ''}`;

    return this.sendEmail(userEmail, `Your order ${data.orderNumber} has been delivered!`, html, text, 'DELIVERY');
  }

  /**
   * Sending a notification to the user about the possibility of picking up the order from the pickup point
   */
  async sendPickupPointNotificationEmail(
    userEmail: string,
    data: {
      orderNumber: string;
      pickupPoint: {
        name: string;
        address: string;
        workingHours?: string;
        phone?: string;
      };
    }
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();

    const content = `
    <h2 style="color: ${styles.primaryColor}; margin-top: 0;">Your order is ready for pickup!</h2>
      <p>Great news! Your order ${data.orderNumber} is ready for pickup at the pickup point.</p>
      <div style="background-color: #f0f9ff; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #3b82f6;">
        <h3 style="color: #1e40af; margin-top: 0;">Information about the pickup point</h3>
        <p><strong>Name:</strong> ${data.pickupPoint.name}</p>
        <p><strong>Address:</strong> ${data.pickupPoint.address}</p>
        ${data.pickupPoint.workingHours ? `<p><strong>Working hours:</strong> ${data.pickupPoint.workingHours}</p>` : ''}
        ${data.pickupPoint.phone ? `<p><strong>Phone:</strong> ${data.pickupPoint.phone}</p>` : ''}
      </div>
      <p><strong>Instruction:</strong></p>
      <ol style="padding-left: 20px;">
        <li>Come to the pickup point by the specified address</li>
        <li>Present the order number: <strong>${data.orderNumber}</strong></li>
        <li>If necessary, present a document confirming your identity</li>
        <li>Get your order</li>
      </ol>
      <p>If you have any questions, please contact us.</p>
      ${this.createButton('View order', `${frontendBaseUrl}/account/orders`, styles)}
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `Your order is ready for pickup!\n\nOrder №${data.orderNumber}\n\nPickup point:\n${data.pickupPoint.name}\n${data.pickupPoint.address}${data.pickupPoint.workingHours ? `\nWorking hours: ${data.pickupPoint.workingHours}` : ''}${data.pickupPoint.phone ? `\nPhone: ${data.pickupPoint.phone}` : ''}\n\nCome to the pickup point and present the order number: ${data.orderNumber}`;

    return this.sendEmail(userEmail, `Your order ${data.orderNumber} is ready for pickup!`, html, text, 'PICKUP_POINT_NOTIFICATION');
  }

  async sendPaymentRequest(orderId: string, userEmail: string, orderNumber: string, bankDetails?: any, preferredLanguage?: string): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();
    const copy = getPaymentRequestEmailCopy(preferredLanguage);
    const orderUrl = `${frontendBaseUrl}/account/orders/${orderId}`;

    let bankDetailsHtml = '';
    if (bankDetails) {
      bankDetailsHtml = '<div style="background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin: 20px 0;">';
      if (bankDetails.accountNumber) bankDetailsHtml += `<p><strong>${this.escapeHtml(copy.accountNumberLabel)}:</strong> ${this.escapeHtml(String(bankDetails.accountNumber))}</p>`;
      if (bankDetails.bankName) bankDetailsHtml += `<p><strong>${this.escapeHtml(copy.bankLabel)}:</strong> ${this.escapeHtml(String(bankDetails.bankName))}</p>`;
      if (bankDetails.swift) bankDetailsHtml += `<p><strong>${this.escapeHtml(copy.swiftLabel)}:</strong> ${this.escapeHtml(String(bankDetails.swift))}</p>`;
      bankDetailsHtml += '</div>';
    }

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${this.escapeHtml(copy.title)}</h2>
      <p>${this.escapeHtml(copy.intro.replace('{{orderNumber}}', orderNumber))}</p>
      <p>${this.escapeHtml(copy.paymentInstructions)}</p>
      ${bankDetailsHtml}
      <p>${this.escapeHtml(copy.receiptNote)}</p>
      ${this.createButton(copy.buttonLabel, orderUrl, styles)}
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `${copy.title}\n\n${copy.orderNumberLabel}: ${orderNumber}\n\n${copy.textIntro} ${copy.textViewOrderPrefix}: ${orderUrl}`;

    return this.sendEmail(userEmail, `${copy.subjectPrefix} ${orderNumber}`, html, text, 'PAYMENT_REQUEST', undefined, orderId);
  }

  async sendPaymentConfirmed(orderId: string, userEmail: string, orderNumber: string): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">Payment Confirmed</h2>
      <p>Great news! We've received your payment for order ${orderNumber}.</p>
      <p>We're now processing your order and will notify you when it ships.</p>
      ${this.createButton('View Order', `${frontendBaseUrl}/account/orders/${orderId}`, styles)}
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `Payment Confirmed\n\nOrder Number: ${orderNumber}\n\nWe've received your payment. View order: ${frontendBaseUrl}/account/orders/${orderId}`;

    return this.sendEmail(userEmail, `Payment Confirmed - Order ${orderNumber}`, html, text, 'PAYMENT_CONFIRMED', undefined, orderId);
  }

  async sendPromotionalEmail(
    to: string,
    subject: string,
    content: string,
    ctaText?: string,
    ctaUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const ctaButton = ctaText && ctaUrl ? this.createButton(ctaText, ctaUrl, styles) : '';

    const emailContent = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">${subject}</h2>
      ${content}
      ${ctaButton}
    `;

    const html = await this.getBaseTemplate(emailContent, styles);
    const text = `${subject}\n\n${content.replace(/<[^>]*>/g, '')}${ctaUrl ? `\n\n${ctaText}: ${ctaUrl}` : ''}`;

    return this.sendEmail(to, subject, html, text, 'PROMOTIONAL');
  }

  async sendReturnRequestNotification(
    returnRequestId: string,
    userEmail: string,
    orderNumber: string,
    status: string,
    details: {
      pickupMethod?: string;
      pickupAddress?: string;
      pickupDate?: string;
      pickupNotes?: string;
      refundMethod?: string;
      refundAmount?: number;
      adminNotes?: string;
      items?: Array<{
        productName: string;
        quantity: number;
        replacementProductId?: string;
        replacementVariantId?: string;
      }>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const styles = await this.getEmailStyles();
    const frontendBaseUrl = await resolveFrontendBaseUrl();

    const statusLabels: Record<string, string> = {
      'APPROVED': 'Approved',
      'REJECTED': 'Rejected',
      'PROCESSING': 'In processing',
      'COMPLETED': 'Completed',
    };

    const pickupMethodLabels: Record<string, string> = {
      'COURIER': 'Courier will pick up the product',
      'POST': 'Postage',
      'PICKUP': 'Self pickup',
    };

    const refundMethodLabels: Record<string, string> = {
      'STRIPE': 'Stripe (automatic refund)',
      'BANK_TRANSFER': 'Bank transfer',
      'MANUAL': 'Manual refund',
    };

    let pickupInfoHtml = '';
    if (details.pickupMethod) {
      pickupInfoHtml = '<div style="background-color: #f0f9ff; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #3b82f6;">';
      pickupInfoHtml += `<h3 style="color: #1e40af; margin-top: 0;">Information about the return of the product</h3>`;
      pickupInfoHtml += `<p><strong>Return method:</strong> ${pickupMethodLabels[details.pickupMethod] || details.pickupMethod}</p>`;
      if (details.pickupAddress) {
        pickupInfoHtml += `<p><strong>Return address:</strong> ${details.pickupAddress}</p>`;
      }
      if (details.pickupDate) {
        const pickupDate = new Date(details.pickupDate).toLocaleString('ru-RU');
        pickupInfoHtml += `<p><strong>Return date:</strong> ${pickupDate}</p>`;
      }
      if (details.pickupNotes) {
        pickupInfoHtml += `<p><strong>Instructions:</strong> ${details.pickupNotes}</p>`;
      }
      pickupInfoHtml += '</div>';
    }

    let refundInfoHtml = '';
    if (details.refundMethod && details.refundAmount) {
      refundInfoHtml = '<div style="background-color: #f0fdf4; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #22c55e;">';
      refundInfoHtml += `<h3 style="color: #15803d; margin-top: 0;">Information about the refund of the payment</h3>`;
      refundInfoHtml += `<p><strong>Refund method:</strong> ${refundMethodLabels[details.refundMethod] || details.refundMethod}</p>`;
      refundInfoHtml += `<p><strong>Refund amount:</strong> $${details.refundAmount.toFixed(2)}</p>`;
      refundInfoHtml += '</div>';
    }

    let replacementInfoHtml = '';
    if (details.items && details.items.some(item => item.replacementProductId)) {
      replacementInfoHtml = '<div style="background-color: #fef3c7; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #f59e0b;">';
      replacementInfoHtml += `<h3 style="color: #92400e; margin-top: 0;">Products for replacement</h3>`;
      replacementInfoHtml += '<ul>';
      details.items.forEach(item => {
        if (item.replacementProductId) {
          replacementInfoHtml += `<li>${item.productName} (quantity: ${item.quantity}) - will be replaced with another product</li>`;
        }
      });
      replacementInfoHtml += '</ul>';
      replacementInfoHtml += '</div>';
    }

    let adminNotesHtml = '';
    if (details.adminNotes) {
      adminNotesHtml = `<div style="background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 20px 0;"><p><strong>Admin notes:</strong> ${details.adminNotes}</p></div>`;
    }

    const content = `
      <h2 style="color: ${styles.primaryColor}; margin-top: 0;">Update of the return status</h2>
      <p>Your return request for order <strong>${orderNumber}</strong> has been processed.</p>
      <p><strong>Status:</strong> ${statusLabels[status] || status}</p>
      ${pickupInfoHtml}
      ${refundInfoHtml}
      ${replacementInfoHtml}
      ${adminNotesHtml}
      <p>You can view the return details in your account.</p>
      ${this.createButton('View return', `${frontendBaseUrl}/account/orders/${orderNumber}`, styles)}
    `;

    const html = await this.getBaseTemplate(content, styles);
    const text = `Update of the return status\n\nOrder: ${orderNumber}\nStatus: ${statusLabels[status] || status}\n\nView: ${frontendBaseUrl}/account/orders/${orderNumber}`;

    return this.sendEmail(userEmail, `The return status has been updated - Order ${orderNumber}`, html, text, 'RETURN_NOTIFICATION', undefined, returnRequestId);
  }
}

export const emailService = new EmailService();
