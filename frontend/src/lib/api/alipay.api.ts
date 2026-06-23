import { apiClient } from './client';

export interface AlipayCreatePaymentResponse {
  url: string;
}

export const alipayApi = {
  async createPayment(orderId: string): Promise<AlipayCreatePaymentResponse> {
    return apiClient.post<AlipayCreatePaymentResponse>('/payments/alipay/payment', {
      orderId,
    });
  },

  async createGuestPayment(orderId: string, token: string): Promise<AlipayCreatePaymentResponse> {
    return apiClient.post<AlipayCreatePaymentResponse>('/payments/alipay/guest/payment', {
      orderId,
      token,
    });
  },
};
