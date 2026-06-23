import { createHmac } from 'crypto';
import { paymentGatewayService } from './payment-gateway.service';
import { config } from '../config/env';
import { PaymentGatewayConfig } from '../types/payment-gateway';

const CLOUDPAYMENTS_API_BASE = 'https://api.cloudpayments.ru';

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

export interface CloudPaymentsCheckPayload {
  TransactionId?: number;
  Amount?: number;
  Currency?: string;
  InvoiceId?: string;
  AccountId?: string;
  [key: string]: unknown;
}

export interface CloudPaymentsPayFailPayload {
  TransactionId?: number;
  Amount?: number;
  Currency?: string;
  InvoiceId?: string;
  AccountId?: string;
  Status?: string;
  [key: string]: unknown;
}

export class CloudPaymentsService {
  private async getConfig(): Promise<{
    publicId: string;
    apiSecret: string;
    isTestMode: boolean;
  } | null> {
    const gateway = await paymentGatewayService.getByType('CLOUDPAYMENTS');
    if (!gateway || !gateway.isEnabled) return null;

    const cfg = gateway.config as PaymentGatewayConfig;
    const publicId = cfg.publicId ?? cfg.apiKey;
    const apiSecret = cfg.apiSecret ?? cfg.secretKey;
    if (!publicId || !apiSecret) return null;

    return {
      publicId: String(publicId).trim(),
      apiSecret: String(apiSecret).trim(),
      isTestMode: gateway.isTestMode ?? true,
    };
  }

  private createAuthHeader(publicId: string, apiSecret: string): string {
    return Buffer.from(`${publicId}:${apiSecret}`, 'utf8').toString('base64');
  }

  /**
   * Returns widget params for frontend to open CloudPayments widget.
   * Frontend loads https://widget.cloudpayments.ru/bundles/cloudpayments.js and calls widget.start(intentParams).
   */
  async getWidgetParams(
    orderId: string,
    orderNumber: string,
    amount: number,
    currency: string,
    description: string,
    returnUrl: string,
    email?: string
  ): Promise<CloudPaymentsWidgetParams | null> {
    const cp = await this.getConfig();
    if (!cp) return null;

    const frontendBaseUrl = config.frontend?.baseUrl ?? '';
    const failUrl = returnUrl.replace(/success|order_id=/, 'cancel') || `${frontendBaseUrl}/payment/cancel`;

    return {
      publicId: cp.publicId,
      amount: Math.round(amount * 100) / 100,
      currency: currency.toUpperCase() || 'RUB',
      description: description || `Order ${orderNumber}`,
      orderId,
      orderNumber,
      returnUrl,
      failUrl,
      email: email || undefined,
      invoiceId: orderNumber,
      cultureName: 'ru-RU',
    };
  }

  /**
   * Verify webhook signature. CloudPayments sends X-Content-HMAC or Content-HMAC (HMAC-SHA256 of body, key = API Secret, value base64).
   */
  async verifyWebhookSignature(body: string | Buffer, signature: string | undefined): Promise<boolean> {
    if (!signature) return false;
    return this.verifyWebhookSignatureWithSecret(body, signature, async () => {
      const c = await this.getConfig();
      return c?.apiSecret ?? null;
    });
  }

  async verifyWebhookSignatureWithSecret(
    body: string | Buffer,
    signature: string | undefined,
    getSecret: () => Promise<string | null>
  ): Promise<boolean> {
    if (!signature) return false;
    const secret = await getSecret();
    if (!secret) return false;
    const raw = typeof body === 'string' ? body : body.toString('utf8');
    const hmac = createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
    return hmac === signature;
  }

  /**
   * Handle Check notification: validate order and return code. Code 0 = allow payment.
   */
  async handleCheck(payload: CloudPaymentsCheckPayload): Promise<{ code: number }> {
    const invoiceId = payload.InvoiceId ?? payload.invoiceId;
    const amount = payload.Amount ?? payload.amount;
    if (!invoiceId || amount == null) {
      return { code: 10 }; // Invalid invoice
    }
    // Optional: load order by invoiceId (orderNumber), verify amount — if mismatch return 12 (InvalidAmount)
    return { code: 0 };
  }

  /**
   * Handle Pay notification: payment succeeded. Returns code 0 to acknowledge.
   */
  async handlePay(_payload: CloudPaymentsPayFailPayload): Promise<{ code: number }> {
    return { code: 0 };
  }

  /**
   * Handle Fail notification: payment declined. Returns code 0 to acknowledge.
   */
  async handleFail(_payload: CloudPaymentsPayFailPayload): Promise<{ code: number }> {
    return { code: 0 };
  }

  /**
   * Call CloudPayments API (e.g. payments/get) with Basic Auth.
   */
  async apiRequest<T>(path: string, options: RequestInit = {}): Promise<T | null> {
    const cp = await this.getConfig();
    if (!cp) return null;

    const url = path.startsWith('http') ? path : `${CLOUDPAYMENTS_API_BASE}${path}`;
    const auth = this.createAuthHeader(cp.publicId, cp.apiSecret);

    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });

    if (!res.ok) return null;
    return res.json() as Promise<T>;
  }
}

export const cloudpaymentsService = new CloudPaymentsService();
