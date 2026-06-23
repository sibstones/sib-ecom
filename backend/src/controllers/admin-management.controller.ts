import { Response } from 'express';
import { adminManagementService } from '../services/admin-management.service';
import { adminActivityService } from '../services/admin-activity.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { CreateAdminDto, UpdateAdminDto, ChangePasswordDto } from '../types/admin';
import { hashPassword, comparePassword } from '../utils/hash';

export class AdminManagementController {
  /**
   * Create new admin/moderator
   * Only super admin can create admins
   */
  async createAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: CreateAdminDto = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'];

      const result = await adminManagementService.createAdmin(
        data,
        req.user.userId,
        ipAddress,
        userAgent
      );

      res.status(201).json({
        admin: result.admin,
        generatedPassword: result.generatedPassword,
        message: 'Admin created successfully. Please save the generated password.',
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create admin',
      });
    }
  }

  /**
   * Get all admins/moderators
   */
  async getAllAdmins(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await adminManagementService.getAllAdmins(page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get admins',
      });
    }
  }

  /**
   * Get admin by ID
   */
  async getAdminById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { adminId } = req.params;
      const admin = await adminManagementService.getAdminById(adminId);

      if (!admin) {
        res.status(404).json({ error: 'Admin not found' });
        return;
      }

      res.json({ admin });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get admin',
      });
    }
  }

  /**
   * Update admin
   */
  async updateAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { adminId } = req.params;
      const data: UpdateAdminDto = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'];

      const admin = await adminManagementService.updateAdmin(
        adminId,
        data,
        req.user.userId,
        ipAddress,
        userAgent
      );

      res.json({ admin });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update admin',
      });
    }
  }

  /**
   * Deactivate admin
   */
  async deactivateAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { adminId } = req.params;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'];

      await adminManagementService.deactivateAdmin(
        adminId,
        req.user.userId,
        ipAddress,
        userAgent
      );

      res.json({ message: 'Admin deactivated successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to deactivate admin',
      });
    }
  }

  /**
   * Activate admin
   */
  async activateAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { adminId } = req.params;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'];

      await adminManagementService.activateAdmin(
        adminId,
        req.user.userId,
        ipAddress,
        userAgent
      );

      res.json({ message: 'Admin activated successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to activate admin',
      });
    }
  }

  /**
   * Get activity logs for a specific admin
   */
  async getAdminActivityLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { adminId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await adminActivityService.getAdminActivityLogs(adminId, page, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get activity logs',
      });
    }
  }

  /**
   * Get all activity logs (super admin only)
   */
  async getAllActivityLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filters: {
        adminId?: string;
        action?: string;
        entityType?: string;
      } = {};

      if (req.query.adminId) filters.adminId = req.query.adminId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.entityType) filters.entityType = req.query.entityType as string;

      const result = await adminActivityService.getAllActivityLogs(page, limit, filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get activity logs',
      });
    }
  }

  /**
   * Change password (for admin's own account)
   */
  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data: ChangePasswordDto = req.body;
      const prisma = (await import('../config/database')).default;

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
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
        where: { id: req.user.userId },
        data: { passwordHash },
      });

      // Log activity
      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'];
      await adminActivityService.logActivity({
        adminId: req.user.userId,
        action: 'CHANGE_PASSWORD',
        entityType: 'USER',
        entityId: req.user.userId,
        ipAddress,
        userAgent,
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to change password',
      });
    }
  }
}

export const adminManagementController = new AdminManagementController();
