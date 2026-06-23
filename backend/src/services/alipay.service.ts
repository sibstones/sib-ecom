import { AlipaySdk } from 'alipay-sdk';
import { paymentGatewayService } from './payment-gateway.service';
import { config } from '../config/env';
import { PaymentGatewayConfig } from '../types/payment-gateway';

export class AlipayService {
  private async getAlipayConfig(): Promise<{
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    isTestMode: boolean;
  } | null> {
    const gateway = await paymentGatewayService.getByType('ALIPAY');
    if (!gateway || !gateway.isEnabled) return null;

    const cfg = gateway.config as PaymentGatewayConfig & Record<string, unknown>;
    const appId = cfg.appId?.toString().trim();
    const privateKey = cfg.privateKey?.toString().trim();
    const alipayPublicKey = cfg.alipayPublicKey?.toString().trim();

    if (!appId || !privateKey || !alipayPublicKey) return null;

    return {
      appId,
      privateKey,
      alipayPublicKey,
      isTestMode: gateway.isTestMode ?? true,
    };
  }

  private createSdk(cfg: {
    appId: string;
    privateKey: string;
    alipayPublicKey: string;
    isTestMode?: boolean;
  }): AlipaySdk {
    const gatewayUrl = cfg.isTestMode
      ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
      : 'https://openapi.alipay.com/gateway.do';

    return new AlipaySdk({
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      alipayPublicKey: cfg.alipayPublicKey,
      gateway: gatewayUrl,
      signType: 'RSA2' as const,
      keyType: 'PKCS8' as const,
    });
  }

  async createPagePay(
    orderId: string,
    orderNumber: string,
    amount: number,
    currency: string,
    subject: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    const alipayConfig = await this.getAlipayConfig();
    if (!alipayConfig) {
      throw new Error('Alipay is not configured or enabled');
    }

    const frontendBaseUrl = config.frontend.baseUrl;
    const apiBase = process.env.API_BASE_URL || `http://localhost:${config.port}`;
    const notifyUrl = `${apiBase.replace(/\/$/, '')}/api/payments/alipay/webhook`;
    const effectiveReturnUrl = returnUrl || `${frontendBaseUrl}/payment/success?order_id=${orderId}`;

    const sdk = this.createSdk({ ...alipayConfig, isTestMode: alipayConfig.isTestMode });

    const bizContent = {
      out_trade_no: orderId,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      subject: subject || `Order ${orderNumber}`,
      body: `Order ${orderNumber}`,
      total_amount: amount.toFixed(2),
    };

    const url = sdk.pageExecute('alipay.trade.page.pay', 'GET', {
      bizContent,
      returnUrl: effectiveReturnUrl,
      notifyUrl,
    } as any);

    return { url };
  }

  async verifyNotifySign(postData: Record<string, string>): Promise<boolean> {
    try {
      const cfg = await this.getAlipayConfig();
      if (!cfg) return false;
      const sdk = this.createSdk({ ...cfg, isTestMode: cfg.isTestMode });
      return (sdk as any).checkNotifySignV2 ? (sdk as any).checkNotifySignV2(postData) : (sdk as any).checkNotifySign(postData);
    } catch {
      return false;
    }
  }
}

export const alipayService = new AlipayService();
