import WxPay from 'wechatpay-node-v3';
import { paymentGatewayService } from './payment-gateway.service';
import { config } from '../config/env';
import { PaymentGatewayConfig } from '../types/payment-gateway';

export class WechatpayService {
  private async getWechatpayConfig(): Promise<{
    appId: string;
    mchId: string;
    apiV3Key: string;
    merchantPrivateKey: string;
    merchantCertificateSerial: string;
    merchantCertificate?: string;
  } | null> {
    const gateway = await paymentGatewayService.getByType('WECHATPAY');
    if (!gateway || !gateway.isEnabled) return null;

    const cfg = gateway.config as PaymentGatewayConfig & Record<string, unknown>;
    const appId = cfg.appId?.toString().trim();
    const mchId = cfg.mchId?.toString().trim();
    const apiV3Key = cfg.apiV3Key?.toString().trim();
    const merchantPrivateKey = cfg.merchantPrivateKey?.toString().trim();
    const merchantCertificateSerial = cfg.merchantCertificateSerial?.toString().trim();
    const merchantCertificate = cfg.merchantCertificate?.toString().trim();

    if (!appId || !mchId || !apiV3Key || !merchantPrivateKey || !merchantCertificateSerial) return null;

    return {
      appId,
      mchId,
      apiV3Key,
      merchantPrivateKey,
      merchantCertificateSerial,
      merchantCertificate: merchantCertificate || undefined,
    };
  }

  private createPay(cfg: Awaited<ReturnType<typeof this.getWechatpayConfig>>): WxPay | null {
    if (!cfg) return null;

    const payConfig: Record<string, unknown> = {
      appid: cfg.appId,
      mchid: cfg.mchId,
      privateKey: cfg.merchantPrivateKey,
      key: cfg.apiV3Key,
      serial_no: cfg.merchantCertificateSerial,
    };
    if (cfg.merchantCertificate) {
      payConfig.publicKey = cfg.merchantCertificate;
    }

    return new WxPay(payConfig as any);
  }

  async createNativePayment(
    orderId: string,
    orderNumber: string,
    amountCents: number,
    description: string
  ): Promise<{ codeUrl: string }> {
    const wechatConfig = await this.getWechatpayConfig();
    if (!wechatConfig) {
      throw new Error('WeChat Pay is not configured or enabled');
    }

    const apiBase = process.env.API_BASE_URL || `http://localhost:${config.port}`;
    const notifyUrl = `${apiBase.replace(/\/$/, '')}/api/payments/wechatpay/webhook`;

    const pay = this.createPay(wechatConfig);
    if (!pay) throw new Error('Failed to initialize WeChat Pay');

    const outTradeNo = `order-${orderId}-${Date.now()}`;

    const params = {
      appid: wechatConfig.appId,
      mchid: wechatConfig.mchId,
      description: description || `Order ${orderNumber}`,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: {
        total: amountCents,
        currency: 'CNY',
      },
      attach: JSON.stringify({ orderId }),
    };

    const result = await (pay as any).transactions_native(params);
    const codeUrl = result?.code_url;
    if (!codeUrl) {
      throw new Error(result?.message || 'WeChat Pay did not return code_url');
    }

    return { codeUrl };
  }

  async verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    serial: string,
    nonce: string,
    timestamp: string
  ): Promise<boolean> {
    try {
      const cfg = await this.getWechatpayConfig();
      if (!cfg) return false;
      const pay = this.createPay(cfg);
      if (!pay) return false;
      const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      return (pay as any).verifySign(bodyStr, signature, serial, nonce, timestamp);
    } catch {
      return false;
    }
  }

  async decryptNotify(resource: {
    ciphertext?: string;
    nonce?: string;
    associated_data?: string;
  }): Promise<Record<string, unknown> | null> {
    try {
      const cfg = await this.getWechatpayConfig();
      if (!cfg) return null;
      const pay = this.createPay(cfg);
      if (!pay || !(pay as any).decipher_gcm) return null;
      const decrypted = (pay as any).decipher_gcm(resource);
      return typeof decrypted === 'object' ? decrypted : null;
    } catch {
      return null;
    }
  }
}

export const wechatpayService = new WechatpayService();
