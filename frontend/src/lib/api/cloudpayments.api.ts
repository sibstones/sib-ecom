import { apiClient } from './client';

export interface CloudPaymentsWidgetParams {
  publicId: string;
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  orderNumber: string;
  returnUrl: string;
  failUrl: string;
  email?: string;
  invoiceId?: string;
  cultureName?: string;
}

export const cloudpaymentsApi = {
  async getWidgetParams(orderId: string): Promise<CloudPaymentsWidgetParams> {
    return apiClient.post<CloudPaymentsWidgetParams>('/payments/cloudpayments/widget-params', {
      orderId,
    });
  },

  async getGuestWidgetParams(orderId: string, token: string): Promise<CloudPaymentsWidgetParams> {
    return apiClient.post<CloudPaymentsWidgetParams>(
      '/payments/cloudpayments/guest/widget-params',
      {
        orderId,
        token,
      }
    );
  },
};
