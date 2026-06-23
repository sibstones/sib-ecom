import { apiClient } from './client';
import type { User } from '../stores/auth.store';

export interface GuestOrderPaymentStatus {
  paymentStatus: string;
  status: string;
  orderNumber: string;
}

export const guestCheckoutApi = {
  authenticate(orderId: string, token: string): Promise<{ user: User }> {
    return apiClient.post<{ user: User }>('/checkout/guest/authenticate', {
      orderId,
      token,
    });
  },
  getOrderPaymentStatus(orderId: string, token: string): Promise<GuestOrderPaymentStatus> {
    return apiClient.get<GuestOrderPaymentStatus>('/checkout/guest/order-status', {
      params: { orderId, token },
    });
  },
};
