import { apiClient } from './client';

export interface WechatpayCreatePaymentResponse {
  codeUrl: string;
  orderId: string;
}

export const wechatpayApi = {
  async createPayment(orderId: string): Promise<WechatpayCreatePaymentResponse> {
    return apiClient.post<WechatpayCreatePaymentResponse>('/payments/wechatpay/payment', {
      orderId,
    });
  },

  async createGuestPayment(
    orderId: string,
    token: string
  ): Promise<WechatpayCreatePaymentResponse> {
    return apiClient.post<WechatpayCreatePaymentResponse>('/payments/wechatpay/guest/payment', {
      orderId,
      token,
    });
  },
};
