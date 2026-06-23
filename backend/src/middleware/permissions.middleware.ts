import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';

export type Permission =
  | 'canManageSupport'
  | 'canManageOrders'
  | 'canManageInventory'
  | 'canManagePayments'
  | 'canManageProducts'
  | 'canManageCategories'
  | 'canManageBrands'
  | 'canManageCustomers'
  | 'canManagePromoCodes'
  | 'canManageContent'
  | 'canManageSettings'
  | 'canViewReports';

/**
 * Middleware to check if user has required permission
 * Super admins always have all permissions
 */
export const requirePermission = (...permissions: Permission[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Super admin always has all permissions
    if (req.user.role === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    // Check if user is active
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { adminPermissions: true },
    });

    if (!user || !user.isActive) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }

    // Check if user has admin permissions
    if (!user.adminPermissions) {
      res.status(403).json({ error: 'No permissions configured' });
      return;
    }

    // Check if user has at least one of the required permissions
    const hasPermission = permissions.some(
      (permission) => user.adminPermissions?.[permission] === true
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user is active
 */
export const requireActive = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isActive: true },
  });

  if (!user || !user.isActive) {
    res.status(403).json({ error: 'Account is deactivated' });
    return;
  }

  next();
};
