import { apiClient } from './client';

export interface PaymentGatewayConfig {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  clientId?: string;
  clientSecret?: string;
  merchantId?: string;
  cardNumber?: string;
  cryptoWallet?: string;
  blockchain?: string;
  sbpPhone?: string;
  instruction?: string;
  instructionEn?: string;
  instructionZh?: string;
  managerName?: string;
  telegramUsername?: string;
  whatsappNumber?: string;
  wechatLink?: string;
  maxLink?: string;
  apiKey?: string;
  apiSecret?: string;
  [key: string]: unknown;
}

export interface PaymentGateway {
  id: string;
  type: string;
  name: string;
  isEnabled: boolean;
  isTestMode: boolean;
  config: PaymentGatewayConfig;
  supportedCountries: string[];
  supportedCurrencies: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export const paymentGatewayApi = {
  getAll: (enabledOnly = false) =>
    apiClient.get<{ gateways: PaymentGateway[] }>(`/payment-gateways?enabledOnly=${enabledOnly}`),
  getById: (id: string) => apiClient.get<{ gateway: PaymentGateway }>(`/payment-gateways/${id}`),
  getForCheckout: (countryCode: string, currency: string) =>
    apiClient.get<{ gateways: PaymentGateway[] }>(
      `/payment-gateways/checkout?countryCode=${countryCode}&currency=${currency}`
    ),
  create: (data: {
    type: string;
    name: string;
    isEnabled?: boolean;
    isTestMode?: boolean;
    config: PaymentGatewayConfig;
    supportedCountries?: string[];
    supportedCurrencies?: string[];
    sortOrder?: number;
  }) => apiClient.post<{ gateway: PaymentGateway }>('/payment-gateways', data),
  update: (id: string, data: Partial<PaymentGateway>) =>
    apiClient.put<{ gateway: PaymentGateway }>(`/payment-gateways/${id}`, data),
  delete: (id: string) => apiClient.delete<{ message: string }>(`/payment-gateways/${id}`),
  toggleEnabled: (id: string, enabled: boolean) =>
    apiClient.post<{ gateway: PaymentGateway }>(`/payment-gateways/${id}/toggle`, { enabled }),

  testConnection: (type: string, config: PaymentGatewayConfig) =>
    apiClient.post<{ success: boolean; message: string }>('/payment-gateways/test-connection', {
      type,
      config,
    }),
};
