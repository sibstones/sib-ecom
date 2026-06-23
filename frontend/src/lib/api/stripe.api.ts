import { apiClient } from './client';

export interface StripeCheckoutSession {
  sessionId: string;
  url: string;
}

export interface StripeSessionStatus {
  sessionId: string;
  paymentStatus: string;
  status: string;
  orderId: string;
}

export const stripeApi = {
  async createCheckoutSession(orderId: string): Promise<StripeCheckoutSession> {
    return apiClient.post<StripeCheckoutSession>('/payments/stripe/checkout', {
      orderId,
    });
  },

  async createGuestCheckoutSession(orderId: string, token: string): Promise<StripeCheckoutSession> {
    return apiClient.post<StripeCheckoutSession>('/payments/stripe/guest/checkout', {
      orderId,
      token,
    });
  },

  async getSessionStatus(sessionId: string): Promise<StripeSessionStatus> {
    return apiClient.get<StripeSessionStatus>(`/payments/stripe/session/${sessionId}`);
  },

  async getGuestSessionStatus(sessionId: string, token: string): Promise<StripeSessionStatus> {
    return apiClient.get<StripeSessionStatus>(
      `/payments/stripe/guest/session/${encodeURIComponent(sessionId)}`,
      { params: { token } }
    );
  },
};
