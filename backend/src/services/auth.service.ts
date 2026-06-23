import crypto from 'crypto';
import { verifySync } from 'otplib';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/hash';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTwoFactorPendingToken,
  TokenPayload,
  verifyTwoFactorPendingToken,
} from '../utils/jwt';
import { decryptTfaSecret } from '../utils/two-factor-crypto';
import { RegisterDto, LoginDto, AuthResponse } from '../types/auth';
import { UserRole } from '@prisma/client';
import { promoService } from './promo.service';
import { settingsService } from './settings.service';
import { captchaService } from './captcha.service';
import { verifyGuestCheckoutPaymentToken } from '../utils/guest-checkout-token';
import { adminActivityService } from './admin-activity.service';
import { config } from '../config/env';

export class AuthService {
  private isAdminRole(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }

  private async logAdminAuthActivity(params: {
    userId: string;
    role: UserRole;
    action: string;
    ipAddress?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.isAdminRole(params.role)) return;
    await adminActivityService.logActivity({
      adminId: params.userId,
      action: params.action,
      entityType: 'AUTH',
      entityId: params.userId,
      ipAddress: params.ipAddress,
      details: params.details,
    });
  }

  /**
   * Validate password according to security settings
   */
  private validatePassword(password: string, settings: any): void {
    if (password.length < settings.passwordMinLength) {
      throw new Error(`Password must be at least ${settings.passwordMinLength} characters long`);
    }

    if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (settings.passwordRequireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (settings.passwordRequireNumbers && !/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (settings.passwordRequireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Check if account is locked due to failed login attempts
   */
  private async checkAccountLockout(userId: string, settings: any): Promise<void> {
    if (!settings.accountLockoutEnabled) {
      return;
    }

    const lockoutWindow = new Date(Date.now() - (settings.accountLockoutDurationMinutes || 30) * 60 * 1000);
    const maxAttempts = settings.accountLockoutAttempts || 5;

    const recentFailures = await prisma.failedLoginAttempt.count({
      where: {
        userId,
        createdAt: { gte: lockoutWindow },
      },
    });

    if (recentFailures >= maxAttempts) {
      const duration = settings.accountLockoutDurationMinutes || 30;
      throw new Error(`Account temporarily locked due to too many failed login attempts. Try again in ${duration} minutes.`);
    }
  }

  /**
   * Record a failed login attempt for lockout tracking
   */
  private async recordFailedLoginAttempt(userId: string, remoteip?: string): Promise<void> {
    await prisma.failedLoginAttempt.create({
      data: {
        userId,
        ipAddress: remoteip || null,
      },
    });
  }

  private buildAuthUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    isPartner: boolean | null;
    partnerStatus: string | null;
    emailVerified: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      role: user.role,
      isPartner: user.isPartner || false,
      partnerStatus: user.partnerStatus || null,
      emailVerified: user.emailVerified,
    };
  }

  private async createSessionForUser(
    userId: string,
    email: string,
    role: UserRole
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenPayload: TokenPayload = { userId, email, role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    await prisma.session.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const maxSessions = Math.max(config.auth.maxActiveSessionsPerUser, 1);
    const staleSessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: maxSessions,
      select: { id: true },
    });
    if (staleSessions.length > 0) {
      await prisma.session.deleteMany({
        where: {
          id: { in: staleSessions.map((session) => session.id) },
        },
      });
    }

    return { accessToken, refreshToken };
  }

  /** Replace prior tokens and send verification email (password registration). */
  private async issueEmailVerificationToken(
    userId: string,
    email: string,
    firstName: string | null,
    preferredLanguage?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.emailVerificationToken.create({
      data: { userId, token, expiresAt },
    });
    try {
      const { emailService } = await import('./email.service');
      const userName = firstName || email.split('@')[0];
      return await emailService.sendEmailVerification(
        email,
        token,
        userName,
        preferredLanguage ?? undefined,
        userId
      );
    } catch (err) {
      console.error('[auth] sendEmailVerification failed:', err);
      await prisma.emailVerificationToken.deleteMany({ where: { userId, token } });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to send verification email',
      };
    }
  }

  async register(data: RegisterDto, remoteip?: string): Promise<AuthResponse> {
    // Check if registration is enabled
    const settings = await settingsService.getAllSettings();
    if (!settings.registrationEnabled) {
      throw new Error('Registration is currently disabled. Please contact administrator.');
    }

    // Verify CAPTCHA if required
    try {
      if (await captchaService.isRequiredForRegistration()) {
        if (!data.captchaToken) {
          throw new Error('CAPTCHA verification is required for registration');
        }
        
        const captchaResult = await captchaService.verifyCaptcha(data.captchaToken, remoteip);
        if (!captchaResult.success) {
          throw new Error(`CAPTCHA verification failed: ${captchaResult.error || 'Invalid CAPTCHA'}`);
        }
      }
    } catch (error) {
      // If CAPTCHA check fails due to settings error, log but don't block registration
      if (error instanceof Error && error.message.includes('CAPTCHA verification')) {
        throw error; // Re-throw CAPTCHA verification errors
      }
      console.error('Error checking CAPTCHA requirement:', error);
      // Continue without CAPTCHA if settings can't be loaded
    }

    // Validate password according to settings
    this.validatePassword(data.password, settings);

    const emailNorm = data.email.trim().toLowerCase();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    // Check promo code if provided
    if (data.promoCode) {
      const promoCode = await promoService.getByCode(data.promoCode);
      if (!promoCode) {
        throw new Error('Invalid or expired promo code. Registration requires a valid promo code.');
      }
    } else {
      // Check if there are any active promo codes in the system
      const activePromoCodes = await promoService.getAll(true);
      if (activePromoCodes.length > 0) {
        throw new Error('Registration requires a valid promo code.');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    let user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: UserRole;
      isPartner: boolean | null;
      partnerStatus: string | null;
      emailVerified: boolean;
      preferredLanguage: string | null;
      phone: string | null;
    };

    if (existingUser) {
      // Existing full account: keep generic response to prevent email enumeration.
      if (existingUser.passwordHash) {
        throw new Error('Registration failed. Please check your information and try again.');
      }

      // Existing passwordless account from guest checkout: complete registration and keep linked orders.
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          firstName: data.firstName ?? existingUser.firstName,
          lastName: data.lastName ?? existingUser.lastName,
          phone: data.phone ?? existingUser.phone,
        },
      });
    } else {
      // Fresh account
      user = await prisma.user.create({
        data: {
          email: emailNorm,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: UserRole.CUSTOMER,
        },
      });
    }

    const verificationSend = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      user.firstName,
      user.preferredLanguage
    );

    if (settings.emailVerificationRequired) {
      if (!verificationSend.success) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        if (!existingUser) {
          await prisma.user.delete({ where: { id: user.id } });
        }
        throw new Error(
          verificationSend.error ||
            'Could not send verification email. Check email settings and try again.'
        );
      }
      return {
        user: this.buildAuthUser(user),
        requiresEmailVerification: true,
      };
    }

    if (!verificationSend.success) {
      console.error(
        '[auth] Registration verification email failed (non-blocking):',
        verificationSend.error
      );
    }

    const { accessToken, refreshToken } = await this.createSessionForUser(
      user.id,
      user.email,
      user.role
    );

    try {
      const { emailService } = await import('./email.service');
      const userName = user.firstName || user.email.split('@')[0];
      await emailService.sendWelcomeEmail(user.email, userName, user.preferredLanguage ?? undefined).catch((error) => {
        console.error('Failed to send welcome email:', error);
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    return {
      user: this.buildAuthUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginDto, remoteip?: string): Promise<AuthResponse> {
    // Check if login is enabled
    const settings = await settingsService.getAllSettings();
    if (!settings.loginEnabled) {
      throw new Error('Login is currently disabled. Please contact administrator.');
    }

    const isSecondFactorStep = !!(data.twoFactorToken && data.twoFactorCode);

    // Verify CAPTCHA on the first step only (password); not again after TOTP
    if (!isSecondFactorStep) {
      try {
        if (await captchaService.isRequiredForLogin()) {
          if (!data.captchaToken) {
            throw new Error('CAPTCHA verification is required for login');
          }

          const captchaResult = await captchaService.verifyCaptcha(data.captchaToken, remoteip);
          if (!captchaResult.success) {
            throw new Error(`CAPTCHA verification failed: ${captchaResult.error || 'Invalid CAPTCHA'}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('CAPTCHA verification')) {
          throw error;
        }
        console.error('Error checking CAPTCHA requirement:', error);
      }
    }

    const emailNorm = data.email.trim().toLowerCase();
    console.log('🔍 AuthService.login: Searching for user with email:', emailNorm);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    // Always use the same error message to prevent email enumeration (timing attack protection)
    const genericError = 'Invalid email or password';

    if (!user) {
      console.error('❌ AuthService.login: User not found for email:', data.email);
      // Use a constant-time comparison to prevent timing attacks
      await comparePassword(data.password, '$2b$10$dummyhashfordummycomparison');
      throw new Error(genericError);
    }

    console.log('✅ AuthService.login: User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });

    // Check if account is active
    if (!user.isActive) {
      console.error('❌ AuthService.login: Account is deactivated for:', data.email);
      throw new Error('Account is deactivated. Please contact administrator.');
    }

    if (
      config.nodeEnv === 'production' &&
      config.auth.requireAdminTwoFactorInProduction &&
      this.isAdminRole(user.role) &&
      (!user.twoFactorEnabled || !user.twoFactorSecret)
    ) {
      await this.logAdminAuthActivity({
        userId: user.id,
        role: user.role,
        action: 'LOGIN_BLOCKED_ADMIN_2FA_REQUIRED',
        ipAddress: remoteip,
      });
      throw new Error('Administrator login requires two-factor authentication in production');
    }

    // Check account lockout
    await this.checkAccountLockout(user.id, settings);

    // Verify password (skip if user has no password hash - OAuth only user)
    if (!user.passwordHash) {
      console.error('❌ AuthService.login: User has no password (OAuth only)');
      throw new Error(genericError);
    }

    console.log('🔍 AuthService.login: Verifying password...');
    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      console.error('❌ AuthService.login: Invalid password for:', data.email);
      await this.recordFailedLoginAttempt(user.id, remoteip);
      await this.logAdminAuthActivity({
        userId: user.id,
        role: user.role,
        action: 'LOGIN_FAILED',
        ipAddress: remoteip,
      });
      throw new Error(genericError);
    }
    
    console.log('✅ AuthService.login: Password verified successfully');

    if (settings.emailVerificationRequired && !user.emailVerified) {
      throw new Error('Please verify your email before signing in.');
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      let decryptedSecret: string;
      try {
        decryptedSecret = decryptTfaSecret(user.twoFactorSecret);
      } catch {
        throw new Error(genericError);
      }

      if (data.twoFactorToken && data.twoFactorCode) {
        let pendingUserId: string;
        try {
          ({ userId: pendingUserId } = verifyTwoFactorPendingToken(data.twoFactorToken));
        } catch {
          throw new Error('Invalid or expired two-factor login token');
        }
        if (pendingUserId !== user.id) {
          throw new Error(genericError);
        }
        const normalized = data.twoFactorCode.replace(/\s+/g, '');
        const { valid } = verifySync({ secret: decryptedSecret, token: normalized });
        if (!valid) {
          await this.recordFailedLoginAttempt(user.id, remoteip);
          await this.logAdminAuthActivity({
            userId: user.id,
            role: user.role,
            action: 'LOGIN_FAILED_2FA',
            ipAddress: remoteip,
          });
          throw new Error('Invalid authentication code');
        }
      } else {
        await this.logAdminAuthActivity({
          userId: user.id,
          role: user.role,
          action: 'LOGIN_2FA_CHALLENGE_ISSUED',
          ipAddress: remoteip,
        });
        return {
          user: this.buildAuthUser(user),
          requiresTwoFactor: true,
          twoFactorToken: generateTwoFactorPendingToken(user.id),
        };
      }
    }

    await prisma.failedLoginAttempt.deleteMany({ where: { userId: user.id } });

    const { accessToken, refreshToken } = await this.createSessionForUser(
      user.id,
      user.email,
      user.role
    );

    await this.logAdminAuthActivity({
      userId: user.id,
      role: user.role,
      action: 'LOGIN_SUCCESS',
      ipAddress: remoteip,
    });

    return {
      user: this.buildAuthUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify refresh token
    const { verifyRefreshToken } = await import('../utils/jwt');
    const payload = verifyRefreshToken(refreshToken);

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { token: refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    if (!Object.values(UserRole).includes(payload.role as UserRole)) {
      throw new Error('Invalid refresh token role');
    }

    await prisma.session.delete({ where: { id: session.id } });
    return this.createSessionForUser(payload.userId, payload.email, payload.role as UserRole);
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token: refreshToken },
    });
  }

  async authenticateGuestCheckout(orderId: string, token: string): Promise<AuthResponse> {
    const normalizedOrderId = orderId.trim();
    const normalizedToken = token.trim();

    if (!normalizedOrderId || !normalizedToken) {
      throw new Error('orderId and token are required');
    }

    const payload = verifyGuestCheckoutPaymentToken(normalizedToken);
    if (!payload || payload.orderId !== normalizedOrderId) {
      throw new Error('Invalid or expired token');
    }

    const order = await prisma.order.findFirst({
      where: {
        id: normalizedOrderId,
        user: { email: payload.email },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isPartner: true,
            partnerStatus: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!order?.user) {
      throw new Error('Order not found');
    }

    const { accessToken, refreshToken } = await this.createSessionForUser(
      order.user.id,
      order.user.email,
      order.user.role
    );

    return {
      user: this.buildAuthUser(order.user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Request password reset. Sends email with reset link if user exists and has password.
   * Always returns success to prevent email enumeration.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      return { message: 'If an account exists with this email, you will receive a password reset link.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    try {
      const { emailService } = await import('./email.service');
      const userName = user.firstName || user.email.split('@')[0];
      await emailService.sendPasswordReset(user.email, token, userName, user.preferredLanguage ?? undefined);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      await prisma.passwordResetToken.deleteMany({ where: { token } });
      throw new Error('Failed to send password reset email. Please try again later.');
    }

    return { message: 'If an account exists with this email, you will receive a password reset link.' };
  }

  /**
   * Reset password using token from email link.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset link. Please request a new password reset.');
    }

    const settings = await settingsService.getAllSettings();
    this.validatePassword(newPassword, settings);

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({
        where: { userId: resetRecord.userId },
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetRecord.id },
      }),
    ]);

    return { message: 'Password has been reset successfully. You can now sign in.' };
  }

  async verifyEmail(token: string): Promise<AuthResponse & { message: string }> {
    const row = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!row || row.expiresAt < new Date()) {
      throw new Error(
        'Invalid or expired verification link. Please request a new verification email.'
      );
    }

    const { user } = row;
    if (user.emailVerified) {
      await prisma.emailVerificationToken.delete({ where: { id: row.id } }).catch(() => undefined);
      throw new Error('This email address is already verified.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      prisma.emailVerificationToken.delete({ where: { id: row.id } }),
    ]);

    const updated = { ...user, emailVerified: true };
    const { accessToken, refreshToken } = await this.createSessionForUser(
      user.id,
      user.email,
      user.role
    );

    return {
      message: 'Your email has been verified.',
      user: this.buildAuthUser(updated),
      accessToken,
      refreshToken,
    };
  }

  async resendVerificationForUser(userId: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (user.emailVerified) {
      throw new Error('Email is already verified.');
    }
    const sendResult = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      user.firstName,
      user.preferredLanguage
    );
    if (!sendResult.success) {
      throw new Error(
        sendResult.error || 'Failed to send verification email. Please try again later.'
      );
    }
    return { message: 'Verification email sent.' };
  }

  /**
   * Same response whether or not a matching unverified account exists (anti-enumeration).
   */
  async resendVerificationByEmail(email: string): Promise<{ message: string }> {
    const norm = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: norm } });
    const generic =
      'If an account exists and needs verification, you will receive an email shortly.';

    if (!user || user.emailVerified) {
      return { message: generic };
    }

    const sendResult = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      user.firstName,
      user.preferredLanguage
    );
    if (!sendResult.success) {
      console.error('[auth] resend verification by email failed:', sendResult.error);
    }
    return { message: generic };
  }
}

export const authService = new AuthService();
