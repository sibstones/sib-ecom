import { apiClient } from './client';
import { normalizeUploadFile } from '$lib/utils/file-upload';

export interface Partner {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isPartner: boolean;
  partnerStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  _count?: {
    orders: number;
    promoCodes: number;
  };
}

export interface PartnerStats {
  partner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    partnerStatus?: string;
  };
  stats: {
    totalPromoCodes: number;
    totalOrders: number;
    totalOrdersValue: number;
    totalCommissions: number;
    availableForPayout: number;
    paidCommissions: number;
    commissionsByStatus: Record<string, { count: number; amount: number }>;
  };
}

export interface PartnerCommission {
  id: string;
  partnerId: string;
  orderId: string;
  promoCodeId: string;
  orderTotal: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  payoutId?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    createdAt: string;
    user?: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
  };
  promoCode?: {
    id: string;
    code: string;
  };
}

export interface PartnerPayout {
  id: string;
  partnerId: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  requestedAt: string;
  approvedAt?: string;
  paidAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  partner?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  commissions?: PartnerCommission[];
}

export interface PartnerDocument {
  id: string;
  partnerId: string;
  name: string;
  type: 'CONTRACT' | 'AGREEMENT' | 'OTHER';
  fileUrl: string;
  downloadUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const partnerApi = {
  // Admin: Get all partners
  getAllPartners: (page: number = 1, limit: number = 20, search?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    return apiClient.get<{ partners: Partner[]; pagination: any }>(
      `/admin/partners?${params.toString()}`
    );
  },

  // Admin: Get partner by ID
  getPartnerById: (id: string) =>
    apiClient.get<{
      partner: Partner & {
        partnerPromoCodes?: any[];
        partnerCommissions?: any[];
        partnerPayouts?: any[];
      };
    }>(`/admin/partners/${id}`),

  // Admin: Update partner status
  updatePartnerStatus: (id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') =>
    apiClient.put<{ partner: Partner }>(`/admin/partners/${id}/status`, { status }),

  // Admin: Assign partner status to user
  assignPartner: (userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = 'ACTIVE') =>
    apiClient.post<{ partner: Partner }>(`/admin/users/${userId}/assign-partner`, { status }),

  // Admin: Remove partner status
  removePartner: (userId: string) =>
    apiClient.post<{ user: any }>(`/admin/users/${userId}/remove-partner`),

  // Admin: Get partner statistics
  getPartnerStats: (id: string) => apiClient.get<PartnerStats>(`/admin/partners/${id}/stats`),

  // Admin: Get partner orders
  getPartnerOrders: (id: string, page: number = 1, limit: number = 20) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return apiClient.get<{ orders: any[]; pagination: any }>(
      `/admin/partners/${id}/orders?${params.toString()}`
    );
  },

  // Partner: Get own promo codes (for link builder)
  getOwnPromoCodes: () =>
    apiClient.get<{
      promoCodes: {
        id: string;
        code: string;
        discountType: string;
        discountValue: number;
        usageLimit?: number;
        usedCount: number;
      }[];
    }>('/partner/promoCodes'),

  // Partner: Get own commissions
  getOwnCommissions: (page: number = 1, limit: number = 20, status?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append('status', status);
    return apiClient.get<{ commissions: PartnerCommission[]; pagination: any }>(
      `/partner/commissions?${params.toString()}`
    );
  },

  // Partner: Get commission statistics
  getCommissionStats: () =>
    apiClient.get<{
      stats: Record<string, { count: number; amount: number }>;
      total: number;
      totalCount: number;
    }>(`/partner/commissions/stats`),

  // Partner: Get available commissions for payout
  getAvailableCommissions: () =>
    apiClient.get<{ commissions: PartnerCommission[] }>(`/partner/commissions/available`),

  // Partner: Create payout request
  createPayoutRequest: (amount: number, commissionIds: string[]) =>
    apiClient.post<{ payout: PartnerPayout }>(`/partner/payouts`, { amount, commissionIds }),

  // Partner: Get own payouts
  getOwnPayouts: (page: number = 1, limit: number = 20) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return apiClient.get<{ payouts: PartnerPayout[]; pagination: any }>(
      `/partner/payouts?${params.toString()}`
    );
  },

  // Admin: Get all payout requests
  getAllPayouts: (page: number = 1, limit: number = 20, status?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append('status', status);
    return apiClient.get<{ payouts: PartnerPayout[]; pagination: any }>(
      `/admin/partner-payouts?${params.toString()}`
    );
  },

  // Admin: Get payout by ID
  getPayoutById: (id: string) =>
    apiClient.get<{ payout: PartnerPayout }>(`/admin/partner-payouts/${id}`),

  // Admin: Approve payout
  approvePayout: (id: string, adminNotes?: string) =>
    apiClient.post<{ payout: PartnerPayout }>(`/admin/partner-payouts/${id}/approve`, {
      adminNotes,
    }),

  // Admin: Reject payout
  rejectPayout: (id: string, rejectionReason: string) =>
    apiClient.post<{ payout: PartnerPayout }>(`/admin/partner-payouts/${id}/reject`, {
      rejectionReason,
    }),

  // Admin: Mark payout as paid
  markPayoutAsPaid: (id: string) =>
    apiClient.post<{ payout: PartnerPayout }>(`/admin/partner-payouts/${id}/mark-paid`),

  // Partner: Get own documents
  getOwnDocuments: (type?: string) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    return apiClient.get<{ documents: PartnerDocument[] }>(
      `/partner/documents?${params.toString()}`
    );
  },

  // Admin: Upload document for partner
  uploadDocument: (
    partnerId: string,
    file: File,
    data: { name: string; type: string; description?: string; expiresAt?: string }
  ) => {
    const formData = new FormData();
    formData.append('file', normalizeUploadFile(file));
    formData.append('partnerId', partnerId);
    formData.append('name', data.name);
    formData.append('type', data.type);
    if (data.description) formData.append('description', data.description);
    if (data.expiresAt) formData.append('expiresAt', data.expiresAt);

    return apiClient.post(`/admin/partners/${partnerId}/documents`, formData);
  },

  // Admin: Get partner documents
  getPartnerDocuments: (partnerId: string, type?: string) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    return apiClient.get<{ documents: PartnerDocument[] }>(
      `/admin/partners/${partnerId}/documents?${params.toString()}`
    );
  },

  // Admin: Delete document
  deleteDocument: (id: string) =>
    apiClient.delete<{ message: string }>(`/admin/partner-documents/${id}`),
};
