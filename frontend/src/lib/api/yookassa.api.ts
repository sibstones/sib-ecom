import { apiClient } from './client';

export interface YooKassaCreatePaymentResponse {
  paymentId: string;
  url: string;
}

export interface YooKassaPaymentStatus {
  paymentId: string;
  status: string;
  paid: boolean;
  orderId?: string;
}

export const yookassaApi = {
  async createPayment(orderId: string): Promise<YooKassaCreatePaymentResponse> {
    return apiClient.post<YooKassaCreatePaymentResponse>('/payments/yookassa/payment', {
      orderId,
    });
  },

  async createGuestPayment(orderId: string, token: string): Promise<YooKassaCreatePaymentResponse> {
    return apiClient.post<YooKassaCreatePaymentResponse>('/payments/yookassa/guest/payment', {
      orderId,
      token,
    });
  },

  async syncPaymentStatus(
    orderId: string,
    paymentId: string
  ): Promise<{ paid: boolean; status?: string }> {
    return apiClient.post<{ paid: boolean; status?: string }>('/payments/yookassa/sync-status', {
      orderId,
      paymentId,
    });
  },

  async syncGuestPaymentStatus(
    orderId: string,
    paymentId: string,
    token: string
  ): Promise<{ paid: boolean; status?: string }> {
    return apiClient.post<{ paid: boolean; status?: string }>(
      '/payments/yookassa/guest/sync-status',
      {
        orderId,
        paymentId,
        token,
      }
    );
  },

  async getPaymentStatus(paymentId: string): Promise<YooKassaPaymentStatus> {
    return apiClient.get<YooKassaPaymentStatus>(`/payments/yookassa/payment/${paymentId}`);
  },
};
