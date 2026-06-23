import Stripe from 'stripe';
import { paymentGatewayService } from './payment-gateway.service';
import { config } from '../config/env';
import { PaymentGatewayConfig } from '../types/payment-gateway';
import { toStripeUnitAmount } from '../utils/gateway-amounts';

export class StripeService {
  private getStripeInstance(isTestMode: boolean, secretKey: string): Stripe {
    return new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  async getStripeConfig(): Promise<{
    stripe: Stripe;
    publishableKey: string;
    isTestMode: boolean;
  } | null> {
    const gateway = await paymentGatewayService.getByType('STRIPE');
    
    if (!gateway || !gateway.isEnabled) {
      return null;
    }

    const gatewayConfig = gateway.config as PaymentGatewayConfig;
    const secretKey = gatewayConfig.secretKey;
    const publishableKey = gatewayConfig.publishableKey;

    if (!secretKey || !publishableKey) {
      throw new Error('Stripe keys are not configured');
    }

    const stripe = this.getStripeInstance(gateway.isTestMode, secretKey);

    return {
      stripe,
      publishableKey,
      isTestMode: gateway.isTestMode,
    };
  }

  async createCheckoutSession(
    orderId: string,
    orderNumber: string,
    currency: string,
    customerEmail: string,
    /** Amounts in major units of `currency` (same currency as session / line_items). */
    lineItems: Array<{
      name: string;
      quantity: number;
      amount: number;
    }>
  ): Promise<{ sessionId: string; url: string }> {
    const stripeConfig = await this.getStripeConfig();
    
    if (!stripeConfig) {
      throw new Error('Stripe is not configured or enabled');
    }

    const { stripe } = stripeConfig;
    const frontendBaseUrl = config.frontend.baseUrl;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: lineItems.map((item) => ({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: item.name,
          },
          unit_amount: toStripeUnitAmount(item.amount, currency),
        },
        quantity: item.quantity,
      })),
      success_url: `${frontendBaseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${frontendBaseUrl}/payment/cancel?order_id=${orderId}`,
      metadata: {
        orderId,
        orderNumber,
      },
    });

    return {
      sessionId: session.id,
      url: session.url || '',
    };
  }

  async verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
  ): Promise<Stripe.Event | null> {
    const gateway = await paymentGatewayService.getByType('STRIPE');
    
    if (!gateway) {
      return null;
    }

    const gatewayConfig = gateway.config as PaymentGatewayConfig;
    const webhookSecret = gatewayConfig.webhookSecret;

    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    const stripe = this.getStripeInstance(gateway.isTestMode, gatewayConfig.secretKey || '');

    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return null;
    }
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    const stripeConfig = await this.getStripeConfig();
    
    if (!stripeConfig) {
      return null;
    }

    const { stripe } = stripeConfig;

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      console.error('Failed to retrieve checkout session:', error);
      return null;
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    const stripeConfig = await this.getStripeConfig();
    
    if (!stripeConfig) {
      throw new Error('Stripe is not configured or enabled');
    }

    const { stripe } = stripeConfig;

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount !== undefined) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    return await stripe.refunds.create(refundParams);
  }
}

export const stripeService = new StripeService();
