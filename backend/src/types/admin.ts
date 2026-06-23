export interface AdminPermissionsDto {
  canManageSupport: boolean;
  canManageOrders: boolean;
  canManageInventory: boolean;
  canManagePayments: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageBrands: boolean;
  canManageCustomers: boolean;
  canManagePromoCodes: boolean;
  canManageContent: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
}

export interface CreateAdminDto {
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  permissions: AdminPermissionsDto;
}

export interface UpdateAdminDto {
  firstName?: string;
  lastName?: string;
  permissions?: Partial<AdminPermissionsDto>;
  isActive?: boolean;
}

export interface AdminWithPermissions {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: AdminPermissionsDto | null;
}

export interface AdminActivityLogDto {
  id: string;
  adminId: string;
  adminEmail: string;
  adminName?: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
