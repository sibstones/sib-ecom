import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { hashPassword } from '../utils/hash';
import { CreateAdminDto, UpdateAdminDto, AdminWithPermissions } from '../types/admin';
import { generateRandomPassword } from '../utils/password-generator';
import { adminActivityService } from './admin-activity.service';

export class AdminManagementService {
  /**
   * Generate a random password for new admin
   */
  private generatePassword(): string {
    return generateRandomPassword(12);
  }

  /**
   * Create a new admin/moderator with permissions
   */
  async createAdmin(
    data: CreateAdminDto,
    createdById: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ admin: AdminWithPermissions; generatedPassword: string }> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Generate password
    const generatedPassword = this.generatePassword();
    const passwordHash = await hashPassword(generatedPassword);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        isActive: true,
        adminPermissions: {
          create: data.permissions,
        },
      },
      include: {
        adminPermissions: true,
      },
    });

    // Log activity
    await adminActivityService.logActivity({
      adminId: createdById, // Admin who performed the action (created the admin)
      createdById: user.id, // Admin who was created (for reference)
      action: 'CREATE_ADMIN',
      entityType: 'USER',
      entityId: user.id,
      details: {
        email: user.email,
        role: user.role,
        permissions: data.permissions,
      },
      ipAddress,
      userAgent,
    });

    return {
      admin: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions: user.adminPermissions
          ? {
              canManageSupport: user.adminPermissions.canManageSupport,
              canManageOrders: user.adminPermissions.canManageOrders,
              canManageInventory: user.adminPermissions.canManageInventory,
              canManagePayments: user.adminPermissions.canManagePayments,
              canManageProducts: user.adminPermissions.canManageProducts,
              canManageCategories: user.adminPermissions.canManageCategories,
              canManageBrands: user.adminPermissions.canManageBrands,
              canManageCustomers: user.adminPermissions.canManageCustomers,
              canManagePromoCodes: user.adminPermissions.canManagePromoCodes,
              canManageContent: user.adminPermissions.canManageContent,
              canManageSettings: user.adminPermissions.canManageSettings,
              canViewReports: user.adminPermissions.canViewReports,
            }
          : null,
      },
      generatedPassword,
    };
  }

  /**
   * Get all admins/moderators
   */
  async getAllAdmins(page: number = 1, limit: number = 20): Promise<{
    admins: AdminWithPermissions[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: {
            in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          },
        },
        include: {
          adminPermissions: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: {
          role: {
            in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          },
        },
      }),
    ]);

    return {
      admins: admins.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions: user.adminPermissions
          ? {
              canManageSupport: user.adminPermissions.canManageSupport,
              canManageOrders: user.adminPermissions.canManageOrders,
              canManageInventory: user.adminPermissions.canManageInventory,
              canManagePayments: user.adminPermissions.canManagePayments,
              canManageProducts: user.adminPermissions.canManageProducts,
              canManageCategories: user.adminPermissions.canManageCategories,
              canManageBrands: user.adminPermissions.canManageBrands,
              canManageCustomers: user.adminPermissions.canManageCustomers,
              canManagePromoCodes: user.adminPermissions.canManagePromoCodes,
              canManageContent: user.adminPermissions.canManageContent,
              canManageSettings: user.adminPermissions.canManageSettings,
              canViewReports: user.adminPermissions.canViewReports,
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get admin by ID
   */
  async getAdminById(adminId: string): Promise<AdminWithPermissions | null> {
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      include: {
        adminPermissions: true,
      },
    });

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissions: user.adminPermissions
        ? {
            canManageSupport: user.adminPermissions.canManageSupport,
            canManageOrders: user.adminPermissions.canManageOrders,
            canManageInventory: user.adminPermissions.canManageInventory,
            canManagePayments: user.adminPermissions.canManagePayments,
            canManageProducts: user.adminPermissions.canManageProducts,
            canManageCategories: user.adminPermissions.canManageCategories,
            canManageBrands: user.adminPermissions.canManageBrands,
            canManageCustomers: user.adminPermissions.canManageCustomers,
            canManagePromoCodes: user.adminPermissions.canManagePromoCodes,
            canManageContent: user.adminPermissions.canManageContent,
            canManageSettings: user.adminPermissions.canManageSettings,
            canViewReports: user.adminPermissions.canViewReports,
          }
        : null,
    };
  }

  /**
   * Update admin
   */
  async updateAdmin(
    adminId: string,
    data: UpdateAdminDto,
    updatedById: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminWithPermissions> {
    // Check if admin exists
    const existingAdmin = await prisma.user.findUnique({
      where: { id: adminId },
      include: { adminPermissions: true },
    });

    if (!existingAdmin || (existingAdmin.role !== UserRole.ADMIN && existingAdmin.role !== UserRole.SUPER_ADMIN)) {
      throw new Error('Admin not found');
    }

    // Prevent deactivating super admin
    if (existingAdmin.role === UserRole.SUPER_ADMIN && data.isActive === false) {
      throw new Error('Cannot deactivate super admin');
    }

    // Update user
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const user = await prisma.user.update({
      where: { id: adminId },
      data: {
        ...updateData,
        ...(data.permissions && {
          adminPermissions: {
            upsert: {
              create: data.permissions,
              update: data.permissions,
            },
          },
        }),
      },
      include: {
        adminPermissions: true,
      },
    });

    // Log activity
    await adminActivityService.logActivity({
      adminId: updatedById,
      action: 'UPDATE_ADMIN',
      entityType: 'USER',
      entityId: adminId,
      details: {
        updatedFields: Object.keys(data),
        newValues: data,
      },
      ipAddress,
      userAgent,
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissions: user.adminPermissions
        ? {
            canManageSupport: user.adminPermissions.canManageSupport,
            canManageOrders: user.adminPermissions.canManageOrders,
            canManageInventory: user.adminPermissions.canManageInventory,
            canManagePayments: user.adminPermissions.canManagePayments,
            canManageProducts: user.adminPermissions.canManageProducts,
            canManageCategories: user.adminPermissions.canManageCategories,
            canManageBrands: user.adminPermissions.canManageBrands,
            canManageCustomers: user.adminPermissions.canManageCustomers,
            canManagePromoCodes: user.adminPermissions.canManagePromoCodes,
            canManageContent: user.adminPermissions.canManageContent,
            canManageSettings: user.adminPermissions.canManageSettings,
            canViewReports: user.adminPermissions.canViewReports,
          }
        : null,
    };
  }

  /**
   * Deactivate admin
   */
  async deactivateAdmin(
    adminId: string,
    deactivatedById: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SUPER_ADMIN)) {
      throw new Error('Admin not found');
    }

    if (admin.role === UserRole.SUPER_ADMIN) {
      throw new Error('Cannot deactivate super admin');
    }

    await prisma.user.update({
      where: { id: adminId },
      data: { isActive: false },
    });

    // Log activity
    await adminActivityService.logActivity({
      adminId: deactivatedById,
      action: 'DEACTIVATE_ADMIN',
      entityType: 'USER',
      entityId: adminId,
      details: {
        deactivatedAdminEmail: admin.email,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Activate admin
   */
  async activateAdmin(
    adminId: string,
    activatedById: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SUPER_ADMIN)) {
      throw new Error('Admin not found');
    }

    await prisma.user.update({
      where: { id: adminId },
      data: { isActive: true },
    });

    // Log activity
    await adminActivityService.logActivity({
      adminId: activatedById,
      action: 'ACTIVATE_ADMIN',
      entityType: 'USER',
      entityId: adminId,
      details: {
        activatedAdminEmail: admin.email,
      },
      ipAddress,
      userAgent,
    });
  }
}

export const adminManagementService = new AdminManagementService();
