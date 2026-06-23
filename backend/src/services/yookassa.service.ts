import { paymentGatewayService } from './payment-gateway.service';
import { config } from '../config/env';
import { PaymentGatewayConfig } from '../types/payment-gateway';

interface YooKassaPaymentRequest {
  amount: {
    value: string;
    currency: string;
  };
  capture: boolean;
  confirmation: {
    type: string;
    return_url: string;
  };
  description: string;
  metadata?: Record<string, string>;
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  created_at: string;
  description: string;
  metadata?: Record<string, string>;
  test: boolean;
}

export class YooKassaService {
  private async getYooKassaConfig(): Promise<{
    shopId: string;
    secretKey: string;
    isTestMode: boolean;
  } | null> {
    const gateway = await paymentGatewayService.getByType('YOOKASSA');
    
    if (!gateway || !gateway.isEnabled) {
      return null;
    }

    const gatewayConfig = gateway.config as PaymentGatewayConfig & { gateId?: string; gate_id?: string; secret_key?: string };
    const shopId = gatewayConfig.shopId ?? gatewayConfig.gateId ?? gatewayConfig.gate_id;
    const secretKey = gatewayConfig.secretKey ?? gatewayConfig.secret_key;

    if (!shopId || !secretKey) {
      throw new Error('YooKassa credentials are not configured');
    }

    return {
      shopId,
      secretKey,
      isTestMode: gateway.isTestMode,
    };
  }

  private createAuthHeader(shopId: string, secretKey: string): string {
    return Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  }

  async createPayment(
    orderId: string,
    orderNumber: string,
    amountValue: string,
    currency: string,
    description: string,
    returnUrl: string
  ): Promise<{ paymentId: string; confirmationUrl: string }> {
    const yooKassaConfig = await this.getYooKassaConfig();
    
    if (!yooKassaConfig) {
      throw new Error('YooKassa is not configured or enabled');
    }

    const { shopId, secretKey } = yooKassaConfig;
    const authHeader = this.createAuthHeader(shopId, secretKey);
    const frontendBaseUrl = config.frontend.baseUrl;

    const paymentData: YooKassaPaymentRequest = {
      amount: {
        value: amountValue,
        currency: currency.toUpperCase(),
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl || `${frontendBaseUrl}/payment/success?order_id=${orderId}`,
      },
      description: description || `Order ${orderNumber}`,
      metadata: {
        orderId,
        orderNumber,
      },
    };

    const idempotenceKey = `order-${orderId}-${Date.now()}`;

    try {
      const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Idempotence-Key': idempotenceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`YooKassa API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const payment = (await response.json()) as YooKassaPaymentResponse;

      if (!payment.confirmation?.confirmation_url) {
        throw new Error('YooKassa payment created but no confirmation URL received');
      }

      return {
        paymentId: payment.id,
        confirmationUrl: payment.confirmation.confirmation_url,
      };
    } catch (error) {
      console.error('Failed to create YooKassa payment:', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<YooKassaPaymentResponse | null> {
    const yooKassaConfig = await this.getYooKassaConfig();
    
    if (!yooKassaConfig) {
      return null;
    }

    const { shopId, secretKey } = yooKassaConfig;
    const authHeader = this.createAuthHeader(shopId, secretKey);

    try {
      const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as YooKassaPaymentResponse;
    } catch (error) {
      console.error('Failed to get YooKassa payment status:', error);
      return null;
    }
  }

  /**
   * Verify webhook: if x-hmac-signature is present, verify HMAC-SHA256(body, secretKey);
   * otherwise only ensure gateway is configured (enable HMAC in YooKassa merchant panel for production).
   */
  async verifyWebhook(rawBody: string | Buffer, signature?: string): Promise<boolean> {
    const config = await this.getYooKassaConfig();
    if (!config) return false;
    if (signature) {
      const crypto = await import('crypto');
      const raw = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const expectedDigest = crypto.createHmac('sha256', config.secretKey).update(raw, 'utf8').digest();
      const receivedDigest = Buffer.from(signature, 'base64');
      if (expectedDigest.length !== receivedDigest.length) return false;
      return crypto.timingSafeEqual(expectedDigest, receivedDigest);
    }
    return true;
  }

  async refundPayment(paymentId: string, amount?: number): Promise<boolean> {
    const yooKassaConfig = await this.getYooKassaConfig();
    
    if (!yooKassaConfig) {
      throw new Error('YooKassa is not configured or enabled');
    }

    const { shopId, secretKey } = yooKassaConfig;
    const authHeader = this.createAuthHeader(shopId, secretKey);

    const refundData: any = {
      payment_id: paymentId,
    };

    if (amount !== undefined) {
      refundData.amount = {
        value: amount.toFixed(2),
        currency: 'RUB', // YooKassa primarily uses RUB
      };
    }

    try {
      const idempotenceKey = `refund-${paymentId}-${Date.now()}`;
      
      const response = await fetch('https://api.yookassa.ru/v3/refunds', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Idempotence-Key': idempotenceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refundData),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to refund YooKassa payment:', error);
      return false;
    }
  }
}

export const yookassaService = new YooKassaService();
