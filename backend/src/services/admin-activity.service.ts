import prisma from '../config/database';
import { AdminActivityLogDto } from '../types/admin';

interface LogActivityParams {
  adminId: string;
  createdById?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AdminActivityService {
  /**
   * Log admin activity
   */
  async logActivity(params: LogActivityParams): Promise<void> {
    try {
      await prisma.adminActivityLog.create({
        data: {
          adminId: params.adminId,
          createdById: params.createdById,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          details: params.details || {},
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Log error but don't throw - activity logging shouldn't break the main flow
      console.error('Failed to log admin activity:', error);
    }
  }

  /**
   * Get activity logs for a specific admin
   */
  async getAdminActivityLogs(
    adminId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: AdminActivityLogDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminActivityLog.findMany({
        where: { adminId },
        include: {
          admin: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminActivityLog.count({
        where: { adminId },
      }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        adminId: log.adminId,
        adminEmail: log.admin.email,
        adminName: log.admin.firstName && log.admin.lastName
          ? `${log.admin.firstName} ${log.admin.lastName}`
          : log.admin.firstName || log.admin.lastName || undefined,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get all activity logs (for super admin)
   */
  async getAllActivityLogs(
    page: number = 1,
    limit: number = 50,
    filters?: {
      adminId?: string;
      action?: string;
      entityType?: string;
    }
  ): Promise<{
    logs: AdminActivityLogDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.adminId) where.adminId = filters.adminId;
    if (filters?.action) where.action = filters.action;
    if (filters?.entityType) where.entityType = filters.entityType;

    const [logs, total] = await Promise.all([
      prisma.adminActivityLog.findMany({
        where,
        include: {
          admin: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminActivityLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        adminId: log.adminId,
        adminEmail: log.admin.email,
        adminName: log.admin.firstName && log.admin.lastName
          ? `${log.admin.firstName} ${log.admin.lastName}`
          : log.admin.firstName || log.admin.lastName || undefined,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
    };
  }
}

export const adminActivityService = new AdminActivityService();
