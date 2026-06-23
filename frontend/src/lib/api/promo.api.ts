import { apiClient } from './client';

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'BALANCE';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  userId?: string; // Optional: restrict to specific user
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Partner promo code fields
  isPartnerPromo?: boolean;
  partnerId?: string;
  partnerCommissionRate?: number;
}

export interface ApplyPromoCodeResult {
  promoCode: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  };
  discount: number;
}

export const promoApi = {
  getAll: (activeOnly: boolean = false) =>
    apiClient.get<{ codes: PromoCode[] }>(`/promo?active=${activeOnly}`),
  getById: (id: string) => apiClient.get<{ code: PromoCode }>(`/promo/${id}`),
  apply: (code: string, subtotal: number) =>
    apiClient.post<ApplyPromoCodeResult>('/promo/apply', { code, subtotal }),
  create: (data: Omit<PromoCode, 'id' | 'createdAt' | 'updatedAt' | 'usedCount'>) =>
    apiClient.post<{ code: PromoCode }>('/promo', data),
  update: (id: string, data: Partial<PromoCode>) =>
    apiClient.put<{ code: PromoCode }>(`/promo/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/promo/${id}`),
};
