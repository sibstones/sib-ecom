import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { RegisterDto, LoginDto } from '../types/auth';
import { ChangePasswordDto } from '../types/admin';
import { AuthRequest } from '../middleware/auth.middleware';
import { hashPassword, comparePassword } from '../utils/hash';
import { adminActivityService } from '../services/admin-activity.service';
import { clearAuthCookies, getRefreshTokenFromRequest, setAuthCookies } from '../utils/auth-cookies';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const data: RegisterDto = req.body;
      const remoteip = req.ip;
      const result = await authService.register(data, remoteip);
      if (result.accessToken && result.refreshToken) {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      }
      res.status(201).json({
        user: result.user,
        requiresEmailVerification: result.requiresEmailVerification === true,
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔐 Login attempt:', {
        email: req.body?.email,
        hasPassword: !!req.body?.password,
        bodyKeys: Object.keys(req.body || {}),
      });
      
      const data: LoginDto = req.body;
      
      if (!data.email || !data.password) {
        console.error('❌ Missing email or password in request body');
        res.status(400).json({
          error: 'Email and password are required',
        });
        return;
      }
      
      const remoteip = req.ip;
      const result = await authService.login(data, remoteip);
      console.log('✅ Login successful for:', data.email);
      if (result.requiresTwoFactor && result.twoFactorToken) {
        res.json({
          requiresTwoFactor: true,
          twoFactorToken: result.twoFactorToken,
          user: result.user,
        });
        return;
      }
      if (result.accessToken && result.refreshToken) {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      }
      res.json({ user: result.user });
    } catch (error) {
      console.error('❌ Login error:', error instanceof Error ? error.message : 'Unknown error');
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        res.status(401).json({ error: 'Refresh token missing' });
        return;
      }
      const result = await authService.refreshToken(refreshToken);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res.json(result);
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      clearAuthCookies(res);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Logout failed',
      });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      
      if (!authReq.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const prisma = (await import('../config/database')).default;
      const user = await prisma.user.findUnique({
        where: { id: authReq.user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          isPartner: true,
          partnerStatus: true,
          passwordHash: true,
          twoFactorEnabled: true,
          twoFactorPendingSecret: true,
          adminPermissions: {
            select: {
              canManageSupport: true,
              canManageOrders: true,
              canManageInventory: true,
              canManagePayments: true,
              canManageProducts: true,
              canManageCategories: true,
              canManageBrands: true,
              canManageCustomers: true,
              canManagePromoCodes: true,
              canManageContent: true,
              canManageSettings: true,
              canViewReports: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // For SUPER_ADMIN, return all permissions as true
      const permissions = user.role === 'SUPER_ADMIN' 
        ? {
            canManageSupport: true,
            canManageOrders: true,
            canManageInventory: true,
            canManagePayments: true,
            canManageProducts: true,
            canManageCategories: true,
            canManageBrands: true,
            canManageCustomers: true,
            canManagePromoCodes: true,
            canManageContent: true,
            canManageSettings: true,
            canViewReports: true,
          }
        : user.adminPermissions || null;

      const { passwordHash: _ph, twoFactorPendingSecret: _pending, ...rest } = user;
      res.json({
        user: {
          ...rest,
          passwordLoginAvailable: !!_ph,
          twoFactorSetupPending: !!_pending,
          permissions,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get user',
      });
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: ChangePasswordDto = req.body;
      const prisma = (await import('../config/database')).default;

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: authReq.user.userId },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check if user has a password (OAuth-only users don't have passwordHash)
      if (!user.passwordHash) {
        res.status(400).json({ error: 'This account does not have a password. Please use OAuth login or set a password first.' });
        return;
      }

      // Verify current password
      const isValid = await comparePassword(data.currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      // Hash new password
      const passwordHash = await hashPassword(data.newPassword);

      // Update password
      await prisma.user.update({
        where: { id: authReq.user.userId },
        data: { passwordHash },
      });

      await prisma.session.deleteMany({
        where: { userId: authReq.user.userId },
      });
      clearAuthCookies(res);

      // Log activity (only for admins)
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
        const userAgent = req.headers['user-agent'];
        await adminActivityService.logActivity({
          adminId: authReq.user.userId,
          action: 'CHANGE_PASSWORD',
          entityType: 'USER',
          entityId: authReq.user.userId,
          ipAddress,
          userAgent,
        });
      }

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to change password',
      });
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as { email: string };
      if (!email || typeof email !== 'string' || !email.trim()) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      const result = await authService.forgotPassword(email.trim());
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to send password reset email',
      });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      if (!token || !newPassword) {
        res.status(400).json({ error: 'Token and new password are required' });
        return;
      }
      const result = await authService.resetPassword(token, newPassword);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid or expired reset link',
      });
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body as { token: string };
      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'Token is required' });
        return;
      }
      const result = await authService.verifyEmail(token.trim());
      if (result.accessToken && result.refreshToken) {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      }
      res.json({ message: result.message, user: result.user });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Email verification failed',
      });
    }
  }

  async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const raw = (req.body as { email?: string })?.email;
      const email =
        typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : '';

      if (authReq.user) {
        const result = await authService.resendVerificationForUser(authReq.user.userId);
        res.json(result);
        return;
      }
      if (!email) {
        res.status(400).json({ error: 'Provide an email or sign in to resend verification.' });
        return;
      }
      const result = await authService.resendVerificationByEmail(email);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to resend verification email',
      });
    }
  }
}

export const authController = new AuthController();
