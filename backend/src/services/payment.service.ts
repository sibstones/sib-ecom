// Payment service - integrates with Stripe and other payment gateways

import { stripeService } from './stripe.service';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  clientSecret?: string;
}

export class PaymentService {
  async createPaymentIntent(
    orderId: string,
    amount: number,
    currency: string = 'USD'
  ): Promise<PaymentIntent> {
    // For Stripe Checkout, we use checkout sessions instead of payment intents
    // This method is kept for compatibility but returns a mock
    return {
      id: `pi_${Date.now()}`,
      amount,
      currency,
      status: 'pending',
      clientSecret: `mock_secret_${Date.now()}`,
    };
  }

  async confirmPayment(_paymentIntentId: string): Promise<{ success: boolean }> {
    // Payment confirmation is handled via webhook for Stripe Checkout
    // This method is kept for compatibility
    return { success: true };
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<{ success: boolean }> {
    try {
      await stripeService.refundPayment(paymentIntentId, amount);
      return { success: true };
    } catch (error) {
      console.error('Refund failed:', error);
      return { success: false };
    }
  }
}

export const paymentService = new PaymentService();
