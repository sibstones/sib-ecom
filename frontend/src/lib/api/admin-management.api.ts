import { apiClient } from './client';

export interface AdminPermissions {
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

export interface Admin {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: AdminPermissions | null;
}

export interface CreateAdminDto {
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  permissions: AdminPermissions;
}

export interface UpdateAdminDto {
  firstName?: string;
  lastName?: string;
  permissions?: Partial<AdminPermissions>;
  isActive?: boolean;
}

export interface AdminActivityLog {
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
  createdAt: string;
}

export interface AdminsResponse {
  admins: Admin[];
  total: number;
  page: number;
  limit: number;
}

export interface ActivityLogsResponse {
  logs: AdminActivityLog[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAdminResponse {
  admin: Admin;
  generatedPassword: string;
  message: string;
}

export const adminManagementApi = {
  // Get all admins
  getAllAdmins: (page: number = 1, limit: number = 20) =>
    apiClient.get<AdminsResponse>(`/admin-management?page=${page}&limit=${limit}`),

  // Get admin by ID
  getAdminById: (adminId: string) =>
    apiClient.get<{ admin: Admin }>(`/admin-management/${adminId}`),

  // Create admin
  createAdmin: (data: CreateAdminDto) =>
    apiClient.post<CreateAdminResponse>('/admin-management', data),

  // Update admin
  updateAdmin: (adminId: string, data: UpdateAdminDto) =>
    apiClient.put<{ admin: Admin }>(`/admin-management/${adminId}`, data),

  // Deactivate admin
  deactivateAdmin: (adminId: string) =>
    apiClient.post<{ message: string }>(`/admin-management/${adminId}/deactivate`),

  // Activate admin
  activateAdmin: (adminId: string) =>
    apiClient.post<{ message: string }>(`/admin-management/${adminId}/activate`),

  // Get activity logs for specific admin
  getAdminActivityLogs: (adminId: string, page: number = 1, limit: number = 50) =>
    apiClient.get<ActivityLogsResponse>(
      `/admin-management/${adminId}/activity-logs?page=${page}&limit=${limit}`
    ),

  // Get all activity logs (super admin only)
  getAllActivityLogs: (
    page: number = 1,
    limit: number = 50,
    filters?: {
      adminId?: string;
      action?: string;
      entityType?: string;
    }
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.adminId) params.append('adminId', filters.adminId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.entityType) params.append('entityType', filters.entityType);
    return apiClient.get<ActivityLogsResponse>(
      `/admin-management/activity-logs/all?${params.toString()}`
    );
  },
};
